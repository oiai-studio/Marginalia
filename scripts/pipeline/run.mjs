#!/usr/bin/env node
// Weekly ingest orchestrator (PIPELINE.md):
//
//   retrieve broadly -> dedupe -> triage -> score -> select (in code)
//   -> extract full text -> synthesise -> write entries + PR summary
//
// The shape matters. Retrieval optimises for recall and judging does the
// filtering, so the expensive step (full-text extraction, one model call
// per paper) only ever runs on papers that survived. Broadening the net
// makes a run cheaper, not dearer.
//
// Run by .github/workflows/ingest.yml, or by hand via
// `npm run pipeline:run`. PIPELINE_DRY_RUN=1 stops after judging and
// writes the summary without extracting or writing any entry — that is
// the cheap way to calibrate the threshold.
//
// A per-candidate failure (extraction error, unusable vocabulary value)
// is logged and skipped, never a crash: one bad paper shouldn't take the
// weekly run down with it.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';
import { queryCategory } from '../lib/fetch-arxiv.mjs';
import { queryContainer } from '../lib/fetch-crossref.mjs';
import { formatAuthors } from '../lib/write-entries.mjs';
import { loadKnownIds, loadRejectedIds, isDuplicate, dedupeCandidates } from './dedupe.mjs';
import { processCandidate } from '../lib/process-candidate.mjs';
import { popFromQueue } from '../lib/backlog-queue.mjs';
import {
  triageCandidates,
  scoreCandidates,
  confirmBorderline,
  selectPapers,
  clusterAndSynthesise,
} from '../lib/judge.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// cs.HC needs no keyword gate at all — it is an HCI category by
// definition, and a gate there is pure loss. The rest are genuinely
// noisy (most cs.LG papers have nothing to do with people), so they
// keep an AI term AND a human-centred term.
//
// Both lists are deliberately recall-oriented now. The old AI-AND-UX
// gate was the main thing losing good papers: a title like "Compass vs
// Railway Tracks" carries no keywords at all, and its abstract may not
// either, while the paper itself is squarely about how people direct
// agents. Precision is the judge's job now, so these only need to be
// wide enough to get a paper in front of it.
const ARXIV_CATEGORIES = [
  { category: 'cs.HC', requireHumanTerms: false },
  { category: 'cs.AI', requireHumanTerms: true },
  { category: 'cs.CL', requireHumanTerms: true },
  { category: 'cs.LG', requireHumanTerms: true },
  { category: 'cs.CY', requireHumanTerms: true }, // societal/governance angles on AI
  { category: 'cs.IR', requireHumanTerms: true }, // search/recommender UX
];

const AI_TERMS = [
  'LLM',
  'large language model',
  'generative AI',
  'human-AI',
  'human-agent',
  'AI agent',
  'agentic',
  'computer-use agent',
  'conversational AI',
  'foundation model',
  'chatbot',
  'copilot',
];

// Anything suggesting people were actually involved or considered —
// method words as much as UX words, since an interview study of
// designers rarely says "user experience" anywhere in its abstract.
const HUMAN_TERMS = [
  'user study',
  'human-computer interaction',
  'interaction design',
  'user interface',
  'usability',
  'user experience',
  'co-design',
  'mixed-initiative',
  'human-agent collaboration',
  'design practice',
  'participants',
  'interview study',
  'qualitative',
  'think-aloud',
  'designers',
  'practitioners',
  'human-centered',
  'human-centred',
  'cognitive',
  'trust',
  'explainability',
  'over-reliance',
  'workflow',
  'end-user',
];

// Verified live against the Crossref API (2026-08-10) — do not hardcode
// a specific edition's container-title (e.g. "28th International
// Conference on..."): several of these venues bake an ordinal into their
// actual Crossref container-title per year (UIST in particular), so an
// exact-edition query silently ages badly. `query` is a broad string for
// Crossref's fuzzy container-title search; `pattern` verifies the actual
// returned container-title genuinely matches this venue before accepting
// it, rather than trusting the query alone. IMWUT's journal has absorbed
// UbiComp and MobileHCI's proceedings since they stopped running as
// separate ACM DL container titles, so one entry covers all three.
const CROSSREF_VENUES = [
  { query: 'CHI Conference on Human Factors in Computing Systems', pattern: /human factors in computing systems/i, venue: 'CHI', venueType: 'peer-reviewed' },
  { query: 'Intelligent User Interfaces', pattern: /intelligent user interfaces/i, venue: 'IUI', venueType: 'peer-reviewed' },
  { query: 'Annual ACM Symposium on User Interface Software and Technology', pattern: /user interface software and technology/i, venue: 'UIST', venueType: 'peer-reviewed' },
  { query: 'Computer-Supported Cooperative Work', pattern: /computer.supported cooperative work/i, venue: 'CSCW', venueType: 'peer-reviewed' },
  { query: 'Designing Interactive Systems Conference', pattern: /designing interactive systems/i, venue: 'DIS', venueType: 'peer-reviewed' },
  { query: 'Human-Robot Interaction', pattern: /human.robot interaction/i, venue: 'HRI', venueType: 'peer-reviewed' },
  { query: 'Proceedings of the ACM on Interactive, Mobile, Wearable and Ubiquitous Technologies', pattern: /interactive, mobile, wearable and ubiquitous/i, venue: 'IMWUT (UbiComp/MobileHCI)', venueType: 'peer-reviewed' },
  { query: 'Annual Symposium on Computer-Human Interaction in Play', pattern: /computer-human interaction in play/i, venue: 'CHI PLAY', venueType: 'peer-reviewed' },
];

const WINDOW_DAYS = 8;
const MAX_RESULTS_PER_CATEGORY = 400;

/** An unset workflow input arrives as an empty string, not as undefined,
 * and `Number('')` is 0 rather than NaN — so `process.env.X ?? default`
 * would silently set a threshold of zero and publish everything the
 * judge scored. Treat blank and unparseable alike as "not set". */
function numberFromEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    console.error(`${name}="${raw}" is not a number — using the default of ${fallback}.`);
    return fallback;
  }
  return value;
}

const DRY_RUN = process.env.PIPELINE_DRY_RUN === '1';
// The bar, out of 15 (design_usefulness + empirical_weight + novelty,
// each 0-5).
//
// 13 is calibrated, not guessed. Measured against a real 8-day window
// (2026-08-31, 395 unique papers): a bar of 12 ships 24 papers, 13 ships
// 8, and 14 ships 1. Eight is the target weekly volume. The scores
// cluster tightly because the model anchors high even with the rubric's
// distribution guidance, so the useful range is narrow — moving this by
// one is a big change, not a nudge. Every run prints the full histogram
// so it can be re-checked against real output rather than assumed.
const SCORE_THRESHOLD = numberFromEnv('PIPELINE_SCORE_THRESHOLD', 13);
const RELEVANCE_GATE = numberFromEnv('PIPELINE_RELEVANCE_GATE', 3);
// A spend limit, not an editorial one. Nothing caps what qualifies; this
// caps what one run will pay to extract, and the surplus is reported
// rather than dropped.
const RUN_CEILING = numberFromEnv('PIPELINE_RUN_CEILING', 25);
const BACKLOG_PER_RUN = numberFromEnv('PIPELINE_BACKLOG_COUNT', 5);

function sinceDate() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - WINDOW_DAYS);
  return d;
}

async function collectArxivCandidates(since) {
  const candidates = [];
  for (const { category, requireHumanTerms } of ARXIV_CATEGORIES) {
    const keywordGroups = requireHumanTerms ? [AI_TERMS, HUMAN_TERMS] : [];
    let entries = [];
    try {
      entries = await queryCategory(category, {
        sinceDate: since,
        keywordGroups,
        maxResults: MAX_RESULTS_PER_CATEGORY,
      });
    } catch (err) {
      console.error(`arXiv query failed for ${category}: ${err.message}`);
      continue;
    }
    for (const e of entries) {
      candidates.push({
        source: 'arxiv',
        arxivId: e.arxivId,
        title: e.title,
        abstract: e.summary,
        authors: formatAuthors(e.authors),
        published: e.published,
        url: e.absUrl,
        venue: `arXiv ${category}`,
        venueType: 'preprint',
      });
    }
    console.log(`  arXiv ${category}: ${entries.length} in window`);
  }
  return candidates;
}

async function collectCrossrefCandidates(since) {
  const candidates = [];
  for (const { query, pattern, venue, venueType } of CROSSREF_VENUES) {
    let works = [];
    try {
      works = await queryContainer(query, { sinceDate: since });
    } catch (err) {
      console.error(`Crossref query failed for "${query}": ${err.message}`);
      continue;
    }
    for (const w of works) {
      if (!w.doi || !w.title) continue;
      // The query is a fuzzy relevance search, not an exact filter —
      // verify the actual returned container-title really is this venue
      // before accepting it (see the "CHI PLAY" -> "Play" false match
      // this caught during testing).
      if (!pattern.test(w.containerTitle ?? '')) continue;
      candidates.push({
        source: 'crossref',
        doi: w.doi,
        title: w.title,
        abstract: w.abstract,
        authors: formatAuthors(w.authors),
        published: w.published,
        url: w.url,
        venue,
        venueType,
      });
    }
  }
  return candidates;
}

const scoreCells = (p) =>
  `${p.scores.hci_relevance}/${p.scores.design_usefulness}/${p.scores.empirical_weight}/${p.scores.novelty}`;

const escapePipes = (text) => String(text ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');

function summaryMarkdown({ synthesis, selected, written, nearMisses, failed, stats, dryRun }) {
  const out = [];

  out.push(
    `Retrieved ${stats.retrieved}, ${stats.unique} unique papers after collapsing cross-listings, ` +
      `${stats.fresh} new after dedupe, ${stats.triaged} passed triage, ${stats.selected} cleared the bar.`
  );
  out.push('');
  out.push(
    `Bar: \`design_usefulness + empirical_weight + novelty >= ${SCORE_THRESHOLD}\` (out of 15), ` +
      `with a hard gate of \`hci_relevance >= ${RELEVANCE_GATE}\`. Equal weights, and every score is below ` +
      'so the bar can be tuned against real output.'
  );

  if (synthesis) {
    out.push('', '## What clusters this week', '');
    out.push(synthesis);
    out.push('', '_Written by the model from the selected papers. An interpretation, not a finding, and it stays in this pull request — it never reaches an entry file._');
  }

  out.push('', `## Selected (${dryRun ? selected.length : written.length})`, '');
  if ((dryRun ? selected : written).length === 0) {
    out.push('Nothing cleared the bar this run.');
  } else if (dryRun) {
    // Dry run stops before extraction, so there is no theme, N or study
    // type yet — but the point of a dry run is seeing what the judge
    // would have picked, so show that.
    out.push('Dry run: judged but not extracted, so no entry files were written.');
    out.push('');
    out.push('| Title | Scores | Total | Why | Link |');
    out.push('|---|---|---|---|---|');
    for (const p of selected) {
      out.push(
        `| ${escapePipes(p.title)} | ${scoreCells(p)} | ${p.total} | ${escapePipes(p.judgeReason)} | [link](${p.url}) |`
      );
    }
  } else {
    out.push('Scores are `relevance/usefulness/empirical/novelty`.');
    out.push('');
    out.push('| Title | Theme | N | Study type | Scores | Why | Link |');
    out.push('|---|---|---|---|---|---|---|');
    for (const r of written) {
      out.push(
        `| ${escapePipes(r.candidate.title)} | ${r.extraction.theme} | ${r.extraction.participants} | ` +
          `${r.extraction.study_type} | ${scoreCells(r.candidate)} | ${escapePipes(r.candidate.judgeReason)} | ` +
          `[link](${r.candidate.url}) |`
      );
    }
  }

  const repaired = written.filter((r) => r.extraction.repairs?.length);
  if (repaired.length) {
    out.push('', '## Repaired automatically', '');
    out.push('Known model slips fixed in code rather than skipping the paper. Worth a glance, not a blocker.');
    out.push('');
    for (const r of repaired) {
      out.push(`- **${escapePipes(r.candidate.title)}** — ${r.extraction.repairs.join('; ')}`);
    }
  }

  const proposed = written.filter((r) => r.extraction.proposedTags?.length);
  if (proposed.length) {
    out.push('', '## Tags proposed outside the closed list', '');
    out.push('Not added to any entry. Accept into `vocab.mjs` or ignore.');
    out.push('');
    for (const r of proposed) {
      out.push(`- **${escapePipes(r.candidate.title)}** — ${r.extraction.proposedTags.join(', ')}`);
    }
  }

  if (nearMisses.length) {
    out.push('', `## Considered and dropped (${nearMisses.length} closest)`, '');
    out.push('The judge is uncalibrated. If something here should have shipped, that is the signal to move the bar.');
    out.push('');
    out.push('| Title | Scores | Total | Why not | Link |');
    out.push('|---|---|---|---|---|');
    for (const p of nearMisses) {
      out.push(
        `| ${escapePipes(p.title)} | ${scoreCells(p)} | ${p.total} | ${escapePipes(p.missReason)} | [link](${p.url}) |`
      );
    }
  }

  if (failed.length) {
    out.push('', `## Skipped (${failed.length})`, '');
    out.push('Cleared the bar but could not be turned into a valid entry.');
    out.push('');
    for (const r of failed) {
      out.push(`- **${escapePipes(r.candidate.title)}** — ${r.errors.join('; ')}`);
    }
  }

  if (stats.histogram) {
    out.push('', '## Where the bar sits', '');
    out.push('Papers by total score, of those that passed triage and the relevance gate.');
    out.push('');
    out.push('| Total | Papers | Ships at this bar |');
    out.push('|---|---|---|');
    for (const { total, count, cumulative } of stats.histogram) {
      out.push(`| ${total} | ${count} | ${cumulative} |`);
    }
    out.push('');
    out.push(`Currently set to ${SCORE_THRESHOLD}. Move \`PIPELINE_SCORE_THRESHOLD\` to change how many ship.`);
  }

  if (stats.triageDropped) {
    out.push('', `_${stats.triageDropped} further candidates were dropped at triage as technical work with no real human or design contribution._`);
  }

  return out.join('\n');
}

async function main() {
  const since = sinceDate();
  console.log(`Retrieving candidates since ${since.toISOString().slice(0, 10)}${DRY_RUN ? ' (DRY RUN)' : ''}...`);

  const [arxivCandidates, crossrefCandidates] = await Promise.all([
    collectArxivCandidates(since),
    collectCrossrefCandidates(since),
  ]);
  const retrieved = [...arxivCandidates, ...crossrefCandidates];
  // Collapse cross-listings first, then drop anything already indexed or
  // already rejected. Both steps are needed and they are not the same
  // check: the first is about this run repeating itself, the second is
  // about previous runs.
  const allCandidates = dedupeCandidates(retrieved);

  const { arxivIds, dois } = await loadKnownIds();
  const rejected = await loadRejectedIds();
  const fresh = allCandidates.filter((c) => !isDuplicate(c, { arxivIds, dois, rejected }));

  console.log(
    `${retrieved.length} retrieved, ${allCandidates.length} unique papers, ${fresh.length} new after dedupe.`
  );

  console.log('Triaging...');
  const { kept, dropped } = await triageCandidates(fresh);
  console.log(`  ${kept.length} kept, ${dropped.length} dropped as technical noise.`);

  console.log('Scoring...');
  const scoredOnce = await scoreCandidates(kept);
  const scored = await confirmBorderline(scoredOnce, { threshold: SCORE_THRESHOLD });

  const { selected, nearMisses } = selectPapers(scored, {
    threshold: SCORE_THRESHOLD,
    relevanceGate: RELEVANCE_GATE,
    ceiling: RUN_CEILING,
  });
  console.log(`${selected.length} cleared the bar of ${SCORE_THRESHOLD}.`);

  const results = [];

  if (DRY_RUN) {
    console.log('Dry run — stopping before extraction. No entries written.');
  } else {
    for (const candidate of selected) {
      try {
        results.push(await processCandidate(candidate, 'pipeline', { status: 'published' }));
      } catch (err) {
        results.push({ ok: false, candidate, errors: [err.message] });
      }
    }

    // Rob's own picks, drained a few at a time. These are not judged —
    // he already selected them, which is the whole point of the queue.
    const backlogRows = await popFromQueue(BACKLOG_PER_RUN);
    for (const row of backlogRows) {
      const candidate = {
        source: row.resolved_type === 'arxiv' ? 'arxiv' : 'crossref',
        arxivId: row.resolved_type === 'arxiv' ? row.resolved_id : undefined,
        doi: row.resolved_type === 'doi' ? row.resolved_id : undefined,
        title: row.resolved_title || row.title,
        published: row.resolved_published,
        url: row.resolved_url,
        venue: row.resolved_type === 'arxiv' ? 'arXiv' : 'unknown venue',
        venueType: row.resolved_type === 'arxiv' ? 'preprint' : 'peer-reviewed',
        scores: { hci_relevance: 0, design_usefulness: 0, empirical_weight: 0, novelty: 0 },
        total: 0,
        judgeReason: 'from the backlog queue, not judged',
      };
      try {
        results.push(await processCandidate(candidate, 'backlog', { status: 'published' }));
      } catch (err) {
        results.push({ ok: false, candidate, errors: [err.message] });
      }
    }
  }

  const written = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);

  console.log(`${written.length} entries written, ${failed.length} skipped.`);
  for (const r of failed) {
    console.log(`  skipped "${r.candidate.title}": ${r.errors.join('; ')}`);
  }

  // Every judged paper at or above the relevance gate, counted by total,
  // with a running "how many would ship if the bar were here". This is
  // the whole calibration story in one table, and it costs nothing.
  const gated = scored.filter((p) => p.scores.hci_relevance >= RELEVANCE_GATE);
  const counts = new Map();
  for (const p of gated) counts.set(p.total, (counts.get(p.total) ?? 0) + 1);
  let cumulative = 0;
  const histogram = [...counts.keys()]
    .sort((a, b) => b - a)
    .map((total) => {
      cumulative += counts.get(total);
      return { total, count: counts.get(total), cumulative };
    });

  if (DRY_RUN) {
    // Judging is the part that costs money. Keep the scores so the bar
    // can be moved and re-tested for free.
    const scoresPath = path.resolve(__dirname, 'run-scores.json');
    await writeFile(
      scoresPath,
      JSON.stringify(
        scored.map((p) => ({ arxivId: p.arxivId, doi: p.doi, title: p.title, url: p.url, scores: p.scores, total: p.total, judgeReason: p.judgeReason })),
        null,
        2
      ),
      'utf8'
    );
    console.log(`Scores kept at ${scoresPath} for offline threshold tuning.`);
  }

  const synthesis = DRY_RUN ? '' : await clusterAndSynthesise(selected);

  const summary = summaryMarkdown({
    synthesis,
    dryRun: DRY_RUN,
    selected,
    written,
    nearMisses: nearMisses.slice(0, 15),
    failed,
    stats: {
      retrieved: retrieved.length,
      unique: allCandidates.length,
      fresh: fresh.length,
      triaged: kept.length,
      triageDropped: dropped.length,
      selected: selected.length,
      histogram,
    },
  });

  const summaryPath = path.resolve(__dirname, 'run-summary.md');
  await writeFile(summaryPath, summary, 'utf8');
  console.log(`PR summary written to ${summaryPath}`);
}

main().catch((err) => {
  console.error('pipeline run failed:', err);
  process.exitCode = 1;
});

#!/usr/bin/env node
// Weekly ingest orchestrator (PIPELINE.md): query sources, dedupe, fetch
// full text, extract, write queued entries, drain a few backlog rows,
// and emit a PR summary. Run by .github/workflows/ingest.yml, or by hand
// via `npm run pipeline:run`.
//
// The extraction step (scripts/lib/extract.mjs) calls DeepSeek live via
// callDeepSeek(). A per-candidate failure (extraction error, bad theme/
// tag value) is logged and skipped, not a crash — one bad candidate
// shouldn't kill the whole weekly run.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';
import { queryCategory } from '../lib/fetch-arxiv.mjs';
import { queryContainer } from '../lib/fetch-crossref.mjs';
import { loadKnownIds, loadRejectedIds, isDuplicate } from './dedupe.mjs';
import { processCandidate } from '../lib/process-candidate.mjs';
import { popFromQueue } from '../lib/backlog-queue.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// cs.HC is already an HCI category by definition, so it only needs an
// AI-concept match. The others are far noisier (most cs.AI/cs.LG papers
// have nothing to do with HCI), so they also require a UX-concept match
// — cheap precision filter, no scoring weights needed for it.
const ARXIV_CATEGORIES = [
  { category: 'cs.HC', requireUxTerms: false },
  { category: 'cs.AI', requireUxTerms: true },
  { category: 'cs.CL', requireUxTerms: true },
  { category: 'cs.LG', requireUxTerms: true },
  { category: 'cs.CY', requireUxTerms: true }, // societal/governance angles on AI
  { category: 'cs.IR', requireUxTerms: true }, // search/recommender UX
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
];

const UX_TERMS = [
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
// Real evidence a wider net is needed: the first live run found 388
// candidates from 3 categories and processed a blind first-25 (no
// ranking exists yet). Bumped, but deliberately not all the way to
// hundreds — there's no scoring step to prioritise them, so every extra
// candidate here is one more DeepSeek call, one more thing for Rob to
// review in the PR table.
const MAX_RESULTS_PER_CATEGORY = 150;
const MAX_PER_RUN = Number(process.env.PIPELINE_MAX_PAPERS ?? 40);
const BACKLOG_PER_RUN = Number(process.env.PIPELINE_BACKLOG_COUNT ?? 5);

function sinceDate() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - WINDOW_DAYS);
  return d;
}

async function collectArxivCandidates(since) {
  const candidates = [];
  for (const { category, requireUxTerms } of ARXIV_CATEGORIES) {
    const keywordGroups = requireUxTerms ? [AI_TERMS, UX_TERMS] : [AI_TERMS];
    const entries = await queryCategory(category, {
      sinceDate: since,
      keywordGroups,
      maxResults: MAX_RESULTS_PER_CATEGORY,
    });
    for (const e of entries) {
      candidates.push({
        source: 'arxiv',
        arxivId: e.arxivId,
        title: e.title,
        published: e.published,
        url: e.absUrl,
        venue: `arXiv ${category}`,
        venueType: 'preprint',
      });
    }
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
        published: w.published,
        url: w.url,
        venue,
        venueType,
      });
    }
  }
  return candidates;
}

function prTable(results) {
  const written = results.filter((r) => r.ok);
  if (written.length === 0) return 'No entries written this run.';
  const rows = written.map(
    (r) =>
      `| ${r.candidate.title} | ${r.extraction.theme} | ${r.extraction.participants} | ${r.extraction.study_type} | [link](${r.candidate.url}) |`
  );
  return ['| Title | Theme | N | Study type | Link |', '|---|---|---|---|---|', ...rows].join('\n');
}

async function main() {
  const since = sinceDate();
  const [arxivCandidates, crossrefCandidates] = await Promise.all([
    collectArxivCandidates(since),
    collectCrossrefCandidates(since),
  ]);
  const allCandidates = [...arxivCandidates, ...crossrefCandidates];

  const { arxivIds, dois } = await loadKnownIds();
  const rejected = await loadRejectedIds();
  const fresh = allCandidates.filter((c) => !isDuplicate(c, { arxivIds, dois, rejected }));

  const overflow = Math.max(0, fresh.length - MAX_PER_RUN);
  const capped = fresh.slice(0, MAX_PER_RUN);
  if (overflow > 0) {
    console.log(`${overflow} candidates over the ${MAX_PER_RUN}/run cap were logged and skipped this run.`);
  }

  console.log(`${allCandidates.length} candidates found, ${fresh.length} new after dedupe, processing ${capped.length}.`);

  const results = [];
  for (const candidate of capped) {
    try {
      results.push(await processCandidate(candidate, 'pipeline'));
    } catch (err) {
      results.push({ ok: false, candidate, errors: [err.message] });
    }
  }

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
    };
    try {
      results.push(await processCandidate(candidate, 'backlog'));
    } catch (err) {
      results.push({ ok: false, candidate, errors: [err.message] });
    }
  }

  const succeeded = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);

  console.log(`${succeeded.length} entries written, ${failed.length} skipped.`);
  for (const r of failed) {
    console.log(`  skipped "${r.candidate.title}": ${r.errors.join('; ')}`);
  }

  const summaryPath = path.resolve(__dirname, 'run-summary.md');
  await writeFile(summaryPath, prTable(results), 'utf8');
  console.log(`PR summary table written to ${summaryPath}`);
}

main().catch((err) => {
  console.error('pipeline run failed:', err);
  process.exitCode = 1;
});

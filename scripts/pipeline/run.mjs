#!/usr/bin/env node
// Weekly ingest orchestrator (PIPELINE.md): query sources, dedupe, fetch
// full text, extract, write queued entries, drain a few backlog rows,
// and emit a PR summary. Run by .github/workflows/ingest.yml, or by hand
// via `npm run pipeline:run`.
//
// The extraction step (scripts/lib/extract.mjs) has no LLM provider wired
// in yet, so it throws for every candidate until one is configured. This
// script treats that as a per-candidate failure, not a crash — it logs
// each skip and still exercises query/dedupe/full-text-fetch end to end,
// which is exactly what's testable without an API key (see the plan's
// verification notes).

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';
import { queryCategory } from '../lib/fetch-arxiv.mjs';
import { queryContainer } from '../lib/fetch-crossref.mjs';
import { loadKnownIds, loadRejectedIds, isDuplicate } from './dedupe.mjs';
import { processCandidate } from '../lib/process-candidate.mjs';
import { popFromQueue } from '../lib/backlog-queue.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ARXIV_CATEGORIES = ['cs.HC', 'cs.AI', 'cs.CL'];
const CROSSREF_VENUES = [
  { containerTitle: 'CHI Conference on Human Factors in Computing Systems', venue: 'CHI', venueType: 'peer-reviewed' },
  { containerTitle: 'Proceedings of the 28th International Conference on Intelligent User Interfaces', venue: 'IUI', venueType: 'peer-reviewed' },
];
const KEYWORDS = ['human-AI', 'LLM', 'agent', 'interface', 'user study', 'interaction', 'trust', 'collaboration'];
const WINDOW_DAYS = 8;
const MAX_PER_RUN = Number(process.env.PIPELINE_MAX_PAPERS ?? 25);
const BACKLOG_PER_RUN = Number(process.env.PIPELINE_BACKLOG_COUNT ?? 5);

function sinceDate() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - WINDOW_DAYS);
  return d;
}

async function collectArxivCandidates(since) {
  const candidates = [];
  for (const category of ARXIV_CATEGORIES) {
    const entries = await queryCategory(category, { sinceDate: since, keywords: KEYWORDS });
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
  for (const { containerTitle, venue, venueType } of CROSSREF_VENUES) {
    let works = [];
    try {
      works = await queryContainer(containerTitle, { sinceDate: since });
    } catch (err) {
      console.error(`Crossref query failed for "${containerTitle}": ${err.message}`);
      continue;
    }
    for (const w of works) {
      if (!w.doi || !w.title) continue;
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

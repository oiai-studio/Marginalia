#!/usr/bin/env node
// Fast-tracks Rob's hand-picked backlog IDs (IMPORT.md: "Rob picks
// fifteen or twenty he already knows are good") out of the queue and
// through extract+write immediately, rather than waiting for the weekly
// drain. Keeps resolve-backlog.mjs itself free of editorial judgment —
// the split between "seed now" and "drain later" is Rob's call, made by
// editing data/backlog-seed.txt, not something the resolver infers.
//
// Usage: node scripts/import/seed-queue.mjs [path/to/backlog-seed.txt]

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readQueue, writeQueue } from '../lib/backlog-queue.mjs';
import { processCandidate } from '../lib/process-candidate.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SEED_PATH = path.resolve(__dirname, '../../data/backlog-seed.txt');

async function loadSeedIds(seedPath) {
  const raw = await readFile(seedPath, 'utf8').catch((err) => {
    if (err.code === 'ENOENT') return '';
    throw err;
  });
  return new Set(
    raw
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
  );
}

function rowToCandidate(row) {
  return {
    source: row.resolved_type === 'arxiv' ? 'arxiv' : 'crossref',
    arxivId: row.resolved_type === 'arxiv' ? row.resolved_id : undefined,
    doi: row.resolved_type === 'doi' ? row.resolved_id : undefined,
    title: row.resolved_title || row.title,
    published: row.resolved_published,
    url: row.resolved_url,
    venue: row.resolved_type === 'arxiv' ? 'arXiv' : 'unknown venue',
    venueType: row.resolved_type === 'arxiv' ? 'preprint' : 'peer-reviewed',
  };
}

async function main() {
  const seedPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_SEED_PATH;
  const seedIds = await loadSeedIds(seedPath);

  if (seedIds.size === 0) {
    console.log(`No seed IDs found in ${seedPath} — nothing to fast-track.`);
    return;
  }

  const queue = await readQueue();
  const toSeed = queue.filter((row) => seedIds.has(row.identifier) || seedIds.has(row.resolved_id));

  if (toSeed.length === 0) {
    console.log(`None of the ${seedIds.size} seed IDs were found in the backlog queue.`);
    return;
  }

  console.log(`Fast-tracking ${toSeed.length} of ${seedIds.size} seed IDs.`);

  const results = [];
  for (const row of toSeed) {
    try {
      results.push(await processCandidate(rowToCandidate(row), 'backlog'));
    } catch (err) {
      results.push({ ok: false, candidate: row, errors: [err.message] });
    }
  }

  // Only remove rows from the queue that were actually written — a
  // failed extraction should stay queued for the next normal drain
  // rather than silently disappearing.
  const written = new Set(results.filter((r) => r.ok).map((r) => r.candidate.arxivId ?? r.candidate.doi));
  const stillQueued = queue.filter((row) => {
    const id = row.resolved_id;
    const wasSeeded = seedIds.has(row.identifier) || seedIds.has(row.resolved_id);
    return !wasSeeded || !written.has(id);
  });

  await writeQueue(stillQueued);

  const succeeded = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);
  console.log(`${succeeded.length} written, ${failed.length} failed and left in the queue.`);
  for (const r of failed) {
    console.log(`  failed "${r.candidate.title ?? r.candidate.resolved_title}": ${r.errors.join('; ')}`);
  }
}

main().catch((err) => {
  console.error('seed-queue failed:', err);
  process.exitCode = 1;
});

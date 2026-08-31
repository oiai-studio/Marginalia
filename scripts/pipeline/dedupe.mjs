// Dedupe against every existing entry's arxiv_id/doi, and against
// data/rejected.txt, per PIPELINE.md step 2: "Never resurface a
// rejection."

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readAllEntries } from '../lib/entries.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REJECTED_PATH = path.resolve(__dirname, '../../data/rejected.txt');

export async function loadKnownIds() {
  const entries = await readAllEntries();
  const arxivIds = new Set();
  const dois = new Set();
  for (const { data } of entries) {
    if (data.arxiv_id) arxivIds.add(data.arxiv_id);
    if (data.doi) dois.add(data.doi);
  }
  return { arxivIds, dois };
}

export async function loadRejectedIds() {
  try {
    const raw = await readFile(REJECTED_PATH, 'utf8');
    return new Set(
      raw
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
    );
  } catch (err) {
    if (err.code === 'ENOENT') return new Set();
    throw err;
  }
}

/**
 * Collapses candidates that are the same paper. arXiv cross-listing makes
 * this common and it is not optional: a paper in both cs.HC and cs.AI is
 * returned by both queries, and without this it gets judged twice, scored
 * twice, extracted twice, and written to the same filename twice.
 * Observed live (2026-08-31): three papers appeared twice in a single
 * run's selection, one of them with two different scores.
 *
 * Keeps the first occurrence, so the category order in run.mjs decides
 * which venue label a cross-listed paper carries — cs.HC first, which is
 * the more accurate label for anything listed there.
 */
export function dedupeCandidates(candidates) {
  const seen = new Set();
  const unique = [];
  for (const candidate of candidates) {
    const key = candidate.arxivId ?? candidate.doi;
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(candidate);
  }
  return unique;
}

/** True if a candidate (by arxiv_id or doi) should be skipped. */
export function isDuplicate(candidate, { arxivIds, dois, rejected }) {
  if (candidate.arxivId && (arxivIds.has(candidate.arxivId) || rejected.has(candidate.arxivId))) {
    return true;
  }
  if (candidate.doi && (dois.has(candidate.doi) || rejected.has(candidate.doi))) {
    return true;
  }
  return false;
}

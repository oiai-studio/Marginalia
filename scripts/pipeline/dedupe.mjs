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

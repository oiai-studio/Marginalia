// Shared read/write for data/backlog-queue.csv, the queue of resolved
// backlog rows waiting to be drained (IMPORT.md: "the rest sit in
// backlog-queue.csv and the weekly Action pulls five of them"). Used by
// both scripts/import (which appends newly-resolved rows) and
// scripts/pipeline/run.mjs (which pops rows off each week).

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const QUEUE_PATH = path.resolve(__dirname, '../../data/backlog-queue.csv');

// Resolved-row shape: the original CSV row plus what resolution found, so
// the pipeline doesn't need to re-resolve on pop.
export const COLUMNS = [
  'identifier',
  'title',
  'date_found',
  'resolved_type', // "arxiv" | "doi"
  'resolved_id', // arxiv_id or doi
  'resolved_title',
  'resolved_published', // YYYY-MM-DD
  'resolved_url',
];

export async function readQueue() {
  try {
    const raw = await readFile(QUEUE_PATH, 'utf8');
    if (!raw.trim()) return [];
    return parse(raw, { columns: true, skip_empty_lines: true });
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

export async function writeQueue(rows) {
  await mkdir(path.dirname(QUEUE_PATH), { recursive: true });
  const csv = stringify(rows, { header: true, columns: COLUMNS });
  await writeFile(QUEUE_PATH, csv, 'utf8');
}

export async function appendToQueue(rows) {
  const existing = await readQueue();
  await writeQueue([...existing, ...rows]);
}

/** Pops up to `n` rows off the front of the queue (FIFO) and persists the
 * shrunk remainder. Returns the popped rows. */
export async function popFromQueue(n) {
  const rows = await readQueue();
  const popped = rows.slice(0, n);
  const remaining = rows.slice(n);
  await writeQueue(remaining);
  return popped;
}

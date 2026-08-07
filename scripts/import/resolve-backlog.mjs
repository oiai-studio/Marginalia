#!/usr/bin/env node
// Backlog import orchestrator (IMPORT.md): merges one or more CSV exports
// of { identifier, title, date_found }, resolves each row, appends
// resolved rows to data/backlog-queue.csv, and writes anything unresolved
// to data/unresolved.csv with whatever candidates were found. Logs the
// resolution rate at the end, warning (not failing) under ~70%.
//
// Usage: node scripts/import/resolve-backlog.mjs export1.csv export2.csv

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { resolveRow } from './resolve-row.mjs';
import { appendToQueue } from '../lib/backlog-queue.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UNRESOLVED_PATH = path.resolve(__dirname, '../../data/unresolved.csv');
const RESOLUTION_RATE_WARNING = 0.7;

async function readCsvFiles(filePaths) {
  const rows = [];
  for (const filePath of filePaths) {
    const raw = await readFile(filePath, 'utf8');
    rows.push(...parse(raw, { columns: true, skip_empty_lines: true }));
  }
  return rows;
}

function toQueueRow(row, resolved) {
  return {
    identifier: row.identifier ?? '',
    title: row.title ?? '',
    date_found: row.date_found ?? '',
    resolved_type: resolved.type,
    resolved_id: resolved.id,
    resolved_title: resolved.title ?? '',
    resolved_published: resolved.published ?? '',
    resolved_url: resolved.url ?? '',
  };
}

async function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error('Usage: node scripts/import/resolve-backlog.mjs <file1.csv> [file2.csv ...]');
    process.exitCode = 1;
    return;
  }

  const rows = await readCsvFiles(files);
  console.log(`${rows.length} rows loaded from ${files.length} file(s).`);

  const resolvedRows = [];
  const unresolvedRows = [];

  for (const row of rows) {
    let result;
    try {
      result = await resolveRow(row);
    } catch (err) {
      result = { status: 'unresolved', candidates: [], error: err.message };
    }

    if (result.status === 'resolved') {
      resolvedRows.push(toQueueRow(row, result.resolved));
    } else {
      unresolvedRows.push({
        identifier: row.identifier ?? '',
        title: row.title ?? '',
        date_found: row.date_found ?? '',
        candidates: JSON.stringify(result.candidates ?? []),
        error: result.error ?? '',
      });
    }
  }

  if (resolvedRows.length > 0) {
    await appendToQueue(resolvedRows);
  }

  await mkdir(path.dirname(UNRESOLVED_PATH), { recursive: true });
  const unresolvedCsv = stringify(unresolvedRows, {
    header: true,
    columns: ['identifier', 'title', 'date_found', 'candidates', 'error'],
  });
  await writeFile(UNRESOLVED_PATH, unresolvedCsv, 'utf8');

  const rate = rows.length === 0 ? 1 : resolvedRows.length / rows.length;
  console.log(`Resolved ${resolvedRows.length}/${rows.length} (${(rate * 100).toFixed(1)}%).`);
  console.log(`${unresolvedRows.length} unresolved rows written to ${UNRESOLVED_PATH}.`);

  if (rate < RESOLUTION_RATE_WARNING) {
    console.warn(
      `\n⚠ Resolution rate ${(rate * 100).toFixed(1)}% is under the ~70% sanity threshold. ` +
        `This usually means something is wrong with the CSV export, not the script — worth a look before running again.`
    );
  }
}

main().catch((err) => {
  console.error('resolve-backlog failed:', err);
  process.exitCode = 1;
});

#!/usr/bin/env node
// `make ready` helper (CLAUDE.md/PIPELINE.md): lists queued entries with
// title + theme so Rob doesn't have to open twenty files to see what's
// waiting for a status flip. Built last, optional, per PIPELINE.md's own
// framing.

import { readAllEntries } from './lib/entries.mjs';

async function main() {
  const entries = await readAllEntries();
  const queued = entries
    .filter((e) => e.data.status === 'queued')
    .sort((a, b) => new Date(b.data.added).getTime() - new Date(a.data.added).getTime());

  if (queued.length === 0) {
    console.log('Nothing queued.');
    return;
  }

  console.log(`${queued.length} queued:\n`);
  for (const { fileName, data } of queued) {
    console.log(`[${data.theme}] ${data.title}`);
    console.log(`  ${fileName}  (source: ${data.source})`);
  }
}

main().catch((err) => {
  console.error('ready failed:', err);
  process.exitCode = 1;
});

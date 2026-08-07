// Plain-JS mirror of src/lib/entries.ts, for the CLI scripts (validate,
// pipeline, import) that run outside Astro's own content-collection
// loader and need to read the same .md files directly.

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ENTRIES_DIR = path.resolve(__dirname, '../../src/content/entries');

/**
 * Reads every entry file under src/content/entries.
 * Returns [{ filePath, fileName, data, content }], where `data` is the
 * raw parsed frontmatter (not yet validated against vocab.mjs — that's
 * the caller's job) and `content` is the markdown body.
 */
export async function readAllEntries(dir = ENTRIES_DIR) {
  const fileNames = (await readdir(dir)).filter((name) => name.endsWith('.md'));
  const entries = [];
  for (const fileName of fileNames) {
    const filePath = path.join(dir, fileName);
    const raw = await readFile(filePath, 'utf8');
    const { data, content } = matter(raw);
    entries.push({ filePath, fileName, data, content });
  }
  return entries;
}

// Writes one entry file per CONTENT-MODEL.md's exact shape. Hand-rolled
// rather than a generic YAML serializer: the frontmatter shape is fixed
// and small, and this keeps full control over key order, quoting, and
// the "omit the key entirely if absent" rule for arxiv_id/doi that a
// generic serializer wouldn't know about.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ENTRIES_DIR } from './entries.mjs';

function yamlStr(value) {
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

function yamlDate(value) {
  const d = value instanceof Date ? value : new Date(value);
  return d.toISOString().slice(0, 10);
}

function yamlList(values) {
  return `[${values.join(', ')}]`;
}

function yamlParticipants(value) {
  return typeof value === 'number' ? String(value) : yamlStr(value);
}

/** Slug used in the `entries/<year>-<slug>.md` filename, per CONTENT-MODEL.md. */
export function slugFor({ arxivId, doi }) {
  if (arxivId) return arxivId;
  if (doi) return doi.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  throw new Error('slugFor requires arxivId or doi');
}

export function buildEntryMarkdown(input) {
  const {
    title,
    authors,
    institutions,
    published,
    added = new Date(),
    status,
    source,
    venue,
    venueType,
    url,
    arxivId,
    doi,
    theme,
    secondaryThemes = [],
    tags = [],
    signals,
    finding = '',
    whyItMatters = '',
  } = input;

  const lines = [
    '---',
    `title: ${yamlStr(title)}`,
    `authors: ${yamlStr(authors)}`,
    `institutions: ${yamlStr(institutions)}`,
    `published: ${yamlDate(published)}`,
    `added: ${yamlDate(added)}`,
    `status: ${status}`,
    `source: ${source}`,
    '',
    `venue: ${yamlStr(venue)}`,
    `venue_type: ${venueType}`,
    `url: ${yamlStr(url)}`,
  ];
  if (arxivId) lines.push(`arxiv_id: ${yamlStr(arxivId)}`);
  if (doi) lines.push(`doi: ${yamlStr(doi)}`);
  lines.push(
    '',
    `theme: ${theme}`,
    `secondary_themes: ${yamlList(secondaryThemes)}`,
    `tags: ${yamlList(tags)}`,
    '',
    'signals:',
    `  model_tested: ${yamlStr(signals.modelTested)}`,
    `  participants: ${yamlParticipants(signals.participants)}`,
    `  population: ${yamlStr(signals.population)}`,
    `  study_type: ${signals.studyType}`,
    `  task_setting: ${signals.taskSetting}`,
    '---',
    '',
    '## What they found',
    '',
    finding,
    '',
    '## Why it matters',
    '',
    whyItMatters,
    ''
  );

  return lines.join('\n');
}

export async function writeEntryFile(input, { dir = ENTRIES_DIR } = {}) {
  const slug = slugFor(input);
  const year = (input.published instanceof Date ? input.published : new Date(input.published)).getUTCFullYear();
  const fileName = `${year}-${slug}.md`;
  const filePath = path.join(dir, fileName);

  await mkdir(dir, { recursive: true });
  await writeFile(filePath, buildEntryMarkdown(input), 'utf8');

  return { fileName, filePath };
}

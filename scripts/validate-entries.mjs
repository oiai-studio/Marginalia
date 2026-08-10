#!/usr/bin/env node
// Fails the build (non-zero exit), never just warns, on anything
// CONTENT-MODEL.md marks as a hard constraint that Zod's frontmatter
// schema can't see: body word counts, the url link check, and duplicate
// arxiv_id/doi across the whole collection. Also re-checks required
// fields/enum membership independently of Zod as belt-and-suspenders,
// since this script runs standalone (no Astro build) for the pipeline
// and import scripts too.
//
// Aggregates every failure across every file before exiting, so a red
// build shows the whole picture at once instead of one file at a time.

import { readAllEntries } from './lib/entries.mjs';
import { parseSections, wordCount, fullStopCount } from './lib/prose.mjs';
import { checkUrls } from './lib/link-check.mjs';
import {
  THEME_SLUGS,
  STUDY_TYPES,
  TASK_SETTINGS,
  VENUE_TYPES,
  STATUSES,
  SOURCES,
  TAGS,
} from '../src/content/vocab.mjs';

const REQUIRED_FIELDS = [
  'title',
  'authors',
  'institutions',
  'published',
  'added',
  'status',
  'source',
  'venue',
  'venue_type',
  'url',
  'theme',
];

const ENUM_FIELDS = {
  status: STATUSES,
  source: SOURCES,
  venue_type: VENUE_TYPES,
  theme: THEME_SLUGS,
};

const MAX_FINDING_WORDS = 40;
const MAX_MATTERS_WORDS = 30;
const MAX_MATTERS_FULL_STOPS = 1;

const skipLinkCheck = process.env.SKIP_LINK_CHECK === '1';

function checkFrontmatter(data, errors) {
  for (const field of REQUIRED_FIELDS) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      errors.push(`missing required frontmatter field "${field}"`);
    }
  }

  for (const [field, allowed] of Object.entries(ENUM_FIELDS)) {
    if (data[field] !== undefined && !allowed.includes(data[field])) {
      errors.push(`frontmatter field "${field}" has unrecognised value "${data[field]}"`);
    }
  }

  if (Array.isArray(data.secondary_themes)) {
    for (const theme of data.secondary_themes) {
      if (!THEME_SLUGS.includes(theme)) {
        errors.push(`frontmatter field "secondary_themes" has unrecognised value "${theme}"`);
      }
    }
  }

  if (Array.isArray(data.tags)) {
    for (const tag of data.tags) {
      if (!TAGS.includes(tag)) {
        errors.push(`frontmatter field "tags" has unrecognised value "${tag}"`);
      }
    }
  }

  const signals = data.signals ?? {};
  if (signals.study_type !== undefined && !STUDY_TYPES.includes(signals.study_type)) {
    errors.push(`frontmatter field "signals.study_type" has unrecognised value "${signals.study_type}"`);
  }
  if (signals.task_setting !== undefined && !TASK_SETTINGS.includes(signals.task_setting)) {
    errors.push(`frontmatter field "signals.task_setting" has unrecognised value "${signals.task_setting}"`);
  }
}

function checkBody(content, errors) {
  const { sections, errors: sectionErrors } = parseSections(content);
  errors.push(...sectionErrors);

  const finding = sections['What they found'];
  if (finding !== undefined) {
    const count = wordCount(finding);
    if (count > MAX_FINDING_WORDS) {
      errors.push(`"## What they found" is ${count} words, over the ${MAX_FINDING_WORDS}-word limit`);
    }
  }

  const matters = sections['Why it matters'];
  if (matters !== undefined && matters.length > 0) {
    const count = wordCount(matters);
    if (count > MAX_MATTERS_WORDS) {
      errors.push(`"## Why it matters" is ${count} words, over the ${MAX_MATTERS_WORDS}-word limit`);
    }
    const stops = fullStopCount(matters);
    if (stops > MAX_MATTERS_FULL_STOPS) {
      errors.push(`"## Why it matters" has ${stops} full stops, over the ${MAX_MATTERS_FULL_STOPS}-sentence limit`);
    }
  }
}

async function main() {
  const entries = await readAllEntries();
  const fileErrors = new Map();

  const addError = (fileName, message) => {
    if (!fileErrors.has(fileName)) fileErrors.set(fileName, []);
    fileErrors.get(fileName).push(message);
  };

  const arxivIds = new Map();
  const dois = new Map();

  for (const { fileName, data, content } of entries) {
    const errors = [];
    checkFrontmatter(data, errors);
    checkBody(content, errors);
    for (const message of errors) addError(fileName, message);

    if (data.arxiv_id) {
      if (arxivIds.has(data.arxiv_id)) {
        addError(fileName, `duplicate arxiv_id "${data.arxiv_id}" (also in ${arxivIds.get(data.arxiv_id)})`);
      } else {
        arxivIds.set(data.arxiv_id, fileName);
      }
    }

    if (data.doi) {
      if (dois.has(data.doi)) {
        addError(fileName, `duplicate doi "${data.doi}" (also in ${dois.get(data.doi)})`);
      } else {
        dois.set(data.doi, fileName);
      }
    }
  }

  if (skipLinkCheck) {
    console.warn('SKIP_LINK_CHECK=1 — skipping the url 200 check (never skipped in CI).');
  } else {
    const urls = entries.map((e) => e.data.url).filter(Boolean);
    const results = await checkUrls(urls);
    for (const { fileName, data } of entries) {
      const result = data.url && results.get(data.url);
      if (result && !result.ok) {
        const reason = result.error ?? `HTTP ${result.status}`;
        addError(fileName, `url "${data.url}" did not resolve to 200 (${reason})`);
      }
    }
  }

  if (fileErrors.size === 0) {
    console.log(`validate-entries: ${entries.length} entries checked, all passed.`);
    return;
  }

  console.error(`validate-entries: ${fileErrors.size} of ${entries.length} entries failed.\n`);
  for (const [fileName, errors] of fileErrors) {
    console.error(fileName);
    for (const message of errors) console.error(`  - ${message}`);
  }
  process.exitCode = 1;
}

main().catch((err) => {
  console.error('validate-entries crashed:', err);
  process.exitCode = 1;
});

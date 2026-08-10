// Extraction step: builds PIPELINE.md's prompt, calls a model, and
// validates the JSON it returns. The model call is isolated behind
// `callModel` specifically so prompt-building and response-parsing stay
// testable with a fixture, independent of the real provider — see
// callDeepSeek below for the actual live call.

import {
  THEMES,
  THEME_SLUGS,
  STUDY_TYPES,
  TASK_SETTINGS,
  TAGS,
} from '../../src/content/vocab.mjs';

const closedList = (values) => values.map((v) => `"${v}"`).join(', ');

export function buildExtractionPrompt(fullText, meta = {}) {
  return `You are extracting appraisal signals from an academic paper for a reference
index. Return only JSON matching the schema below.

ABSOLUTE RULES

1. Extract only what the paper explicitly states. If a value is not stated,
   return the string "not reported". Never infer, estimate, approximate, or
   reason toward a value. "Not reported" is a correct and useful answer.
2. Never reproduce or lightly reword the abstract, or any sentence from the
   paper. Every word you write in the summary fields is your own phrasing of
   what the paper found.
3. Use only the closed vocabularies given. If nothing fits, return
   "needs-review" and explain in the notes field. Do not invent a value.
4. House style (see STYLE.md), applied to "finding" and "notes": British
   English, plain past tense, straight quotes. No em dashes. No "not just
   X, but Y" or "not X, but Y" constructions. No promotional or
   significance-puffery language (e.g. "cutting-edge", "robust",
   "seamlessly", "plays a pivotal role", "underscores the importance").
   No vague attribution ("researchers found" when the paper names who).
   Don't tack a vague "-ing" consequence onto the end of a sentence after
   a comma; if the consequence has real evidence, write it as its own
   sentence instead.

FIELDS

institutions    Author affiliations exactly as printed on the paper's title
                page or author block, comma-separated for more than one.
                Never infer from an author's name, email domain, or outside
                knowledge of who they are — only from what this paper
                itself states. "not reported" if the paper states none.
model_tested    Exact model names and versions evaluated, as written in the
                paper. If it says "a large language model" with no name,
                that is "not reported".
participants    Integer count of human participants. "n/a" if no human study.
population      Who they were, in five words or fewer, as the paper describes
                them. Not your characterisation.
study_type      One of: [${closedList(STUDY_TYPES)}]
task_setting    One of: [${closedList(TASK_SETTINGS)}]
theme           One of: [${closedList(THEME_SLUGS)}]
secondary_themes  Zero to two from the same list.
tags            From the closed tag list only: [${closedList(TAGS)}].
                Anything outside it goes in proposed_tags instead.
finding         What they found, 40 words maximum, your own words.
notes           Anything a reader would want flagged: a tiny sample, a
                self-report-only measure, an unreleased system. One sentence
                or empty.

PAPER METADATA
title: ${meta.title ?? 'unknown'}
venue: ${meta.venue ?? 'unknown'}

PAPER FULL TEXT
${fullText}`;
}

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
// deepseek-chat (V3.2, non-reasoning) is the right tier for rule-following
// structured extraction — deepseek-reasoner is slower/costlier and buys
// nothing here. Override via DEEPSEEK_MODEL if that judgment changes.
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

/**
 * Live call to DeepSeek's chat completions API (OpenAI-compatible), used
 * as extractSignals' default callModel. Reads DEEPSEEK_API_KEY from the
 * environment — export it locally for a manual run, or set it as a
 * GitHub Actions secret for ingest.yml. Never hold the key in a file
 * this repo commits.
 */
export async function callDeepSeek(prompt) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error(
      'DEEPSEEK_API_KEY is not set. Export it in your shell for a local run, ' +
        'or add it as a GitHub Actions secret (see ingest.yml) for the real pipeline.'
    );
  }

  const res = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      // Deterministic extraction, not creative writing.
      temperature: 0,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`DeepSeek API request failed: ${res.status} ${res.statusText} ${body}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('DeepSeek API response had no message content');
  }
  return content;
}

const REQUIRED_KEYS = [
  'institutions',
  'model_tested',
  'participants',
  'population',
  'study_type',
  'task_setting',
  'theme',
  'secondary_themes',
  'tags',
  'finding',
  'notes',
];

/**
 * Validates a parsed extraction response against the closed vocabularies.
 * Returns { ok: true, data } or { ok: false, errors }. Tags outside the
 * closed list are moved to `proposedTags` rather than rejected outright —
 * CONTENT-MODEL.md: "An extraction that wants a tag outside this list
 * flags it in the PR for Rob to accept or reject. It does not add it."
 */
export function validateExtraction(raw) {
  const errors = [];
  for (const key of REQUIRED_KEYS) {
    if (!(key in raw)) errors.push(`missing field "${key}"`);
  }
  if (errors.length) return { ok: false, errors };

  if (!STUDY_TYPES.includes(raw.study_type) && raw.study_type !== 'needs-review') {
    errors.push(`unrecognised study_type "${raw.study_type}"`);
  }
  if (!TASK_SETTINGS.includes(raw.task_setting) && raw.task_setting !== 'needs-review') {
    errors.push(`unrecognised task_setting "${raw.task_setting}"`);
  }
  if (!THEME_SLUGS.includes(raw.theme) && raw.theme !== 'needs-review') {
    errors.push(`unrecognised theme "${raw.theme}"`);
  }
  for (const t of raw.secondary_themes ?? []) {
    if (!THEME_SLUGS.includes(t)) errors.push(`unrecognised secondary_theme "${t}"`);
  }

  if (errors.length) return { ok: false, errors };

  const tags = [];
  const proposedTags = [];
  for (const tag of raw.tags ?? []) {
    (TAGS.includes(tag) ? tags : proposedTags).push(tag);
  }

  return {
    ok: true,
    data: {
      institutions: raw.institutions,
      model_tested: raw.model_tested,
      participants: raw.participants,
      population: raw.population,
      study_type: raw.study_type,
      task_setting: raw.task_setting,
      theme: raw.theme,
      secondary_themes: raw.secondary_themes ?? [],
      tags,
      proposedTags,
      finding: raw.finding,
      notes: raw.notes ?? '',
    },
  };
}

/**
 * Runs the full extraction step: build prompt, call the model, parse and
 * validate its JSON response. `callModel` is injectable so callers (and
 * tests) can supply a fixture response without a real provider.
 */
export async function extractSignals(fullText, meta, { callModel = callDeepSeek } = {}) {
  const prompt = buildExtractionPrompt(fullText, meta);
  const responseText = await callModel(prompt);

  let raw;
  try {
    raw = JSON.parse(responseText);
  } catch (err) {
    return { ok: false, errors: [`model response was not valid JSON: ${err.message}`] };
  }

  return validateExtraction(raw);
}

import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'zod';
import {
  THEME_SLUGS,
  STUDY_TYPES,
  TASK_SETTINGS,
  VENUE_TYPES,
  STATUSES,
  SOURCES,
  TAGS,
} from './content/vocab.mjs';

// Zod requires a non-empty tuple for z.enum; the vocab arrays are the
// runtime source of truth (see vocab.mjs), this cast just satisfies the
// tuple shape zod's types want.
const themeEnum = z.enum(THEME_SLUGS as [string, ...string[]]);
const studyTypeEnum = z.enum(STUDY_TYPES as [string, ...string[]]);
const taskSettingEnum = z.enum(TASK_SETTINGS as [string, ...string[]]);
const venueTypeEnum = z.enum(VENUE_TYPES as [string, ...string[]]);
const statusEnum = z.enum(STATUSES as [string, ...string[]]);
const sourceEnum = z.enum(SOURCES as [string, ...string[]]);
const tagEnum = z.enum(TAGS as [string, ...string[]]);

// participants is an integer, "not reported", or "n/a" per CONTENT-MODEL.md
// — never a fuzzy quantity like "a small group".
const participantsSchema = z.union([
  z.number().int(),
  z.literal('not reported'),
  z.literal('n/a'),
]);

const entrySchema = z
  .object({
    title: z.string(),
    authors: z.string(),
    institutions: z.string(),
    published: z.coerce.date(),
    added: z.coerce.date(),
    status: statusEnum,
    source: sourceEnum,

    venue: z.string(),
    venue_type: venueTypeEnum,
    url: z.url(),
    arxiv_id: z.string().optional(),
    doi: z.string().optional(),

    theme: themeEnum,
    secondary_themes: z.array(themeEnum).max(2).default([]),
    tags: z.array(tagEnum).default([]),

    signals: z.object({
      model_tested: z.string(),
      participants: participantsSchema,
      population: z.string(),
      study_type: studyTypeEnum,
      task_setting: taskSettingEnum,
    }),
  })
  // CONTENT-MODEL.md: a paper appears under its primary theme only, and
  // secondary themes affect filtering — an entry listing its own primary
  // theme again as "secondary" is a contradiction, not a valid straddle.
  .refine((entry) => !entry.secondary_themes.includes(entry.theme), {
    message: 'secondary_themes must not repeat the primary theme',
    path: ['secondary_themes'],
  });

const entries = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/entries' }),
  schema: entrySchema,
});

export const collections = { entries };

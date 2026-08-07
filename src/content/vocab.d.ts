// Type declarations for vocab.mjs, kept alongside it so config.ts (and any
// other TS consumer) gets real types without duplicating the vocab data
// itself. vocab.mjs remains the single source of truth for the values.

export interface Theme {
  slug: string;
  label: string;
}

export const THEMES: Theme[];
export const THEME_SLUGS: string[];
export const STUDY_TYPES: string[];
export const TASK_SETTINGS: string[];
export const VENUE_TYPES: string[];
export const STATUSES: string[];
export const SOURCES: string[];
export const TAGS: string[];

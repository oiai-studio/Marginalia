// Single source of truth for every closed vocabulary in CONTENT-MODEL.md.
// Plain JS (not .ts) so both src/content/config.ts (Astro/Zod) and the
// plain-Node scripts under scripts/ can import it with no build step and
// no risk of the two lists drifting apart.

// Order matters here: it is the display order on the homepage checklist,
// not alphabetical. Each theme's label is the question it answers.
export const THEMES = [
  { slug: 'collaboration', label: 'How do we collaborate with intelligence?' },
  { slug: 'supervision', label: 'How do we supervise intelligence?' },
  { slug: 'relationships', label: 'How do we build relationships with intelligence?' },
  { slug: 'interaction', label: 'How do we interact with intelligence?' },
  { slug: 'design-practice', label: 'How do we design using intelligence?' },
];

export const THEME_SLUGS = THEMES.map((t) => t.slug);

export const STUDY_TYPES = [
  'controlled-experiment',
  'field-deployment',
  'interview-study',
  'survey',
  'diary-study',
  'wizard-of-oz',
  'system-paper-no-eval',
  'literature-review',
  'benchmark-or-dataset',
  'position-paper',
];

export const TASK_SETTINGS = [
  'lab-synthetic',
  'lab-realistic',
  'field-real-work',
  'simulated-no-humans',
  'n/a',
];

export const VENUE_TYPES = ['preprint', 'peer-reviewed'];

export const STATUSES = ['queued', 'published'];

export const SOURCES = ['pipeline', 'backlog', 'manual'];

// Tags are design situations, not topics — kept closed and short on
// purpose. Adding one is a deliberate editorial act, not something the
// extraction pipeline does on its own (see PIPELINE.md).
export const TAGS = [
  'handoff',
  'error-recovery',
  'uncertainty',
  'delegation',
  'undo-and-repair',
  'onboarding',
  'trust-calibration',
  'over-reliance',
  'steering-and-control',
  'explanation',
  'memory-and-context',
  'multi-agent',
  'evaluation-methods',
  'creative-work',
  'expert-workflows',
];

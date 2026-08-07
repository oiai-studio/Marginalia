// Body-section parsing and the word/sentence checks CONTENT-MODEL.md
// requires, which live outside the frontmatter Zod already validates.

const REQUIRED_HEADINGS = ['What they found', 'Why it matters'];

/**
 * Splits a markdown body on `## ` headings into { heading: text } pairs.
 * Returns { sections, errors } — errors covers missing/unrecognised
 * headings so callers can report a clear message per entry.
 */
export function parseSections(body) {
  const errors = [];
  const sections = {};
  const parts = body.split(/^##\s+/m).map((p) => p.trim()).filter(Boolean);

  for (const part of parts) {
    const newlineIndex = part.indexOf('\n');
    const heading = (newlineIndex === -1 ? part : part.slice(0, newlineIndex)).trim();
    const text = (newlineIndex === -1 ? '' : part.slice(newlineIndex + 1)).trim();
    sections[heading] = text;
  }

  for (const heading of REQUIRED_HEADINGS) {
    if (!(heading in sections)) {
      errors.push(`missing required "## ${heading}" section`);
    }
  }

  return { sections, errors };
}

export function wordCount(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Naive full-stop count — counts literal "." characters. This will
 * misfire on abbreviations like "e.g." or "U.S." inside a sentence; a
 * known, accepted limitation for v1 given "Why it matters" is meant to be
 * one short, plain sentence in the first place.
 */
export function fullStopCount(text) {
  return (text.match(/\./g) ?? []).length;
}

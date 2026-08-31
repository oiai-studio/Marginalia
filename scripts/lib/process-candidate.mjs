// Shared "fetch full text -> extract -> write entry" path for a single
// candidate paper, used by both scripts/pipeline/run.mjs (new arXiv/
// Crossref candidates and popped backlog rows) and scripts/import/
// seed-queue.mjs (Rob's fast-tracked backlog picks) — one code path,
// not two copies that could drift.

import pdfParse from 'pdf-parse';
import { fetchFullText as fetchArxivFullText } from './fetch-arxiv.mjs';
import { extractSignals } from './extract.mjs';
import { writeEntryFile } from './write-entries.mjs';

export async function fetchCandidateFullText(candidate) {
  if (candidate.source === 'arxiv') {
    const result = await fetchArxivFullText(candidate.arxivId);
    if (result.kind === 'html') return result.html;
    const res = await fetch(result.pdfUrl);
    if (!res.ok) throw new Error(`pdf fetch failed: ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const parsed = await pdfParse(buffer);
    return parsed.text;
  }

  // Crossref/DOI: best-effort HTML fetch of the resolved landing page.
  const res = await fetch(candidate.url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`full text fetch failed: ${res.status}`);
  return res.text();
}

/**
 * Runs a candidate through fetch -> extract -> write, tagging the written
 * entry with `source` ("pipeline" or "backlog"). Returns
 * { ok: true, candidate, fileName, extraction } or
 * { ok: false, candidate, errors }.
 *
 * `status` is a parameter rather than a constant because seed-queue.mjs
 * shares this path — hardcoding it here would change the manual import's
 * behaviour as a side effect of changing the weekly pipeline's.
 */
export async function processCandidate(candidate, source, { status = 'published' } = {}) {
  const fullText = await fetchCandidateFullText(candidate);
  const extraction = await extractSignals(fullText, { title: candidate.title, venue: candidate.venue });

  if (!extraction.ok) {
    return { ok: false, candidate, errors: extraction.errors };
  }

  const { fileName } = await writeEntryFile({
    title: candidate.title,
    authors: candidate.authors ?? 'not reported',
    institutions: extraction.data.institutions,
    published: candidate.published ?? new Date(),
    status,
    source,
    venue: candidate.venue,
    venueType: candidate.venueType,
    url: candidate.url,
    arxivId: candidate.arxivId,
    doi: candidate.doi,
    theme: extraction.data.theme,
    secondaryThemes: extraction.data.secondary_themes,
    tags: extraction.data.tags,
    signals: {
      modelTested: extraction.data.model_tested,
      participants: extraction.data.participants,
      population: extraction.data.population,
      studyType: extraction.data.study_type,
      taskSetting: extraction.data.task_setting,
    },
    finding: extraction.data.finding,
  });

  return { ok: true, candidate, fileName, extraction: extraction.data };
}

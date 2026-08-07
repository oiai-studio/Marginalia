// Single-row resolver for one backlog CSV row, per IMPORT.md's four
// steps. Kept separate from resolve-backlog.mjs's orchestration so it's
// unit-testable on its own.

import stringSimilarity from 'string-similarity';
import { looksLikeArxivId, getById as getArxivById, searchByTitle as searchArxivByTitle } from '../lib/fetch-arxiv.mjs';
import { looksLikeDoi, getByDoi, searchByTitle as searchCrossrefByTitle } from '../lib/fetch-crossref.mjs';

const MATCH_THRESHOLD = 0.85;
const AMBIGUITY_MARGIN = 0.05;

function titleScore(a, b) {
  if (!a || !b) return 0;
  return stringSimilarity.compareTwoStrings(a.toLowerCase(), b.toLowerCase());
}

function toCandidate(type, hit) {
  if (!hit) return null;
  if (type === 'arxiv') {
    return { type: 'arxiv', id: hit.arxivId, title: hit.title, published: hit.published, url: hit.absUrl };
  }
  return { type: 'doi', id: hit.doi, title: hit.title, published: hit.published, url: hit.url };
}

function pickBest(candidates, csvTitle) {
  const scored = candidates
    .filter(Boolean)
    .map((c) => ({ candidate: c, score: titleScore(c.title, csvTitle) }))
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return { status: 'unresolved', candidates: [] };

  const [best, second] = scored;
  if (best.score < MATCH_THRESHOLD) {
    return { status: 'unresolved', candidates: scored.map((s) => ({ ...s.candidate, score: s.score })) };
  }

  const strongCount = scored.filter((s) => s.score >= MATCH_THRESHOLD).length;
  const ambiguous = strongCount > 1 || (second && best.score - second.score < AMBIGUITY_MARGIN);
  if (ambiguous) {
    return { status: 'unresolved', candidates: scored.map((s) => ({ ...s.candidate, score: s.score })) };
  }

  return { status: 'resolved', resolved: best.candidate, score: best.score };
}

/**
 * Resolves one { identifier, title, date_found } row.
 * Returns { status: 'resolved', resolved, score } or
 * { status: 'unresolved', candidates }.
 */
export async function resolveRow(row) {
  const identifier = (row.identifier ?? '').trim();
  const csvTitle = row.title ?? '';

  // Step 1: direct lookup by identifier shape.
  if (identifier && looksLikeArxivId(identifier)) {
    const hit = await getArxivById(identifier);
    const candidate = toCandidate('arxiv', hit);
    if (candidate && titleScore(candidate.title, csvTitle) >= MATCH_THRESHOLD) {
      return { status: 'resolved', resolved: candidate, score: titleScore(candidate.title, csvTitle) };
    }
  } else if (identifier && looksLikeDoi(identifier)) {
    const hit = await getByDoi(identifier);
    const candidate = toCandidate('doi', hit);
    if (candidate && titleScore(candidate.title, csvTitle) >= MATCH_THRESHOLD) {
      return { status: 'resolved', resolved: candidate, score: titleScore(candidate.title, csvTitle) };
    }
  }

  // Step 3: title-search fallback against both arXiv and Crossref.
  if (!csvTitle) return { status: 'unresolved', candidates: [] };

  const [arxivHits, crossrefHits] = await Promise.all([
    searchArxivByTitle(csvTitle).catch(() => []),
    searchCrossrefByTitle(csvTitle).catch(() => []),
  ]);

  const candidates = [
    ...arxivHits.map((h) => toCandidate('arxiv', h)),
    ...crossrefHits.map((h) => toCandidate('doi', h)),
  ];

  return pickBest(candidates, csvTitle);
}

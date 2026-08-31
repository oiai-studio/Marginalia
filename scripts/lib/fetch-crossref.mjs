// Thin client for the Crossref REST API, used for CHI/IUI (and any other
// DOI-bearing) papers per PIPELINE.md's source table. The ACM Digital
// Library went fully open access in January 2026, so the DOI resolves to
// a fetchable full text rather than a paywall.

const CROSSREF_API = 'https://api.crossref.org/works';
// Crossref's "polite pool" gets faster, more reliable service for
// requests that identify themselves with a mailto contact.
const USER_AGENT = 'Marginalia/0.1 (https://github.com/oiai-studio/Marginalia; mailto:rob.boyett@gmail.com)';

async function request(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Crossref request failed: ${res.status} ${res.statusText}`);
  return res.json();
}

/** Crossref stores abstracts as JATS XML when a publisher deposits one at
 * all — many do not. Strip the tags for the judge; absence is normal and
 * handled by the caller, not an error. */
function plainAbstract(abstract) {
  if (!abstract) return null;
  return abstract
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim() || null;
}

function normalize(work) {
  if (!work) return null;
  const dateParts = work.published?.['date-parts']?.[0] ?? work['published-print']?.['date-parts']?.[0];
  const published = dateParts ? dateParts.join('-') : null;
  const authors = (work.author ?? [])
    .map((a) => [a.given, a.family].filter(Boolean).join(' '))
    .filter(Boolean);

  return {
    doi: work.DOI,
    title: Array.isArray(work.title) ? work.title[0] : work.title,
    authors,
    abstract: plainAbstract(work.abstract),
    published,
    containerTitle: Array.isArray(work['container-title']) ? work['container-title'][0] : work['container-title'],
    url: work.URL ?? (work.DOI ? `https://doi.org/${work.DOI}` : null),
  };
}

export async function getByDoi(doi) {
  try {
    const data = await request(`${CROSSREF_API}/${encodeURIComponent(doi)}`);
    return normalize(data.message);
  } catch (err) {
    if (String(err.message).includes('404')) return null;
    throw err;
  }
}

export async function searchByTitle(title, { containerTitle, rows = 5 } = {}) {
  const url = new URL(CROSSREF_API);
  url.searchParams.set('query.bibliographic', title);
  if (containerTitle) url.searchParams.set('query.container-title', containerTitle);
  url.searchParams.set('rows', String(rows));

  const data = await request(url);
  return (data.message?.items ?? []).map(normalize);
}

/**
 * Recent works from a venue (e.g. "CHI Conference on Human Factors in
 * Computing Systems"), for the weekly pipeline's HCI-venue sources.
 *
 * Deliberately does NOT set `sort=published`. Verified live (2026-08-10):
 * combining `query.container-title` with `sort=published&order=desc`
 * silently discards Crossref's relevance ranking — a query for
 * "Intelligent User Interfaces" returned "Weave: Journal of Library User
 * Experience" as the top result once date-sorted, instead of the actual
 * IUI proceedings that the same query returns correctly unsorted. Rely
 * on Crossref's default relevance sort plus the date filter instead;
 * callers should still pattern-match the returned `containerTitle`
 * before trusting a result (see run.mjs's CROSSREF_VENUES).
 *
 * `rows` defaults generously (100) because most of these venues publish
 * in annual bursts, not continuously — genuine matches are sparse most
 * weeks (verified: 0/100 across every configured venue in a real 8-day
 * window right now, correctly, since none of them are near their
 * conference dates), so a narrow row count would miss a real burst when
 * one is actually in-window.
 */
export async function queryContainer(containerTitle, { sinceDate, rows = 100 } = {}) {
  const url = new URL(CROSSREF_API);
  url.searchParams.set('query.container-title', containerTitle);
  url.searchParams.set('rows', String(rows));
  if (sinceDate) {
    url.searchParams.set('filter', `from-pub-date:${sinceDate.toISOString().slice(0, 10)}`);
  }

  const data = await request(url);
  return (data.message?.items ?? []).map(normalize);
}

export function looksLikeDoi(identifier) {
  return /^10\.\d{4,9}\/\S+$/.test(identifier.trim());
}

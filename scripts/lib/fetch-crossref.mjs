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
 * Computing Systems"), for the weekly pipeline's CHI/IUI source.
 */
export async function queryContainer(containerTitle, { sinceDate, rows = 50 } = {}) {
  const url = new URL(CROSSREF_API);
  url.searchParams.set('query.container-title', containerTitle);
  url.searchParams.set('sort', 'published');
  url.searchParams.set('order', 'desc');
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

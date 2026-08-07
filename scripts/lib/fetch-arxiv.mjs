// Thin client for the arXiv API (export.arxiv.org/api/query, Atom feed).
// No XML dependency: arXiv's Atom feed has a small, stable, well-known
// shape, so a couple of targeted regexes are simpler to maintain here
// than pulling in a general XML parser for one field set.

const ARXIV_API = 'https://export.arxiv.org/api/query';
const USER_AGENT = 'Marginalia/0.1 (https://github.com/oiai-studio/Marginalia; weekly HCI/AI paper index; mailto:rob.boyett@gmail.com)';

// arXiv asks for one request every three seconds (PIPELINE.md). Enforced
// with a simple module-level throttle rather than a queue library.
let lastRequestAt = 0;
const MIN_INTERVAL_MS = 3100;

async function throttle() {
  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequestAt = Date.now();
}

function decodeEntities(str) {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

function extractTag(block, tag) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return match ? decodeEntities(match[1]) : null;
}

function extractAttr(block, tag, attr) {
  const match = block.match(new RegExp(`<${tag}[^>]*\\s${attr}="([^"]*)"[^>]*/?>`));
  return match ? decodeEntities(match[1]) : null;
}

function extractAll(block, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'g');
  const out = [];
  let m;
  while ((m = re.exec(block))) out.push(decodeEntities(m[1]));
  return out;
}

function idFromArxivUrl(url) {
  // e.g. http://arxiv.org/abs/2603.12345v2 -> 2603.12345
  const match = url?.match(/abs\/([\w.\-/]+?)(v\d+)?$/);
  return match ? match[1] : null;
}

function parseEntry(block) {
  const rawId = extractTag(block, 'id');
  const authorBlocks = extractAll(block, 'author');
  const authors = authorBlocks
    .map((a) => extractTag(a, 'name'))
    .filter(Boolean);

  const linkBlock = block.match(/<link[^>]*title="pdf"[^>]*>/);

  return {
    arxivId: idFromArxivUrl(rawId),
    title: extractTag(block, 'title')?.replace(/\s+/g, ' ').trim(),
    summary: extractTag(block, 'summary')?.replace(/\s+/g, ' ').trim(),
    published: extractTag(block, 'published'),
    updated: extractTag(block, 'updated'),
    authors,
    absUrl: rawId,
    pdfUrl: linkBlock ? extractAttr(linkBlock[0], 'link', 'href') ?? linkBlock[0].match(/href="([^"]*)"/)?.[1] : null,
    categories: extractAll(block, 'category').length
      ? Array.from(block.matchAll(/<category[^>]*term="([^"]*)"/g)).map((m) => m[1])
      : [],
  };
}

async function rawQuery(params) {
  await throttle();
  const url = new URL(ARXIV_API);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`arXiv API request failed: ${res.status} ${res.statusText}`);
  const xml = await res.text();

  const entryBlocks = Array.from(xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)).map((m) => m[1]);
  return entryBlocks.map(parseEntry);
}

/**
 * Queries a category over a recent window with a keyword OR-filter across
 * title/abstract, per PIPELINE.md step 1. Over-collects on purpose —
 * filtering happens client-side against `sinceDate` and the caller's own
 * judgment, not a tight server-side query.
 */
export async function queryCategory(category, { sinceDate, keywords = [], maxResults = 100 } = {}) {
  const keywordClause = keywords.length
    ? ' AND (' + keywords.map((k) => `abs:"${k}" OR ti:"${k}"`).join(' OR ') + ')'
    : '';
  const searchQuery = `cat:${category}${keywordClause}`;

  const entries = await rawQuery({
    search_query: searchQuery,
    sortBy: 'submittedDate',
    sortOrder: 'descending',
    max_results: String(maxResults),
  });

  if (!sinceDate) return entries;
  return entries.filter((e) => e.published && new Date(e.published) >= sinceDate);
}

export async function getById(arxivId) {
  const entries = await rawQuery({ id_list: arxivId, max_results: '1' });
  return entries[0] ?? null;
}

export async function searchByTitle(title, { maxResults = 5 } = {}) {
  return rawQuery({
    search_query: `ti:"${title}"`,
    max_results: String(maxResults),
  });
}

/**
 * Full text: arXiv renders HTML for most recent submissions at
 * arxiv.org/html/<id>; falls back to the PDF url for pdf-parse to handle
 * (see extract.mjs), per PIPELINE.md step 3.
 */
export async function fetchFullText(arxivId) {
  await throttle();
  const htmlUrl = `https://arxiv.org/html/${arxivId}`;
  const res = await fetch(htmlUrl, { headers: { 'User-Agent': USER_AGENT } });
  if (res.ok) {
    const html = await res.text();
    return { kind: 'html', html, sourceUrl: htmlUrl };
  }
  return { kind: 'pdf', pdfUrl: `https://arxiv.org/pdf/${arxivId}.pdf` };
}

export function looksLikeArxivId(identifier) {
  return /^\d{4}\.\d{4,5}(v\d+)?$/.test(identifier.trim());
}

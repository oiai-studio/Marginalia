// Live URL check for CONTENT-MODEL.md's "a url that does not resolve to a
// 200 on a link check" build-time rule. Kept out of Zod deliberately —
// an async network call inside schema parsing would re-fetch every URL
// on every file touch in `astro dev`, which is a bad trade for dev speed.

const TIMEOUT_MS = 10_000;
const CONCURRENCY = 5;

async function checkOne(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal });
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal });
    }
    return { url, ok: res.status === 200, status: res.status };
  } catch (err) {
    return { url, ok: false, status: null, error: err.message };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Checks a list of URLs with a small concurrency cap.
 * Returns a Map<url, { ok, status, error? }>.
 */
export async function checkUrls(urls) {
  const results = new Map();
  const queue = [...new Set(urls)];

  async function worker() {
    while (queue.length > 0) {
      const url = queue.shift();
      results.set(url, await checkOne(url));
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
  return results;
}

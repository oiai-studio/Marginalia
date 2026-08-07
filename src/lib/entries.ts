import { getCollection, type CollectionEntry } from 'astro:content';

export type Entry = CollectionEntry<'entries'>;

/** Published entries, sorted by the paper's own publication date, newest
 * first — never by `added`, which CONTENT-MODEL.md/DESIGN.md say is stored
 * but never shown. */
export async function getPublishedEntries(): Promise<Entry[]> {
  const all = await getCollection('entries', ({ data }) => data.status === 'published');
  return all.sort((a, b) => b.data.published.getTime() - a.data.published.getTime());
}

/** Entries whose primary theme matches — the homepage feed listing, which
 * shows each paper once under its primary theme only. */
export function byPrimaryTheme(entries: Entry[], theme: string): Entry[] {
  return entries.filter((entry) => entry.data.theme === theme);
}

/** Entries matching a theme route: primary OR secondary. CONTENT-MODEL.md:
 * "Secondary themes affect filtering, not placement" — the route widens,
 * the homepage feed itself stays primary-only (see byPrimaryTheme). */
export function byThemeRoute(entries: Entry[], theme: string): Entry[] {
  return entries.filter(
    (entry) => entry.data.theme === theme || entry.data.secondary_themes.includes(theme)
  );
}

export function byTag(entries: Entry[], tag: string): Entry[] {
  return entries.filter((entry) => entry.data.tags.includes(tag));
}

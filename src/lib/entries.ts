import { getCollection, type CollectionEntry } from 'astro:content';

export type Entry = CollectionEntry<'entries'>;

/** Published entries, sorted by the paper's own publication date, newest
 * first — never by `added`, which CONTENT-MODEL.md/DESIGN.md say is stored
 * but never shown. */
export async function getPublishedEntries(): Promise<Entry[]> {
  const all = await getCollection('entries', ({ data }) => data.status === 'published');
  return all.sort((a, b) => b.data.published.getTime() - a.data.published.getTime());
}

/** Entries matching a theme route: primary OR secondary. CONTENT-MODEL.md:
 * "Secondary themes affect filtering, not placement" — a paper still
 * appears in the homepage feed once, under its primary theme only, but
 * this widened set is used both for the theme route's listing and for
 * the homepage checklist's count, so the number shown always matches
 * what clicking through actually lists. */
export function byThemeRoute(entries: Entry[], theme: string): Entry[] {
  return entries.filter(
    (entry) => entry.data.theme === theme || entry.data.secondary_themes.includes(theme)
  );
}

export function byTag(entries: Entry[], tag: string): Entry[] {
  return entries.filter((entry) => entry.data.tags.includes(tag));
}

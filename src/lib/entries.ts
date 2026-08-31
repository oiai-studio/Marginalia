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

export interface MonthGroup {
  /** "2026-08" — stable key for the list, never rendered. */
  key: string;
  /** "August 2026". Sentence case here; `.chrome` uppercases it in CSS. */
  label: string;
  entries: Entry[];
}

/** Splits an already-sorted list into runs of the same publication month,
 * so the feed can print a break above each one. Assumes the input is in
 * the order it should render — getPublishedEntries sorts newest-first and
 * byThemeRoute/byTag only filter — so this walks the list and starts a
 * group when the month changes, rather than bucketing and re-sorting.
 *
 * Dates are read in UTC to match EntryCard's `toISOString()` rendering.
 * With local-time getters a paper dated 2026-08-01 would print
 * "2026-08-01" while grouping under July for anyone west of UTC. */
export function groupByMonth(entries: Entry[]): MonthGroup[] {
  const groups: MonthGroup[] = [];

  for (const entry of entries) {
    const published = entry.data.published;
    const key = `${published.getUTCFullYear()}-${String(published.getUTCMonth() + 1).padStart(2, '0')}`;
    const current = groups[groups.length - 1];

    if (current?.key === key) {
      current.entries.push(entry);
      continue;
    }

    groups.push({
      key,
      label: published.toLocaleString('en-GB', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }),
      entries: [entry],
    });
  }

  return groups;
}

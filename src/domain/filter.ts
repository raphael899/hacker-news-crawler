import type { Entry } from './entry.ts';
import { countTitleWords } from './title.ts';

export const ENTRY_FILTERS = ['all', 'long', 'short'] as const;

export type EntryFilter = typeof ENTRY_FILTERS[number];

export function filterEntries(entries: readonly Entry[], filter: EntryFilter): readonly Entry[] {
  if (filter === 'all') return [...entries];

  const filtered = entries.filter((entry) => {
    const wordCount = countTitleWords(entry.title);
    return filter === 'long' ? wordCount > 5 : wordCount <= 5;
  });

  return filtered.sort((first, second) => {
    const metricDifference = filter === 'long'
      ? second.comments - first.comments
      : second.points - first.points;
    return metricDifference || first.rank - second.rank;
  });
}

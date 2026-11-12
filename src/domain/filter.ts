import type { Entry } from './entry.ts';
import { countTitleWords } from './title.ts';

export const ENTRY_FILTERS = ['all', 'long', 'short'] as const;

export type EntryFilter = typeof ENTRY_FILTERS[number];

interface FilterStrategy {
  readonly includes: (entry: Entry) => boolean;
  readonly rankBy?: (entry: Entry) => number;
}

const MAX_SHORT_TITLE_WORDS = 5;

const filterStrategies = {
  all: { includes: () => true },
  long: {
    includes: ({ title }) => countTitleWords(title) > MAX_SHORT_TITLE_WORDS,
    rankBy: ({ comments }) => comments,
  },
  short: {
    includes: ({ title }) => countTitleWords(title) <= MAX_SHORT_TITLE_WORDS,
    rankBy: ({ points }) => points,
  },
} satisfies Record<EntryFilter, FilterStrategy>;

export function filterEntries(entries: readonly Entry[], filter: EntryFilter): readonly Entry[] {
  const { includes, rankBy }: FilterStrategy = filterStrategies[filter];
  const selected = entries.filter(includes);
  if (!rankBy) return selected;

  return selected.sort((first, second) =>
    rankBy(second) - rankBy(first) || first.rank - second.rank,
  );
}

import { describe, expect, it } from 'vitest';
import { filterEntries } from '../../src/domain/filter.ts';
import { makeEntries } from '../fixtures/entries.ts';

describe('filterEntries', () => {
  it('sorts long titles by comments descending and breaks ties by rank ascending', () => {
    const entries = makeEntries(30);
    entries[0] = { ...entries[0]!, title: 'one two three four five six', comments: 12 };
    entries[1] = { ...entries[1]!, title: 'one two three four five six', comments: 12 };
    entries[2] = { ...entries[2]!, title: 'one two three four five six', comments: 20 };

    expect(filterEntries(entries, 'long').map(({ rank }) => rank)).toEqual([3, 1, 2]);
  });

  it('sorts short titles by points descending and breaks ties by rank ascending', () => {
    const entries = makeEntries(30);
    entries[0] = { ...entries[0]!, title: 'one two three four five', points: 100 };
    entries[1] = { ...entries[1]!, title: 'one two three four five', points: 100 };
    entries[2] = { ...entries[2]!, title: 'one two three four five', points: 200 };

    expect(filterEntries(entries, 'short').map(({ rank }) => rank).slice(0, 3)).toEqual([3, 1, 2]);
  });

  it('partitions all 30 entries into disjoint long and short groups', () => {
    const entries = makeEntries(30);
    entries[0] = { ...entries[0]!, title: 'one two three four five six' };
    entries[1] = { ...entries[1]!, title: 'one two three four five' };
    const longRanks = filterEntries(entries, 'long').map(({ rank }) => rank);
    const shortRanks = filterEntries(entries, 'short').map(({ rank }) => rank);
    const combinedRanks = [...longRanks, ...shortRanks];

    expect(combinedRanks).toHaveLength(30);
    expect(new Set(combinedRanks).size).toBe(30);
    expect(combinedRanks.toSorted((first, second) => first - second))
      .toEqual(entries.map(({ rank }) => rank));
  });

  it('returns every entry without reordering for the all filter', () => {
    const entries = makeEntries(30);
    expect(filterEntries(entries, 'all')).toEqual(entries);
  });
});

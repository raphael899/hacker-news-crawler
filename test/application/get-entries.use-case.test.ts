import { describe, expect, it } from 'vitest';
import { GetEntriesUseCase } from '../../src/application/get-entries.use-case.ts';
import type { NewsSourcePort } from '../../src/application/ports/news-source.port.ts';
import { makeEntries } from '../fixtures/entries.ts';

describe('GetEntriesUseCase', () => {
  it('the application requests the first 30 entries through its port', async () => {
    const entries = makeEntries(30);
    let requestedLimit = 0;
    const source: NewsSourcePort = {
      async fetchTopEntries(limit) {
        requestedLimit = limit;
        return entries;
      },
    };
    expect(await new GetEntriesUseCase(source).execute()).toEqual(entries);
    expect(requestedLimit).toBe(30);
  });

  it('returns all entries in source order when the filter is omitted', async () => {
    const entries = makeEntries(30);
    const useCase = new GetEntriesUseCase({ async fetchTopEntries() { return entries; } });

    await expect(useCase.execute()).resolves.toEqual(entries);
  });

  it('applies the requested filter after validating the complete front page', async () => {
    const entries = makeEntries(30);
    entries[0] = { ...entries[0]!, title: 'one two three four five six', comments: 8, points: 20 };
    entries[1] = { ...entries[1]!, title: 'one two three four five', comments: 80, points: 20 };
    entries[2] = { ...entries[2]!, title: 'one two three four five six', comments: 8, points: 60 };
    const useCase = new GetEntriesUseCase({ async fetchTopEntries() { return entries; } });

    await expect(useCase.execute('long')).resolves.toEqual([entries[0], entries[2]]);
    await expect(useCase.execute('short')).resolves.toHaveLength(28);
  });
});

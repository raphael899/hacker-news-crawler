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
});

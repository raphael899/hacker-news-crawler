import { describe, expect, it } from 'vitest';
import { GetEntriesUseCase } from '../../src/application/get-entries.use-case.ts';
import type { NewsSourcePort } from '../../src/application/ports/news-source.port.ts';
import type { UsageRepositoryPort } from '../../src/application/ports/usage-repository.port.ts';
import { makeEntries } from '../fixtures/entries.ts';
import { InMemoryUsageRepository } from '../fixtures/in-memory-usage-repository.ts';

describe('GetEntriesUseCase', () => {
  it('the application requests the first 30 entries through its port', async () => {
    const entries = makeEntries(30);
    const usageRepository = new InMemoryUsageRepository();
    let requestedLimit = 0;
    const source: NewsSourcePort = {
      async fetchTopEntries(limit) {
        requestedLimit = limit;
        return entries;
      },
    };
    const requestedAt = '2026-11-12T15:00:00.000Z';
    expect(await new GetEntriesUseCase(source, usageRepository, () => new Date(requestedAt)).execute())
      .toEqual(entries);
    expect(requestedLimit).toBe(30);
    expect(usageRepository.records).toEqual([{ requestedAt, filter: 'all', resultCount: 30 }]);
  });

  it('returns all entries in source order when the filter is omitted', async () => {
    const entries = makeEntries(30);
    const useCase = new GetEntriesUseCase({ async fetchTopEntries() { return entries; } }, new InMemoryUsageRepository());

    await expect(useCase.execute()).resolves.toEqual(entries);
  });

  it('applies the requested filter after validating the complete front page', async () => {
    const entries = makeEntries(30);
    entries[0] = { ...entries[0]!, title: 'one two three four five six', comments: 8, points: 20 };
    entries[1] = { ...entries[1]!, title: 'one two three four five', comments: 80, points: 20 };
    entries[2] = { ...entries[2]!, title: 'one two three four five six', comments: 8, points: 60 };
    const usageRepository = new InMemoryUsageRepository();
    const useCase = new GetEntriesUseCase({ async fetchTopEntries() { return entries; } }, usageRepository);

    await expect(useCase.execute('long')).resolves.toEqual([entries[0], entries[2]]);
    await expect(useCase.execute('short')).resolves.toHaveLength(28);
    expect(usageRepository.records.map(({ filter, resultCount }) => ({ filter, resultCount })))
      .toEqual([{ filter: 'long', resultCount: 2 }, { filter: 'short', resultCount: 28 }]);
  });

  it('does not record a request when the fetched front page is invalid', async () => {
    const usageRepository = new InMemoryUsageRepository();
    const useCase = new GetEntriesUseCase({ async fetchTopEntries() { return makeEntries(29); } }, usageRepository);

    await expect(useCase.execute()).rejects.toThrow('Expected 30 front-page entries');
    expect(usageRepository.records).toEqual([]);
  });

  it('propagates usage storage failures to the HTTP adapter', async () => {
    const failingRepository: UsageRepositoryPort = {
      record() {
        throw new Error('disk is full');
      },
    };
    const useCase = new GetEntriesUseCase({ async fetchTopEntries() { return makeEntries(30); } }, failingRepository);

    await expect(useCase.execute()).rejects.toThrow('disk is full');
  });
});

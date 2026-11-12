import { describe, expect, it, vi } from 'vitest';
import { GetEntriesUseCase } from '../../../src/application/get-entries.use-case.ts';
import type { NewsSourcePort } from '../../../src/application/ports/news-source.port.ts';
import { buildApp } from '../../../src/infrastructure/http/app.ts';
import { InMemoryFrontPageCache } from '../../../src/infrastructure/cache/in-memory-front-page-cache.ts';
import { makeEntries } from '../../fixtures/entries.ts';
import { InMemoryUsageRepository } from '../../fixtures/in-memory-usage-repository.ts';
import { PassThroughFrontPageCache } from '../../fixtures/pass-through-front-page-cache.ts';

describe('HTTP app', () => {
  it.each([29, 31])('returns 502 when the source provides %i entries', async (count) => {
    const app = buildApp(new GetEntriesUseCase({
      async fetchTopEntries() {
        return makeEntries(count);
      },
    }, new PassThroughFrontPageCache(), new InMemoryUsageRepository()));

    try {
      const response = await app.inject('/entries');
      expect(response.statusCode).toBe(502);
      expect(response.json()).toEqual({
        error: { code: 'invalid_html', message: 'Hacker News returned an invalid front page.' },
      });
    } finally {
      await app.close();
    }
  });

  it('exposes the application through a validated HTTP adapter', async () => {
    const entries = makeEntries(30);
    entries[0] = { ...entries[0]!, title: 'one two three four five six', comments: 50 };
    entries[1] = { ...entries[1]!, points: 100 };
    const source: NewsSourcePort = { async fetchTopEntries() { return entries; } };
    const usageRepository = new InMemoryUsageRepository();
    const app = buildApp(new GetEntriesUseCase(source, new PassThroughFrontPageCache(), usageRepository));
    try {
      const allEntries = await app.inject('/entries');
      expect(allEntries.statusCode).toBe(200);
      expect(allEntries.json()).toHaveLength(30);
      expect(allEntries.headers['x-front-page-fetched-at']).toBe('2026-11-12T15:00:00.000Z');
      expect(allEntries.headers['x-cache-status']).toBe('miss');

      const longEntries = await app.inject('/entries?filter=long');
      expect(longEntries.statusCode).toBe(200);
      expect(longEntries.json()).toEqual([entries[0]]);

      const shortEntries = await app.inject('/entries?filter=short');
      expect(shortEntries.statusCode).toBe(200);
      expect(shortEntries.json()).toHaveLength(29);
      expect(shortEntries.json()[0].rank).toBe(2);
      expect(usageRepository.records.map(({ filter, resultCount, cacheStatus }) => ({ filter, resultCount, cacheStatus })))
        .toEqual([
          { filter: 'all', resultCount: 30, cacheStatus: 'miss' },
          { filter: 'long', resultCount: 1, cacheStatus: 'miss' },
          { filter: 'short', resultCount: 29, cacheStatus: 'miss' },
        ]);

      const invalidRequest = await app.inject('/entries?filter=unknown');
      expect(invalidRequest.statusCode).toBe(400);
      expect(invalidRequest.json()).toEqual({
        error: { code: 'invalid_request', message: 'Request validation failed.' },
      });
      expect(usageRepository.records).toHaveLength(3);
    } finally {
      await app.close();
    }
  });

  it('returns 500 if recording a valid request fails', async () => {
    const usageRepository = {
      record() {
        throw new Error('disk is full');
      },
    };
    const useCase = new GetEntriesUseCase(
      { async fetchTopEntries() { return makeEntries(30); } },
      new PassThroughFrontPageCache(),
      usageRepository,
    );
    const app = buildApp(useCase);

    try {
      const response = await app.inject('/entries?filter=short');
      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({
        error: { code: 'internal_error', message: 'An unexpected error occurred.' },
      });
    } finally {
      await app.close();
    }
  });

  it('coalesces concurrent requests and returns the same snapshot timestamp', async () => {
    let finishDownload: (() => void) | undefined;
    const downloadGate = new Promise<void>((resolve) => { finishDownload = resolve; });
    let downloadCount = 0;
    const source: NewsSourcePort = {
      async fetchTopEntries() {
        downloadCount += 1;
        await downloadGate;
        return makeEntries(30);
      },
    };
    const frontPageCache = new InMemoryFrontPageCache(
      60_000,
      () => 0,
      () => new Date('2026-11-12T15:00:00.000Z'),
    );
    const usageRepository = new InMemoryUsageRepository();
    const app = buildApp(new GetEntriesUseCase(source, frontPageCache, usageRepository));

    try {
      const firstRequest = app.inject('/entries?filter=long');
      const secondRequest = app.inject('/entries?filter=short');
      await vi.waitFor(() => expect(downloadCount).toBe(1));
      finishDownload?.();
      const [firstResponse, secondResponse] = await Promise.all([firstRequest, secondRequest]);

      expect(firstResponse.statusCode).toBe(200);
      expect(secondResponse.statusCode).toBe(200);
      expect(firstResponse.headers['x-front-page-fetched-at'])
        .toBe(secondResponse.headers['x-front-page-fetched-at']);
      expect([firstResponse.headers['x-cache-status'], secondResponse.headers['x-cache-status']])
        .toEqual(['miss', 'coalesced']);
      expect(downloadCount).toBe(1);
      expect(usageRepository.records.map(({ cacheStatus }) => cacheStatus).sort())
        .toEqual(['coalesced', 'miss']);
      expect(new Set(usageRepository.records.map(({ snapshotAt }) => snapshotAt)).size).toBe(1);
    } finally {
      finishDownload?.();
      await app.close();
    }
  });
});

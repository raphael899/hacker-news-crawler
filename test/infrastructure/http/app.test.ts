import { describe, expect, it } from 'vitest';
import { GetEntriesUseCase } from '../../../src/application/get-entries.use-case.ts';
import type { NewsSourcePort } from '../../../src/application/ports/news-source.port.ts';
import { buildApp } from '../../../src/infrastructure/http/app.ts';
import { makeEntries } from '../../fixtures/entries.ts';
import { InMemoryUsageRepository } from '../../fixtures/in-memory-usage-repository.ts';

describe('HTTP app', () => {
  it.each([29, 31])('returns 502 when the source provides %i entries', async (count) => {
    const app = buildApp(new GetEntriesUseCase({
      async fetchTopEntries() {
        return makeEntries(count);
      },
    }, new InMemoryUsageRepository()));

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
    const app = buildApp(new GetEntriesUseCase(source, usageRepository));
    try {
      const allEntries = await app.inject('/entries');
      expect(allEntries.statusCode).toBe(200);
      expect(allEntries.json()).toHaveLength(30);

      const longEntries = await app.inject('/entries?filter=long');
      expect(longEntries.statusCode).toBe(200);
      expect(longEntries.json()).toEqual([entries[0]]);

      const shortEntries = await app.inject('/entries?filter=short');
      expect(shortEntries.statusCode).toBe(200);
      expect(shortEntries.json()).toHaveLength(29);
      expect(shortEntries.json()[0].rank).toBe(2);
      expect(usageRepository.records.map(({ filter, resultCount }) => ({ filter, resultCount })))
        .toEqual([
          { filter: 'all', resultCount: 30 },
          { filter: 'long', resultCount: 1 },
          { filter: 'short', resultCount: 29 },
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
    const useCase = new GetEntriesUseCase({ async fetchTopEntries() { return makeEntries(30); } }, usageRepository);
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
});

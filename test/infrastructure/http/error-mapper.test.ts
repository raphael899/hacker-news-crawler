import { describe, expect, it } from 'vitest';
import { buildApp } from '../../../src/infrastructure/http/app.ts';
import { GetEntriesUseCase } from '../../../src/application/get-entries.use-case.ts';
import { CrawlerError } from '../../../src/application/ports/crawler-error.ts';
import { InMemoryUsageRepository } from '../../fixtures/in-memory-usage-repository.ts';

describe('HTTP error handling', () => {
  it.each([
    [new CrawlerError('upstream_error', 'Private upstream detail'), 502, 'upstream_error', 'Could not fetch the Hacker News front page.'],
    [new CrawlerError('timeout', 'Private timeout detail'), 504, 'timeout', 'Hacker News did not respond in time.'],
    [new CrawlerError('invalid_html', 'Private parser detail'), 502, 'invalid_html', 'Hacker News returned an invalid front page.'],
    [new Error('Private internal detail'), 500, 'internal_error', 'An unexpected error occurred.'],
  ] as const)('returns a stable error response for %s', async (failure, statusCode, code, message) => {
    const useCase = new GetEntriesUseCase({
      async fetchTopEntries() {
        throw failure;
      },
    }, new InMemoryUsageRepository());
    const app = buildApp(useCase);

    try {
      const response = await app.inject('/entries');
      expect(response.statusCode).toBe(statusCode);
      expect(response.json()).toEqual({ error: { code, message } });
    } finally {
      await app.close();
    }
  });
});

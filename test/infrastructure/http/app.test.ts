import { describe, expect, it } from 'vitest';
import { GetEntriesUseCase } from '../../../src/application/get-entries.use-case.ts';
import type { NewsSourcePort } from '../../../src/application/ports/news-source.port.ts';
import { buildApp } from '../../../src/infrastructure/http/app.ts';
import { makeEntries } from '../../fixtures/entries.ts';

describe('HTTP app', () => {
  it.each([29, 31])('returns 502 when the source provides %i entries', async (count) => {
    const app = buildApp(new GetEntriesUseCase({
      async fetchTopEntries() {
        return makeEntries(count);
      },
    }));

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
    const source: NewsSourcePort = { async fetchTopEntries() { return makeEntries(30); } };
    const app = buildApp(new GetEntriesUseCase(source));
    try {
      expect((await app.inject('/entries')).statusCode).toBe(200);
      expect((await app.inject('/entries?filter=long')).statusCode).toBe(200);
      const invalidRequest = await app.inject('/entries?filter=unknown');
      expect(invalidRequest.statusCode).toBe(400);
      expect(invalidRequest.json()).toEqual({
        error: { code: 'invalid_request', message: 'Request validation failed.' },
      });
    } finally {
      await app.close();
    }
  });
});

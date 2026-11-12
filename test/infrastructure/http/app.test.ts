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
    const entries = makeEntries(30);
    entries[0] = { ...entries[0]!, title: 'one two three four five six', comments: 50 };
    entries[1] = { ...entries[1]!, points: 100 };
    const source: NewsSourcePort = { async fetchTopEntries() { return entries; } };
    const app = buildApp(new GetEntriesUseCase(source));
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

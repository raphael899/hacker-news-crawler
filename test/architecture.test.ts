import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/infrastructure/http/app.ts';
import { GetEntriesUseCase } from '../src/application/get-entries.use-case.ts';
import type { NewsSourcePort } from '../src/application/ports/news-source.port.ts';

function makeEntries(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    rank: index + 1,
    title: `Example ${index + 1}`,
    points: 10,
    comments: 2,
  }));
}

describe('architecture boundary', () => {
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

  it('domain, application, and ports do not import infrastructure libraries', () => {
    const sourceFiles = [
      '../src/domain/entry.ts',
      '../src/domain/filter.ts',
      '../src/domain/front-page.ts',
      '../src/application/get-entries.use-case.ts',
      '../src/application/ports/news-source.port.ts',
      '../src/application/ports/crawler-error.ts',
    ];
    for (const sourceFile of sourceFiles) {
      const source = readFileSync(new URL(sourceFile, import.meta.url), 'utf8');
      expect(source).not.toMatch(/from ['"][^'"]*(fastify|cheerio|sqlite)/u);
    }
  });
});

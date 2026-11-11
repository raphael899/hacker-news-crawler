import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/adapters/http/app.ts';
import { GetEntriesUseCase } from '../src/application/get-entries.use-case.ts';
import type { NewsSourcePort } from '../src/ports/news-source.port.ts';

describe('architecture boundary', () => {
  it('the application requests the first 30 entries through its port', async () => {
    const entries = [{ rank: 1, title: 'Example', points: 10, comments: 2 }];
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


  it('exposes the application through a validated HTTP adapter', async () => {
    const source: NewsSourcePort = { async fetchTopEntries() { return []; } };
    const app = buildApp(new GetEntriesUseCase(source));
    try {
      expect((await app.inject('/entries')).statusCode).toBe(200);
      expect((await app.inject('/entries?filter=long')).statusCode).toBe(200);
      expect((await app.inject('/entries?filter=unknown')).statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });

  it('domain, application, and ports do not import infrastructure libraries', () => {
    const sourceFiles = [
      '../src/domain/entry.ts',
      '../src/domain/filter.ts',
      '../src/application/get-entries.use-case.ts',
      '../src/ports/news-source.port.ts',
      '../src/ports/usage-repository.port.ts',
    ];
    for (const sourceFile of sourceFiles) {
      const source = readFileSync(new URL(sourceFile, import.meta.url), 'utf8');
      expect(source).not.toMatch(/from ['"][^'"]*(fastify|cheerio|sqlite)/u);
    }
  });
});

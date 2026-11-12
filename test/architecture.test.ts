import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('architecture boundary', () => {
  it('domain, application, and ports do not import infrastructure libraries', () => {
    const sourceFiles = [
      '../src/domain/entry.ts',
      '../src/domain/filter.ts',
      '../src/domain/front-page.ts',
      '../src/domain/title.ts',
      '../src/domain/usage-record.ts',
      '../src/application/get-entries.use-case.ts',
      '../src/application/ports/news-source.port.ts',
      '../src/application/ports/usage-repository.port.ts',
      '../src/application/ports/crawler-error.ts',
    ];
    for (const sourceFile of sourceFiles) {
      const source = readFileSync(new URL(sourceFile, import.meta.url), 'utf8');
      expect(source).not.toMatch(/from ['"][^'"]*(fastify|cheerio|sqlite)/u);
    }
  });
});

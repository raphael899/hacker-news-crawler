import type { NewsSourcePort } from '../../application/ports/news-source.port.ts';
import type { Entry } from '../../domain/entry.ts';
import { fetchFrontPage, type HackerNewsOptions } from './fetch-front-page.ts';
import { parseFrontPage } from './parse-front-page.ts';

export class HackerNewsNewsSource implements NewsSourcePort {
  private readonly options: HackerNewsOptions;
  private readonly request: typeof fetch;

  constructor(options: HackerNewsOptions, request: typeof fetch = fetch) {
    this.options = options;
    this.request = request;
  }

  async fetchTopEntries(limit: number): Promise<readonly Entry[]> {
    if (!Number.isSafeInteger(limit) || limit < 1) {
      throw new RangeError('The entry limit must be a positive integer');
    }
    const html = await fetchFrontPage(this.options, this.request);
    return parseFrontPage(html, limit);
  }
}

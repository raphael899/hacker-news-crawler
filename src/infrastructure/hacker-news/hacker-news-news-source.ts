import type { NewsSourcePort } from '../../application/ports/news-source.port.ts';
import type { Entry } from '../../domain/entry.ts';
import type { HackerNewsConfig } from '../config/app-config.ts';
import { fetchFrontPage } from './fetch-front-page.ts';
import { parseFrontPage } from './parse-front-page.ts';

export class HackerNewsNewsSource implements NewsSourcePort {
  private readonly config: HackerNewsConfig;
  private readonly request: typeof fetch;

  constructor(config: HackerNewsConfig, request: typeof fetch = fetch) {
    this.config = config;
    this.request = request;
  }

  async fetchTopEntries(limit: number): Promise<readonly Entry[]> {
    if (!Number.isSafeInteger(limit) || limit < 1) {
      throw new RangeError('The entry limit must be a positive integer');
    }
    const html = await fetchFrontPage(this.config, this.request);
    return parseFrontPage(html, limit);
  }
}

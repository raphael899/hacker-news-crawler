import type { NewsSourcePort } from '../../application/ports/news-source.port.ts';
import type { Entry } from '../../domain/entry.ts';
import { FrontPage } from '../../domain/front-page.ts';
import type { AppConfig } from '../config/app-config.ts';
import { fetchFrontPage } from './fetch-front-page.ts';
import { parseFrontPage } from './parse-front-page.ts';

export class HackerNewsNewsSource implements NewsSourcePort {
  private readonly config: AppConfig['hackerNews'];
  private readonly request: typeof fetch;

  constructor(config: AppConfig['hackerNews'], request: typeof fetch = fetch) {
    this.config = config;
    this.request = request;
  }

  async fetchTopEntries(limit: number): Promise<readonly Entry[]> {
    if (limit !== FrontPage.entryCount) {
      throw new RangeError(`Hacker News source only supports ${FrontPage.entryCount} entries`);
    }
    const html = await fetchFrontPage(this.config, this.request);
    return parseFrontPage(html);
  }
}

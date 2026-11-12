import type { Entry } from '../domain/entry.ts';
import { FrontPage } from '../domain/front-page.ts';
import type { NewsSourcePort } from './ports/news-source.port.ts';

export class GetEntriesUseCase {
  private readonly newsSource: NewsSourcePort;

  constructor(newsSource: NewsSourcePort) {
    this.newsSource = newsSource;
  }

  async execute(): Promise<readonly Entry[]> {
    const entries = await this.newsSource.fetchTopEntries(FrontPage.entryCount);
    return FrontPage.create(entries).entries;
  }
}

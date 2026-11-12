import type { Entry } from '../domain/entry.ts';
import { filterEntries, type EntryFilter } from '../domain/filter.ts';
import { FrontPage } from '../domain/front-page.ts';
import type { NewsSourcePort } from './ports/news-source.port.ts';

export class GetEntriesUseCase {
  private readonly newsSource: NewsSourcePort;

  constructor(newsSource: NewsSourcePort) {
    this.newsSource = newsSource;
  }

  async execute(filter: EntryFilter = 'all'): Promise<readonly Entry[]> {
    const entries = await this.newsSource.fetchTopEntries(FrontPage.entryCount);
    const frontPage = FrontPage.create(entries);
    return filterEntries(frontPage.entries, filter);
  }
}

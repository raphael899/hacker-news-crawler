import type { Entry } from '../domain/entry.ts';
import type { NewsSourcePort } from '../ports/news-source.port.ts';

export class GetEntriesUseCase {
  private readonly newsSource: NewsSourcePort;

  constructor(newsSource: NewsSourcePort) {
    this.newsSource = newsSource;
  }

  execute(): Promise<readonly Entry[]> {
    return this.newsSource.fetchTopEntries(30);
  }
}

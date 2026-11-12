import type { Entry } from '../domain/entry.ts';
import { filterEntries, type EntryFilter } from '../domain/filter.ts';
import { FrontPage } from '../domain/front-page.ts';
import type { NewsSourcePort } from './ports/news-source.port.ts';
import type { UsageRepositoryPort } from './ports/usage-repository.port.ts';

export class GetEntriesUseCase {
  private readonly newsSource: NewsSourcePort;
  private readonly usageRepository: UsageRepositoryPort;
  private readonly now: () => Date;

  constructor(
    newsSource: NewsSourcePort,
    usageRepository: UsageRepositoryPort,
    now: () => Date = () => new Date(),
  ) {
    this.newsSource = newsSource;
    this.usageRepository = usageRepository;
    this.now = now;
  }

  async execute(filter: EntryFilter = 'all'): Promise<readonly Entry[]> {
    const requestedAt = this.now().toISOString();
    const entries = await this.newsSource.fetchTopEntries(FrontPage.entryCount);
    const frontPage = FrontPage.create(entries);
    const result = filterEntries(frontPage.entries, filter);
    await this.usageRepository.record({ requestedAt, filter, resultCount: result.length });
    return result;
  }
}

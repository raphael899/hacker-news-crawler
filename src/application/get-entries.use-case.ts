import type { Entry } from '../domain/entry.ts';
import { filterEntries, type EntryFilter } from '../domain/filter.ts';
import { FrontPage } from '../domain/front-page.ts';
import type { CacheStatus } from '../domain/cache-status.ts';
import type { FrontPageCachePort } from './ports/front-page-cache.port.ts';
import type { NewsSourcePort } from './ports/news-source.port.ts';
import type { UsageRepositoryPort } from './ports/usage-repository.port.ts';

export interface GetEntriesResult {
  readonly entries: readonly Entry[];
  readonly fetchedAt: string;
  readonly cacheStatus: CacheStatus;
}

export class GetEntriesUseCase {
  private readonly newsSource: NewsSourcePort;
  private readonly frontPageCache: FrontPageCachePort;
  private readonly usageRepository: UsageRepositoryPort;
  private readonly now: () => Date;

  constructor(
    newsSource: NewsSourcePort,
    frontPageCache: FrontPageCachePort,
    usageRepository: UsageRepositoryPort,
    now: () => Date = () => new Date(),
  ) {
    this.newsSource = newsSource;
    this.frontPageCache = frontPageCache;
    this.usageRepository = usageRepository;
    this.now = now;
  }

  async execute(filter: EntryFilter = 'all'): Promise<GetEntriesResult> {
    const requestedAt = this.now().toISOString();
    const snapshot = await this.frontPageCache.getOrLoad(async () => {
      const entries = await this.newsSource.fetchTopEntries(FrontPage.entryCount);
      return FrontPage.create(entries);
    });
    const entries = filterEntries(snapshot.frontPage.entries, filter);
    await this.usageRepository.record({
      requestedAt,
      snapshotAt: snapshot.fetchedAt,
      filter,
      resultCount: entries.length,
      cacheStatus: snapshot.cacheStatus,
    });
    return { entries, fetchedAt: snapshot.fetchedAt, cacheStatus: snapshot.cacheStatus };
  }
}

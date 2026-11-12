import { filterEntries, type EntryFilter } from '../domain/filter.ts';
import { FrontPage, InvalidFrontPageError } from '../domain/front-page.ts';
import { CrawlerError } from './ports/crawler-error.ts';
import {
  FrontPageLoadError,
  type CacheStatus,
  type CachedFrontPage,
  type FrontPageCachePort,
} from './ports/front-page-cache.port.ts';
import type { GetEntriesPort, GetEntriesResult } from './ports/get-entries.port.ts';
import type { NewsSourcePort } from './ports/news-source.port.ts';
import type { UsageRepositoryPort } from './ports/usage-repository.port.ts';

export class GetEntriesUseCase implements GetEntriesPort {
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

  async execute(filter: EntryFilter): Promise<GetEntriesResult> {
    const requestedAt = this.now().toISOString();
    const snapshot = await this.loadSnapshot(requestedAt, filter);
    const entries = filterEntries(snapshot.frontPage.entries, filter);

    await this.usageRepository.record({
      requestedAt,
      snapshotAt: snapshot.fetchedAt,
      filter,
      resultCount: entries.length,
      cacheStatus: snapshot.cacheStatus,
      outcome: 'success',
    });
    return { entries, fetchedAt: snapshot.fetchedAt, cacheStatus: snapshot.cacheStatus };
  }

  private async loadSnapshot(requestedAt: string, filter: EntryFilter): Promise<CachedFrontPage> {
    try {
      return await this.frontPageCache.getOrLoad(() => this.downloadFrontPage());
    } catch (error) {
      const { cause, cacheStatus } = unwrapLoadError(error);
      if (cause instanceof CrawlerError) {
        await this.usageRepository.record({
          requestedAt,
          snapshotAt: null,
          filter,
          resultCount: 0,
          cacheStatus,
          outcome: cause.outcome,
        });
      }
      throw cause;
    }
  }

  private async downloadFrontPage(): Promise<FrontPage> {
    const entries = await this.newsSource.fetchTopEntries(FrontPage.entryCount);
    try {
      return FrontPage.create(entries);
    } catch (error) {
      if (error instanceof InvalidFrontPageError) {
        throw new CrawlerError('invalid_html', error.message, { cause: error });
      }
      throw error;
    }
  }
}

function unwrapLoadError(error: unknown): { cause: unknown; cacheStatus: CacheStatus } {
  return error instanceof FrontPageLoadError
    ? { cause: error.cause, cacheStatus: error.cacheStatus }
    : { cause: error, cacheStatus: 'miss' };
}

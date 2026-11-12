import type { CrawlerOutcome } from '../domain/crawler-outcome.ts';
import { filterEntries, type EntryFilter } from '../domain/filter.ts';
import { FrontPage, InvalidFrontPageError } from '../domain/front-page.ts';
import { CrawlerError } from './ports/crawler-error.ts';
import { FrontPageLoadError, type FrontPageCachePort } from './ports/front-page-cache.port.ts';
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

  async execute(filter: EntryFilter = 'all'): Promise<GetEntriesResult> {
    const requestedAt = this.now().toISOString();
    let snapshot;
    try {
      snapshot = await this.frontPageCache.getOrLoad(async () => {
        const entries = await this.newsSource.fetchTopEntries(FrontPage.entryCount);
        return FrontPage.create(entries);
      });
    } catch (error) {
      const { cause, cacheStatus } = error instanceof FrontPageLoadError
        ? { cause: error.cause, cacheStatus: error.cacheStatus }
        : { cause: error, cacheStatus: 'miss' as const };
      const outcome = getCrawlerOutcome(cause);
      if (outcome) {
        await this.usageRepository.record({
          requestedAt,
          snapshotAt: null,
          filter,
          resultCount: 0,
          cacheStatus,
          outcome,
        });
      }
      throw cause;
    }
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
}

function getCrawlerOutcome(error: unknown): CrawlerOutcome | undefined {
  if (error instanceof CrawlerError) return error.outcome;
  if (error instanceof InvalidFrontPageError) return 'invalid_html';
  return undefined;
}

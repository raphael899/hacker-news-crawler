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
import type { UsageRecord, UsageRepositoryPort } from './ports/usage-repository.port.ts';

interface RequestContext {
  readonly filter: EntryFilter;
  readonly requestedAt: string;
  readonly startedAt: number;
}

type RequestResult = Pick<UsageRecord, 'snapshotAt' | 'resultCount' | 'cacheStatus' | 'outcome'>;

export class GetEntriesUseCase implements GetEntriesPort {
  private readonly newsSource: NewsSourcePort;
  private readonly frontPageCache: FrontPageCachePort;
  private readonly usageRepository: UsageRepositoryPort;
  private readonly wallClock: () => Date;
  private readonly monotonicNow: () => number;

  constructor(
    newsSource: NewsSourcePort,
    frontPageCache: FrontPageCachePort,
    usageRepository: UsageRepositoryPort,
    wallClock: () => Date = () => new Date(),
    monotonicNow: () => number = () => performance.now(),
  ) {
    this.newsSource = newsSource;
    this.frontPageCache = frontPageCache;
    this.usageRepository = usageRepository;
    this.wallClock = wallClock;
    this.monotonicNow = monotonicNow;
  }

  async execute(filter: EntryFilter): Promise<GetEntriesResult> {
    const request: RequestContext = {
      filter,
      requestedAt: this.wallClock().toISOString(),
      startedAt: this.monotonicNow(),
    };
    const snapshot = await this.loadSnapshot(request);
    const entries = filterEntries(snapshot.frontPage.entries, filter);

    await this.record(request, {
      snapshotAt: snapshot.fetchedAt,
      resultCount: entries.length,
      cacheStatus: snapshot.cacheStatus,
      outcome: 'success',
    });
    return { entries, fetchedAt: snapshot.fetchedAt, cacheStatus: snapshot.cacheStatus };
  }

  private async loadSnapshot(request: RequestContext): Promise<CachedFrontPage> {
    try {
      return await this.frontPageCache.getOrLoad(() => this.downloadFrontPage());
    } catch (error) {
      const { cause, cacheStatus } = unwrapLoadError(error);
      if (cause instanceof CrawlerError) {
        await this.record(request, { snapshotAt: null, resultCount: 0, cacheStatus, outcome: cause.outcome });
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

  private async record({ filter, requestedAt, startedAt }: RequestContext, result: RequestResult): Promise<void> {
    const durationMs = Math.round(this.monotonicNow() - startedAt);
    await this.usageRepository.record({ requestedAt, filter, ...result, durationMs });
  }
}

function unwrapLoadError(error: unknown): { cause: unknown; cacheStatus: CacheStatus } {
  return error instanceof FrontPageLoadError
    ? { cause: error.cause, cacheStatus: error.cacheStatus }
    : { cause: error, cacheStatus: 'miss' };
}

import type { FrontPage } from '../../domain/front-page.ts';
import type { CacheStatus } from '../../domain/cache-status.ts';

export interface CachedFrontPage {
  readonly frontPage: FrontPage;
  readonly fetchedAt: string;
  readonly cacheStatus: CacheStatus;
}

/**
 * Raised when a load fails, so callers know whether this request started the
 * failed download (`miss`) or joined one already in flight (`coalesced`).
 * The original failure is kept in `cause`.
 */
export class FrontPageLoadError extends Error {
  readonly cacheStatus: CacheStatus;

  constructor(cacheStatus: CacheStatus, options: { cause: unknown }) {
    super('The front-page snapshot could not be loaded', options);
    this.name = 'FrontPageLoadError';
    this.cacheStatus = cacheStatus;
  }
}

export interface FrontPageCachePort {
  /** Rejects with FrontPageLoadError when `load` fails; failed loads are not cached. */
  getOrLoad(load: () => Promise<FrontPage>): Promise<CachedFrontPage>;
}

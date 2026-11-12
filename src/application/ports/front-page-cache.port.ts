import type { FrontPage } from '../../domain/front-page.ts';

export const CACHE_STATUSES = ['miss', 'coalesced', 'hit'] as const;

export type CacheStatus = typeof CACHE_STATUSES[number];

export interface CachedFrontPage {
  readonly frontPage: FrontPage;
  readonly fetchedAt: string;
  readonly cacheStatus: CacheStatus;
}
export class FrontPageLoadError extends Error {
  readonly cacheStatus: CacheStatus;

  constructor(cacheStatus: CacheStatus, options: { cause: unknown }) {
    super('The front-page snapshot could not be loaded', options);
    this.name = 'FrontPageLoadError';
    this.cacheStatus = cacheStatus;
  }
}

export interface FrontPageCachePort {
  getOrLoad(load: () => Promise<FrontPage>): Promise<CachedFrontPage>;
}

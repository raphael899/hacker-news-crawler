import type { FrontPage } from '../../domain/front-page.ts';
import type { CacheStatus } from '../../domain/cache-status.ts';

export interface CachedFrontPage {
  readonly frontPage: FrontPage;
  readonly fetchedAt: string;
  readonly cacheStatus: CacheStatus;
}

export interface FrontPageCachePort {
  getOrLoad(load: () => Promise<FrontPage>): Promise<CachedFrontPage>;
}

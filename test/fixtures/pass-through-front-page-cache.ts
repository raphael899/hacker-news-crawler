import type { FrontPageCachePort } from '../../src/application/ports/front-page-cache.port.ts';

export class PassThroughFrontPageCache implements FrontPageCachePort {
  async getOrLoad(load: Parameters<FrontPageCachePort['getOrLoad']>[0]) {
    return {
      frontPage: await load(),
      fetchedAt: '2026-11-12T15:00:00.000Z',
      cacheStatus: 'miss' as const,
    };
  }
}

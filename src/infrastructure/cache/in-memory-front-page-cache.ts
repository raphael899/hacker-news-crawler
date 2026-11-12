import type { FrontPageCachePort, CachedFrontPage } from '../../application/ports/front-page-cache.port.ts';
import type { FrontPage } from '../../domain/front-page.ts';

interface CachedSnapshot {
  readonly frontPage: FrontPage;
  readonly fetchedAt: string;
}

interface CacheEntry extends CachedSnapshot {
  readonly expiresAt: number;
}

export class InMemoryFrontPageCache implements FrontPageCachePort {
  private readonly ttlMs: number;
  private readonly monotonicNow: () => number;
  private readonly wallClock: () => Date;
  private cacheEntry: CacheEntry | undefined;
  private inFlight: Promise<CachedSnapshot> | undefined;

  constructor(
    ttlMs: number,
    monotonicNow: () => number = () => performance.now(),
    wallClock: () => Date = () => new Date(),
  ) {
    if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0) {
      throw new RangeError('Cache TTL must be a positive safe integer');
    }
    this.ttlMs = ttlMs;
    this.monotonicNow = monotonicNow;
    this.wallClock = wallClock;
  }

  async getOrLoad(load: () => Promise<FrontPage>): Promise<CachedFrontPage> {
    const currentTime = this.monotonicNow();
    if (this.cacheEntry && currentTime < this.cacheEntry.expiresAt) {
      const { frontPage, fetchedAt } = this.cacheEntry;
      return { frontPage, fetchedAt, cacheStatus: 'hit' };
    }

    if (this.inFlight) {
      const snapshot = await this.inFlight;
      return { ...snapshot, cacheStatus: 'coalesced' };
    }

    const request = Promise.resolve().then(load).then((frontPage) => {
      const snapshot = { frontPage, fetchedAt: this.wallClock().toISOString() };
      this.cacheEntry = { ...snapshot, expiresAt: this.monotonicNow() + this.ttlMs };
      return snapshot;
    });
    this.inFlight = request;

    try {
      const snapshot = await request;
      return { ...snapshot, cacheStatus: 'miss' };
    } finally {
      if (this.inFlight === request) this.inFlight = undefined;
    }
  }
}

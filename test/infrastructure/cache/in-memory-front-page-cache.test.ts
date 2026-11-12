import { describe, expect, it, vi } from 'vitest';
import { FrontPage } from '../../../src/domain/front-page.ts';
import { InMemoryFrontPageCache } from '../../../src/infrastructure/cache/in-memory-front-page-cache.ts';
import { makeEntries } from '../../fixtures/entries.ts';

describe('InMemoryFrontPageCache', () => {
  it('coalesces concurrent misses and returns the same fetched timestamp', async () => {
    const frontPage = FrontPage.create(makeEntries(30));
    let resolveLoad: ((value: FrontPage) => void) | undefined;
    const load = vi.fn(() => new Promise<FrontPage>((resolve) => { resolveLoad = resolve; }));
    const cache = new InMemoryFrontPageCache(60_000, () => 0, () => new Date('2026-11-12T15:00:00.000Z'));

    const missRequest = cache.getOrLoad(load);
    const coalescedRequest = cache.getOrLoad(load);
    await vi.waitFor(() => expect(load).toHaveBeenCalledOnce());
    resolveLoad?.(frontPage);
    const [miss, coalesced] = await Promise.all([missRequest, coalescedRequest]);

    expect(miss.cacheStatus).toBe('miss');
    expect(coalesced.cacheStatus).toBe('coalesced');
    expect(miss.frontPage).toBe(coalesced.frontPage);
    expect(miss.fetchedAt).toBe(coalesced.fetchedAt);
  });

  it('serves hits until the TTL expires, then loads a fresh snapshot', async () => {
    let monotonicTime = 0;
    let wallClockTime = Date.parse('2026-11-12T15:00:00.000Z');
    let loadCount = 0;
    const cache = new InMemoryFrontPageCache(
      60_000,
      () => monotonicTime,
      () => new Date(wallClockTime),
    );
    const load = async () => {
      loadCount += 1;
      return FrontPage.create(makeEntries(30));
    };

    const first = await cache.getOrLoad(load);
    monotonicTime = 59_999;
    const hit = await cache.getOrLoad(load);
    monotonicTime = 60_000;
    wallClockTime += 60_000;
    const refreshed = await cache.getOrLoad(load);

    expect(first.cacheStatus).toBe('miss');
    expect(hit.cacheStatus).toBe('hit');
    expect(hit.fetchedAt).toBe(first.fetchedAt);
    expect(refreshed.cacheStatus).toBe('miss');
    expect(refreshed.fetchedAt).not.toBe(first.fetchedAt);
    expect(loadCount).toBe(2);
  });

  it('does not cache a rejected load and permits a retry', async () => {
    const cache = new InMemoryFrontPageCache(60_000, () => 0, () => new Date('2026-11-12T15:00:00.000Z'));
    const failedLoad = vi.fn(async () => { throw new Error('source unavailable'); });
    await expect(cache.getOrLoad(failedLoad)).rejects.toThrow('source unavailable');

    const retried = await cache.getOrLoad(async () => FrontPage.create(makeEntries(30)));
    expect(retried.cacheStatus).toBe('miss');
  });

  it('rejects a non-positive or unsafe TTL', () => {
    expect(() => new InMemoryFrontPageCache(0)).toThrow('positive safe integer');
    expect(() => new InMemoryFrontPageCache(Number.MAX_SAFE_INTEGER + 1)).toThrow('positive safe integer');
  });
});

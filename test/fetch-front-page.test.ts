import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFetchTimeoutMs, readHackerNewsUrl } from '../src/infrastructure/config/hacker-news.ts';
import { fetchFrontPage } from '../src/infrastructure/hacker-news/fetch-front-page.ts';

describe('front page download', () => {
  const url = 'http://origin.test/';

  afterEach(() => vi.unstubAllEnvs());

  it('accepts configuration supplied explicitly', () => {
    const env = { HN_URL: 'https://origin.test', FETCH_TIMEOUT_MS: ' 5000 ' };
    expect(readHackerNewsUrl(env)).toBe('https://origin.test/');
    expect(readFetchTimeoutMs(env)).toBe(5000);
  });

  it('reads the source URL and timeout from the environment', async () => {
    vi.stubEnv('HN_URL', url);
    vi.stubEnv('FETCH_TIMEOUT_MS', '100');
    const request = vi.fn(async () => new Response('<html></html>'));

    await expect(fetchFrontPage(undefined, undefined, request)).resolves.toBe('<html></html>');
    expect(request).toHaveBeenCalledExactlyOnceWith(url, expect.objectContaining({
      signal: expect.any(AbortSignal),
    }));
  });

  it.each([
    ['HN_URL', undefined],
    ['HN_URL', 'file:///tmp/front-page.html'],
    ['FETCH_TIMEOUT_MS', undefined],
    ['FETCH_TIMEOUT_MS', '0'],
    ['FETCH_TIMEOUT_MS', '1e3'],
    ['FETCH_TIMEOUT_MS', '0x100'],
    ['FETCH_TIMEOUT_MS', '2147483648'],
  ] as const)('rejects invalid configuration for %s (%s) before making a request', async (name, value) => {
    vi.stubEnv('HN_URL', url);
    vi.stubEnv('FETCH_TIMEOUT_MS', '100');
    vi.stubEnv(name, value);
    const request = vi.fn();

    await expect(fetchFrontPage(undefined, undefined, request)).rejects.toThrow(name);
    expect(request).not.toHaveBeenCalled();
  });

  it('makes one request and returns the body', async () => {
    const request = vi.fn(async () => new Response('<html></html>'));
    await expect(fetchFrontPage(url, 100, request)).resolves.toBe('<html></html>');
    expect(request).toHaveBeenCalledExactlyOnceWith(url, expect.objectContaining({
      redirect: 'error',
      signal: expect.any(AbortSignal),
    }));
  });

  it('classifies non-successful responses and network errors', async () => {
    await expect(fetchFrontPage(url, 100, async () => new Response('unavailable', { status: 503 })))
      .rejects.toMatchObject({ outcome: 'upstream_error' });
    await expect(fetchFrontPage(url, 100, async () => { throw new TypeError('offline'); }))
      .rejects.toMatchObject({ outcome: 'upstream_error' });
  });

  it('times out when the body stalls after receiving headers', async () => {
    const request: typeof fetch = async (_, init) => new Response(new ReadableStream({
      start(controller) {
        init?.signal?.addEventListener('abort', () => controller.error(init.signal?.reason), { once: true });
      },
    }));
    vi.stubEnv('FETCH_TIMEOUT_MS', '20');
    await expect(fetchFrontPage(url, undefined, request)).rejects.toMatchObject({ outcome: 'timeout' });
  });
});

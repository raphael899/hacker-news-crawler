import { describe, expect, it, vi } from 'vitest';
import { fetchFrontPage } from '../../../src/infrastructure/hacker-news/fetch-front-page.ts';

describe('front page download', () => {
  const url = 'http://origin.test/';
  const config = { url, timeoutMs: 100 };

  it('makes one request and returns the body', async () => {
    const request = vi.fn(async () => new Response('<html></html>'));
    await expect(fetchFrontPage(config, request)).resolves.toBe('<html></html>');
    expect(request).toHaveBeenCalledExactlyOnceWith(url, expect.objectContaining({
      redirect: 'error',
      signal: expect.any(AbortSignal),
    }));
  });

  it('classifies non-successful responses and network errors', async () => {
    await expect(fetchFrontPage(config, async () => new Response('unavailable', { status: 503 })))
      .rejects.toMatchObject({ outcome: 'upstream_error' });
    await expect(fetchFrontPage(config, async () => { throw new TypeError('offline'); }))
      .rejects.toMatchObject({ outcome: 'upstream_error' });
  });

  it('times out when the body stalls after receiving headers', async () => {
    const request: typeof fetch = async (_, init) => new Response(new ReadableStream({
      start(controller) {
        init?.signal?.addEventListener('abort', () => controller.error(init.signal?.reason), { once: true });
      },
    }));
    await expect(fetchFrontPage({ ...config, timeoutMs: 20 }, request)).rejects.toMatchObject({ outcome: 'timeout' });
  });
});

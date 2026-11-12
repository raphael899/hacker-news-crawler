import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { HackerNewsNewsSource } from '../../../src/infrastructure/hacker-news/hacker-news-news-source.ts';

describe('HackerNewsNewsSource', () => {
  it('downloads and parses the front page through the source port', async () => {
    const html = await readFile(new URL('../../fixtures/front-page.html', import.meta.url), 'utf8');
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(html));
    const source = new HackerNewsNewsSource({ url: 'https://news.ycombinator.com/', timeoutMs: 5000 }, request);

    const entries = await source.fetchTopEntries(30);
    expect(entries).toHaveLength(30);
    expect(entries[0]).toEqual({
      rank: 1,
      title: 'Reliable systems',
      points: 213,
      comments: 57,
    });
    expect(entries[29]?.rank).toBe(30);
    expect(request).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledWith('https://news.ycombinator.com/', expect.objectContaining({
      redirect: 'error',
    }));
  });

  it('only supports the domain-defined front-page size', async () => {
    const request = vi.fn<typeof fetch>();
    const source = new HackerNewsNewsSource({ url: 'https://news.ycombinator.com/', timeoutMs: 5000 }, request);

    await expect(source.fetchTopEntries(20)).rejects.toThrow('only supports 30 entries');
    expect(request).not.toHaveBeenCalled();
  });
});

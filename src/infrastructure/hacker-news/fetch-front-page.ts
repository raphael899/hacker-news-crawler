import { CrawlerError } from '../../application/ports/crawler-error.ts';

/** What the Hacker News adapter needs; the configuration module supplies it. */
export interface HackerNewsOptions {
  readonly url: string;
  readonly timeoutMs: number;
}

export async function fetchFrontPage(
  { url, timeoutMs }: HackerNewsOptions,
  request = fetch,
): Promise<string> {
  const signal = AbortSignal.timeout(timeoutMs);
  try {
    const response = await request(url, {
      signal,
      redirect: 'error',
      headers: { accept: 'text/html', 'user-agent': 'HN-Crawler/1.0' },
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new CrawlerError('upstream_error', `Hacker News returned HTTP ${response.status}`);
    }
    return await response.text();
  } catch (cause) {
    if (cause instanceof CrawlerError) throw cause;
    if (signal.aborted) {
      throw new CrawlerError('timeout', 'Hacker News timed out', { cause });
    }
    throw new CrawlerError('upstream_error', 'Could not fetch Hacker News', { cause });
  }
}

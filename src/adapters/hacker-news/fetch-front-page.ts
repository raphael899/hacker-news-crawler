import { CrawlerError } from './crawler-error.ts';

export const DEFAULT_HN_URL = 'https://news.ycombinator.com/';
export const DEFAULT_FETCH_TIMEOUT_MS = 5_000;

export async function fetchFrontPage(
  url = DEFAULT_HN_URL,
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
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

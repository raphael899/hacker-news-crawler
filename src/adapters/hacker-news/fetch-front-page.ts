import { CrawlerError } from '../../ports/crawler-error.ts';

function readHackerNewsUrl(): string {
  const url = URL.parse(process.env.HN_URL ?? '');
  if (!url || !['http:', 'https:'].includes(url.protocol)) {
    throw new Error('HN_URL must be an absolute HTTP or HTTPS URL');
  }
  return url.href;
}

function readFetchTimeoutMs(): number {
  const timeoutMs = Number(process.env.FETCH_TIMEOUT_MS);
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2_147_483_647) {
    throw new Error('FETCH_TIMEOUT_MS must be an integer between 1 and 2147483647');
  }
  return timeoutMs;
}

export async function fetchFrontPage(
  url = readHackerNewsUrl(),
  timeoutMs = readFetchTimeoutMs(),
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

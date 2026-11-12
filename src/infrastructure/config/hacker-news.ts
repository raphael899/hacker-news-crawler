export function readHackerNewsUrl(): string {
  const url = URL.parse(process.env.HN_URL ?? '');
  if (!url || !['http:', 'https:'].includes(url.protocol)) {
    throw new Error('HN_URL must be an absolute HTTP or HTTPS URL');
  }
  return url.href;
}

export function readFetchTimeoutMs(): number {
  const timeoutMs = Number(process.env.FETCH_TIMEOUT_MS);
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2_147_483_647) {
    throw new Error('FETCH_TIMEOUT_MS must be an integer between 1 and 2147483647');
  }
  return timeoutMs;
}

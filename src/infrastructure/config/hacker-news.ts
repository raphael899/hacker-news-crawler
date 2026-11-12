const MAX_TIMER_DELAY_MS = 2_147_483_647;

export function readHackerNewsUrl(env: NodeJS.ProcessEnv = process.env): string {
  const url = URL.parse(env.HN_URL ?? '');
  if (!url || (url.protocol !== 'http:' && url.protocol !== 'https:')) {
    throw new Error('HN_URL must be an absolute HTTP or HTTPS URL');
  }
  return url.href;
}

export function readFetchTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  const value = env.FETCH_TIMEOUT_MS?.trim() ?? '';
  const timeoutMs = Number(value);

  if (!/^[0-9]+$/.test(value) || timeoutMs < 1 || timeoutMs > MAX_TIMER_DELAY_MS) {
    throw new Error(`FETCH_TIMEOUT_MS must be a decimal integer between 1 and ${MAX_TIMER_DELAY_MS}`);
  }

  return timeoutMs;
}

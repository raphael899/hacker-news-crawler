export interface HackerNewsConfig {
  readonly url: string;
  readonly timeoutMs: number;
}

export interface AppConfig {
  readonly port: number;
  readonly databaseUrl: string;
  readonly cacheTtlMs: number;
  readonly hackerNews: HackerNewsConfig;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    port: parsePort(env.PORT),
    databaseUrl: parseDatabaseUrl(env.DATABASE_URL),
    cacheTtlMs: parseCacheTtlMs(env.CACHE_TTL_MS),
    hackerNews: {
      url: parseHackerNewsUrl(env.HN_URL),
      timeoutMs: parseFetchTimeoutMs(env.FETCH_TIMEOUT_MS),
    },
  };
}

function parseDatabaseUrl(rawValue: string | undefined): string {
  const value = rawValue?.trim() ?? '';
  const url = URL.parse(value);
  if (!url || !['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.pathname.slice(1)) {
    throw new Error('DATABASE_URL must be a PostgreSQL connection URL with a database name');
  }
  return value;
}

function parsePort(rawValue: string | undefined): number {
  const value = rawValue?.trim() ?? '';
  if (value === '') return 3000;

  const port = Number(value);
  if (!/^[0-9]+$/.test(value) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  return port;
}

function parseCacheTtlMs(rawValue: string | undefined): number {
  const value = rawValue?.trim() ?? '';
  if (value === '') return 60_000;

  const ttlMs = Number(value);
  if (!/^[0-9]+$/u.test(value) || !Number.isSafeInteger(ttlMs) || ttlMs <= 0) {
    throw new Error('CACHE_TTL_MS must be a positive safe integer in milliseconds');
  }
  return ttlMs;
}

function parseHackerNewsUrl(value: string | undefined): string {
  const url = URL.parse(value ?? '');
  if (!url || (url.protocol !== 'http:' && url.protocol !== 'https:')) {
    throw new Error('HN_URL must be an absolute HTTP or HTTPS URL');
  }
  return url.href;
}

function parseFetchTimeoutMs(rawValue: string | undefined): number {
  const value = rawValue?.trim() ?? '';
  const timeoutMs = Number(value);

  if (!/^[0-9]+$/.test(value) || timeoutMs < 1 || timeoutMs > 2 ** 31 - 1) {
    throw new Error('FETCH_TIMEOUT_MS must be a positive decimal integer within the Node.js timer range');
  }

  return timeoutMs;
}

import { integer, readEnv, url, type EnvSchema } from './env-schema.ts';

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

/** Highest TCP port number. */
const MAX_PORT = 65_535;

/** Node.js timers store the delay as a signed 32-bit integer; larger values fire immediately. */
const MAX_NODE_TIMER_MS = 2 ** 31 - 1;

/**
 * Every environment variable the service reads, with its validation rule.
 * Values come from `.env.local` (pnpm dev), `.env` (pnpm start), or the
 * container environment; the rules and defaults live here.
 */
const appEnvSchema = {
  /** Port the HTTP server listens on. */
  PORT: integer({ min: 1, max: MAX_PORT, fallback: 3000 }),
  /** PostgreSQL connection URL; the path is the database name. */
  DATABASE_URL: url({ protocols: ['postgres:', 'postgresql:'], requirePath: true }),
  /** How long a scraped front page is reused before downloading it again. */
  CACHE_TTL_MS: integer({ min: 1, fallback: 60_000 }),
  /** Front page to scrape, normally https://news.ycombinator.com/. */
  HN_URL: url({ protocols: ['http:', 'https:'] }),
  /** Deadline for the whole download, headers and body included. */
  FETCH_TIMEOUT_MS: integer({ min: 1, max: MAX_NODE_TIMER_MS }),
} satisfies EnvSchema;

/** Reads and validates the environment once at startup; throws a ConfigError listing every invalid variable. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const vars = readEnv(env, appEnvSchema);
  return {
    port: vars.PORT,
    databaseUrl: vars.DATABASE_URL,
    cacheTtlMs: vars.CACHE_TTL_MS,
    hackerNews: { url: vars.HN_URL, timeoutMs: vars.FETCH_TIMEOUT_MS },
  };
}

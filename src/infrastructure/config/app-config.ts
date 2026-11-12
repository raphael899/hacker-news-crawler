import type { HackerNewsOptions } from '../hacker-news/fetch-front-page.ts';

export interface AppConfig {
  readonly port: number;
  readonly databaseUrl: string;
  readonly cacheTtlMs: number;
  readonly hackerNews: HackerNewsOptions;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

const MAX_PORT = 65_535;
/** Node.js timers fire immediately when the delay exceeds a signed 32-bit integer. */
const MAX_TIMER_MS = 2 ** 31 - 1;

/** Reads and validates the environment once at startup. Throws a ConfigError naming the first invalid variable. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    port: readInteger(env, 'PORT', { max: MAX_PORT, fallback: 3000 }),
    databaseUrl: readUrl(env, 'DATABASE_URL', ['postgres:', 'postgresql:'], { requirePath: true }),
    cacheTtlMs: readInteger(env, 'CACHE_TTL_MS', { fallback: 60_000 }),
    hackerNews: {
      url: readUrl(env, 'HN_URL', ['http:', 'https:']),
      timeoutMs: readInteger(env, 'FETCH_TIMEOUT_MS', { max: MAX_TIMER_MS }),
    },
  };
}

/** Returns the trimmed value; throws when it is blank and there is no fallback. */
function readRequired(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new ConfigError(`${name} is required`);
  return value;
}

/** A positive whole number up to `max`. Rejects forms that Number() accepts, such as `1e3` or `0x10`. */
function readInteger(
  env: NodeJS.ProcessEnv,
  name: string,
  { max = Number.MAX_SAFE_INTEGER, fallback }: { max?: number; fallback?: number },
): number {
  if (!env[name]?.trim() && fallback !== undefined) return fallback;

  const text = readRequired(env, name);
  const value = Number(text);
  if (!/^\d+$/u.test(text) || value < 1 || value > max) {
    throw new ConfigError(`${name} must be a whole number between 1 and ${max}`);
  }
  return value;
}

/** An absolute URL with an allowed scheme and a host. The error never echoes the value, which may hold a password. */
function readUrl(
  env: NodeJS.ProcessEnv,
  name: string,
  protocols: readonly string[],
  { requirePath = false } = {},
): string {
  const url = URL.parse(readRequired(env, name));
  const valid = url !== null &&
    protocols.includes(url.protocol) &&
    url.hostname !== '' &&
    (!requirePath || url.pathname.length > 1);
  if (!valid) throw new ConfigError(`${name} must be an absolute ${protocols.join(' or ')} URL`);
  return url.href;
}

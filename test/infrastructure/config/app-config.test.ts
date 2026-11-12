import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../../../src/infrastructure/config/app-config.ts';

describe('loadConfig', () => {
  const validEnv = {
    PORT: '4123',
    DATABASE_URL: 'postgresql://crawler:secret@localhost:5432/hn_crawler',
    CACHE_TTL_MS: ' 45000 ',
    HN_URL: 'https://origin.test',
    FETCH_TIMEOUT_MS: ' 5000 ',
  };
  const expected = {
    port: 4123,
    databaseUrl: 'postgresql://crawler:secret@localhost:5432/hn_crawler',
    cacheTtlMs: 45000,
    hackerNews: { url: 'https://origin.test/', timeoutMs: 5000 },
  };

  afterEach(() => vi.unstubAllEnvs());

  it('parses configuration supplied explicitly', () => {
    expect(loadConfig(validEnv)).toEqual(expected);
  });

  it('uses the process environment by default', () => {
    vi.stubEnv('PORT', validEnv.PORT);
    vi.stubEnv('DATABASE_URL', validEnv.DATABASE_URL);
    vi.stubEnv('CACHE_TTL_MS', validEnv.CACHE_TTL_MS);
    vi.stubEnv('HN_URL', validEnv.HN_URL);
    vi.stubEnv('FETCH_TIMEOUT_MS', validEnv.FETCH_TIMEOUT_MS);
    expect(loadConfig()).toEqual(expected);
  });

  it('defaults the port to 3000 when PORT is blank or absent', () => {
    expect(loadConfig({ ...validEnv, PORT: '' })).toEqual({ ...expected, port: 3000 });
    expect(loadConfig({ HN_URL: validEnv.HN_URL, FETCH_TIMEOUT_MS: validEnv.FETCH_TIMEOUT_MS,
      DATABASE_URL: validEnv.DATABASE_URL }))
      .toEqual({ ...expected, cacheTtlMs: 60_000, port: 3000 });
  });

  it('requires a PostgreSQL connection URL', () => {
    expect(() => loadConfig({ ...validEnv, DATABASE_URL: '' })).toThrow('DATABASE_URL');
    expect(() => loadConfig({ HN_URL: validEnv.HN_URL, FETCH_TIMEOUT_MS: validEnv.FETCH_TIMEOUT_MS }))
      .toThrow('DATABASE_URL');
  });

  it('defaults cache TTL to 60 seconds when CACHE_TTL_MS is blank or absent', () => {
    expect(loadConfig({ ...validEnv, CACHE_TTL_MS: '' })).toEqual({ ...expected, cacheTtlMs: 60_000 });
    expect(loadConfig({
      HN_URL: validEnv.HN_URL,
      FETCH_TIMEOUT_MS: validEnv.FETCH_TIMEOUT_MS,
      DATABASE_URL: validEnv.DATABASE_URL,
    })).toEqual({ ...expected, cacheTtlMs: 60_000, port: 3000 });
  });

  it('lists every invalid variable in one ConfigError', () => {
    expect(() => loadConfig({ PORT: '0' })).toThrow(expect.objectContaining({
      name: 'ConfigError',
      problems: [
        'PORT must be a whole number between 1 and 65535',
        'DATABASE_URL is required',
        'HN_URL is required',
        'FETCH_TIMEOUT_MS is required',
      ],
    }));
  });

  it.each([
    ['HN_URL', undefined],
    ['HN_URL', 'file:///tmp/front-page.html'],
    ['DATABASE_URL', 'https://database.example/hn_crawler'],
    ['DATABASE_URL', 'postgresql://localhost'],
    ['PORT', '0'],
    ['PORT', '65536'],
    ['PORT', '3.5'],
    ['CACHE_TTL_MS', '0'],
    ['CACHE_TTL_MS', '-1'],
    ['CACHE_TTL_MS', '1.5'],
    ['FETCH_TIMEOUT_MS', undefined],
    ['FETCH_TIMEOUT_MS', '0'],
    ['FETCH_TIMEOUT_MS', '1e3'],
    ['FETCH_TIMEOUT_MS', '0x100'],
    ['FETCH_TIMEOUT_MS', '2147483648'],
  ] as const)('rejects invalid configuration for %s (%s)', (name, value) => {
    const env = { ...validEnv, [name]: value };
    expect(() => loadConfig(env)).toThrow(name);
  });
});

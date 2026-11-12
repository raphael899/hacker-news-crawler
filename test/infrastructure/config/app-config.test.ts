import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../../../src/infrastructure/config/app-config.ts';

describe('loadConfig', () => {
  const validEnv = { PORT: '4123', DB_PATH: 'tmp/usage.sqlite', HN_URL: 'https://origin.test', FETCH_TIMEOUT_MS: ' 5000 ' };
  const expected = {
    port: 4123,
    databasePath: 'tmp/usage.sqlite',
    hackerNews: { url: 'https://origin.test/', timeoutMs: 5000 },
  };

  afterEach(() => vi.unstubAllEnvs());

  it('parses configuration supplied explicitly', () => {
    expect(loadConfig(validEnv)).toEqual(expected);
  });

  it('uses the process environment by default', () => {
    vi.stubEnv('PORT', validEnv.PORT);
    vi.stubEnv('DB_PATH', validEnv.DB_PATH);
    vi.stubEnv('HN_URL', validEnv.HN_URL);
    vi.stubEnv('FETCH_TIMEOUT_MS', validEnv.FETCH_TIMEOUT_MS);
    expect(loadConfig()).toEqual(expected);
  });

  it('defaults the port to 3000 when PORT is blank or absent', () => {
    expect(loadConfig({ ...validEnv, PORT: '' })).toEqual({ ...expected, port: 3000 });
    expect(loadConfig({ HN_URL: validEnv.HN_URL, FETCH_TIMEOUT_MS: validEnv.FETCH_TIMEOUT_MS }))
      .toEqual({ ...expected, databasePath: './data/hn-crawler.sqlite', port: 3000 });
  });

  it('defaults the database path when DB_PATH is blank or absent', () => {
    expect(loadConfig({ ...validEnv, DB_PATH: '' })).toEqual({ ...expected, databasePath: './data/hn-crawler.sqlite' });
    expect(loadConfig({ HN_URL: validEnv.HN_URL, FETCH_TIMEOUT_MS: validEnv.FETCH_TIMEOUT_MS }))
      .toEqual({ ...expected, databasePath: './data/hn-crawler.sqlite', port: 3000 });
  });

  it.each([
    ['HN_URL', undefined],
    ['HN_URL', 'file:///tmp/front-page.html'],
    ['PORT', '0'],
    ['PORT', '65536'],
    ['PORT', '3.5'],
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

import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../../../src/infrastructure/config/app-config.ts';

describe('loadConfig', () => {
  const validEnv = { HN_URL: 'https://origin.test', FETCH_TIMEOUT_MS: ' 5000 ' };
  const expected = { hackerNews: { url: 'https://origin.test/', timeoutMs: 5000 } };

  afterEach(() => vi.unstubAllEnvs());

  it('parses configuration supplied explicitly', () => {
    expect(loadConfig(validEnv)).toEqual(expected);
  });

  it('uses the process environment by default', () => {
    vi.stubEnv('HN_URL', validEnv.HN_URL);
    vi.stubEnv('FETCH_TIMEOUT_MS', validEnv.FETCH_TIMEOUT_MS);
    expect(loadConfig()).toEqual(expected);
  });

  it.each([
    ['HN_URL', undefined],
    ['HN_URL', 'file:///tmp/front-page.html'],
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

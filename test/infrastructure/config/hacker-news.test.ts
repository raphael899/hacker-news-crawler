import { describe, expect, it } from 'vitest';
import { readFetchTimeoutMs, readHackerNewsUrl } from '../../../src/infrastructure/config/hacker-news.ts';

describe('Hacker News configuration', () => {
  it('accepts configuration supplied explicitly', () => {
    const env = { HN_URL: 'https://origin.test', FETCH_TIMEOUT_MS: ' 5000 ' };
    expect(readHackerNewsUrl(env)).toBe('https://origin.test/');
    expect(readFetchTimeoutMs(env)).toBe(5000);
  });
});

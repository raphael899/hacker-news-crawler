export const CACHE_STATUSES = ['miss', 'coalesced', 'hit'] as const;

export type CacheStatus = typeof CACHE_STATUSES[number];

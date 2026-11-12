import type { EntryFilter } from '../../domain/filter.ts';
import { CRAWLER_OUTCOMES } from './crawler-error.ts';
import type { CacheStatus } from './front-page-cache.port.ts';

export const USAGE_OUTCOMES = ['success', ...CRAWLER_OUTCOMES] as const;

export type UsageOutcome = typeof USAGE_OUTCOMES[number];
export interface UsageRecord {
  readonly requestedAt: string;
  readonly snapshotAt: string | null;
  readonly filter: EntryFilter;
  readonly resultCount: number;
  readonly cacheStatus: CacheStatus;
  readonly outcome: UsageOutcome;
}

export interface UsageRepositoryPort {
  record(usageRecord: UsageRecord): Promise<void> | void;
}

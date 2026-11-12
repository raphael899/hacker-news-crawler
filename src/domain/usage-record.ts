import type { CacheStatus } from './cache-status.ts';
import type { UsageOutcome } from './crawler-outcome.ts';
import type { EntryFilter } from './filter.ts';

export interface UsageRecord {
  readonly requestedAt: string;
  readonly snapshotAt: string | null;
  readonly filter: EntryFilter;
  readonly resultCount: number;
  readonly cacheStatus: CacheStatus;
  readonly outcome: UsageOutcome;
}

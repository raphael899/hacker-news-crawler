import type { CacheStatus } from '../../domain/cache-status.ts';
import type { Entry } from '../../domain/entry.ts';
import type { EntryFilter } from '../../domain/filter.ts';

export interface GetEntriesResult {
  readonly entries: readonly Entry[];
  readonly fetchedAt: string;
  readonly cacheStatus: CacheStatus;
}

export interface GetEntriesPort {
  execute(filter?: EntryFilter): Promise<GetEntriesResult>;
}

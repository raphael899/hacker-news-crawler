import type { EntryFilter } from './filter.ts';

export interface UsageRecord {
  readonly requestedAt: string;
  readonly filter: EntryFilter;
  readonly resultCount: number;
}

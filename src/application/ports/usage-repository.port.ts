import type { ENTRY_FILTERS } from '../../domain/filter.ts';
import type { CrawlerError } from './crawler-error.ts';

export interface UsageRecord {
  readonly requestedAt: string;
  readonly filter: (typeof ENTRY_FILTERS)[number];
  readonly outcome: 'success' | 'invalid_html' | CrawlerError['outcome'];
  readonly resultCount: number;
}

export interface UsageRepositoryPort {
  save(record: UsageRecord): Promise<void>;
}

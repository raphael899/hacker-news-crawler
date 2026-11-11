export interface UsageRecord {
  readonly requestedAt: string;
  readonly filter: 'all' | 'long' | 'short';
  readonly outcome: 'success' | 'upstream_error' | 'invalid_html' | 'timeout';
  readonly resultCount: number;
}

export interface UsageRepositoryPort {
  save(record: UsageRecord): Promise<void>;
}

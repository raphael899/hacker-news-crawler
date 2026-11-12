import type { UsageRecord } from '../../domain/usage-record.ts';

export interface UsageRepositoryPort {
  record(usageRecord: UsageRecord): Promise<void> | void;
}

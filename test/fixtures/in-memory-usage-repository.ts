import type { UsageRepositoryPort } from '../../src/application/ports/usage-repository.port.ts';
import type { UsageRecord } from '../../src/domain/usage-record.ts';

export class InMemoryUsageRepository implements UsageRepositoryPort {
  readonly records: UsageRecord[] = [];

  record(usageRecord: UsageRecord): void {
    this.records.push(usageRecord);
  }
}

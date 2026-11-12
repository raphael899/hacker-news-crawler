import type { UsageRecord, UsageRepositoryPort } from '../../src/application/ports/usage-repository.port.ts';

export class InMemoryUsageRepository implements UsageRepositoryPort {
  readonly records: UsageRecord[] = [];

  record(usageRecord: UsageRecord): void {
    this.records.push(usageRecord);
  }
}

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { SQLiteUsageRepository } from '../../../src/infrastructure/database/sqlite-usage-repository.ts';

interface StoredUsageRecord {
  readonly requested_at: string;
  readonly filter: string;
  readonly result_count: number;
}

describe('SQLiteUsageRepository', () => {
  it('supports an in-memory database for isolated processes', () => {
    const repository = new SQLiteUsageRepository(':memory:');
    try {
      expect(() => repository.record({
        requestedAt: '2026-11-12T15:00:00.000Z',
        filter: 'all',
        resultCount: 30,
      })).not.toThrow();
    } finally {
      repository.close();
    }
  });

  it('persists usage data when the SQLite file is reopened', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'hn-crawler-'));
    const databasePath = join(directory, 'nested', 'usage.sqlite');
    const usageRecord = {
      requestedAt: '2026-11-12T15:00:00.000Z',
      filter: 'long' as const,
      resultCount: 7,
    };

    try {
      const repository = new SQLiteUsageRepository(databasePath);
      repository.record(usageRecord);
      repository.close();

      const reopenedRepository = new SQLiteUsageRepository(databasePath);
      reopenedRepository.close();

      const database = new DatabaseSync(databasePath);
      try {
        const row = database.prepare(`
          SELECT requested_at, filter, result_count
          FROM usage_records
        `).get() as StoredUsageRecord | undefined;
        expect(row).toEqual({
          requested_at: usageRecord.requestedAt,
          filter: usageRecord.filter,
          result_count: usageRecord.resultCount,
        });
      } finally {
        database.close();
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

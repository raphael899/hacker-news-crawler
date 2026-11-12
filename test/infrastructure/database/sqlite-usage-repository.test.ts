import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it, vi } from 'vitest';
import { SQLiteUsageRepository } from '../../../src/infrastructure/database/sqlite-usage-repository.ts';

interface StoredUsageRecord {
  readonly requested_at: string;
  readonly snapshot_at: string | null;
  readonly filter: string;
  readonly result_count: number;
  readonly cache_status: string;
  readonly outcome: string;
}

describe('SQLiteUsageRepository', () => {
  it('supports an in-memory database for isolated processes', () => {
    const repository = new SQLiteUsageRepository(':memory:');
    try {
      expect(() => repository.record({
        requestedAt: '2026-11-12T15:00:00.000Z',
        snapshotAt: '2026-11-12T15:00:00.000Z',
        filter: 'all',
        resultCount: 30,
        cacheStatus: 'miss',
        outcome: 'success',
      })).not.toThrow();
    } finally {
      repository.close();
    }
  });

  it('closes the connection when initialization encounters a newer schema version', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'hn-crawler-'));
    const databasePath = join(directory, 'usage.sqlite');
    const database = new DatabaseSync(databasePath);
    database.exec('PRAGMA user_version = 99');
    database.close();
    const closeSpy = vi.spyOn(DatabaseSync.prototype, 'close');

    try {
      expect(() => new SQLiteUsageRepository(databasePath)).toThrow('newer than this application supports');
      expect(closeSpy).toHaveBeenCalledOnce();
    } finally {
      closeSpy.mockRestore();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('rolls back a failed migration and closes the connection', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'hn-crawler-'));
    const databasePath = join(directory, 'usage.sqlite');
    const database = new DatabaseSync(databasePath);
    database.exec('CREATE VIEW usage_records AS SELECT 1 AS id');
    database.close();
    const closeSpy = vi.spyOn(DatabaseSync.prototype, 'close');

    try {
      expect(() => new SQLiteUsageRepository(databasePath)).toThrow();
      expect(closeSpy).toHaveBeenCalledOnce();

      const reopenedDatabase = new DatabaseSync(databasePath);
      try {
        const schemaVersion = reopenedDatabase.prepare('PRAGMA user_version').get() as { user_version: number };
        expect(schemaVersion.user_version).toBe(0);
      } finally {
        reopenedDatabase.close();
      }
    } finally {
      closeSpy.mockRestore();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('closes the connection when preparing the insert statement fails', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'hn-crawler-'));
    const databasePath = join(directory, 'usage.sqlite');
    const database = new DatabaseSync(databasePath);
    database.exec('PRAGMA user_version = 3');
    database.close();
    const closeSpy = vi.spyOn(DatabaseSync.prototype, 'close');

    try {
      expect(() => new SQLiteUsageRepository(databasePath)).toThrow('no such table: usage_records');
      expect(closeSpy).toHaveBeenCalledOnce();
    } finally {
      closeSpy.mockRestore();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('does not version an incompatible unversioned table', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'hn-crawler-'));
    const databasePath = join(directory, 'usage.sqlite');
    const database = new DatabaseSync(databasePath);
    database.exec('CREATE TABLE usage_records (id INTEGER PRIMARY KEY)');
    database.close();

    try {
      expect(() => new SQLiteUsageRepository(databasePath)).toThrow('missing columns');

      const reopenedDatabase = new DatabaseSync(databasePath);
      try {
        const schemaVersion = reopenedDatabase.prepare('PRAGMA user_version').get() as { user_version: number };
        expect(schemaVersion.user_version).toBe(0);
      } finally {
        reopenedDatabase.close();
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('persists usage data when the SQLite file is reopened', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'hn-crawler-'));
    const databasePath = join(directory, 'nested', 'usage.sqlite');
    const usageRecord = {
      requestedAt: '2026-11-12T15:00:00.000Z',
      snapshotAt: '2026-11-12T14:59:59.000Z',
      filter: 'long' as const,
      resultCount: 7,
      cacheStatus: 'miss' as const,
      outcome: 'success' as const,
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
          SELECT requested_at, snapshot_at, filter, result_count, cache_status, outcome
          FROM usage_records
        `).get() as StoredUsageRecord | undefined;
        const schemaVersion = database.prepare('PRAGMA user_version').get() as { user_version: number };
        expect(row).toEqual({
          requested_at: usageRecord.requestedAt,
          snapshot_at: usageRecord.snapshotAt,
          filter: usageRecord.filter,
          result_count: usageRecord.resultCount,
          cache_status: usageRecord.cacheStatus,
          outcome: usageRecord.outcome,
        });
        expect(schemaVersion.user_version).toBe(3);
      } finally {
        database.close();
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('migrates schema version 2 and persists crawler failures', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'hn-crawler-'));
    const databasePath = join(directory, 'usage.sqlite');
    const existingDatabase = new DatabaseSync(databasePath);
    existingDatabase.exec(`
      CREATE TABLE usage_records (
        id INTEGER PRIMARY KEY,
        requested_at TEXT NOT NULL,
        filter TEXT NOT NULL CHECK (filter IN ('all', 'long', 'short')),
        result_count INTEGER NOT NULL CHECK (result_count >= 0),
        snapshot_at TEXT,
        cache_status TEXT NOT NULL DEFAULT 'miss' CHECK (cache_status IN ('miss', 'coalesced', 'hit'))
      );
      INSERT INTO usage_records (requested_at, filter, result_count, snapshot_at, cache_status)
      VALUES ('2026-11-12T14:00:00.000Z', 'all', 30, '2026-11-12T13:59:59.000Z', 'miss');
      PRAGMA user_version = 2;
    `);
    existingDatabase.close();

    try {
      const repository = new SQLiteUsageRepository(databasePath);
      repository.record({
        requestedAt: '2026-11-12T15:00:00.000Z',
        snapshotAt: null,
        filter: 'short',
        resultCount: 0,
        cacheStatus: 'miss',
        outcome: 'timeout',
      });
      repository.close();

      const database = new DatabaseSync(databasePath);
      try {
        const rows = database.prepare(`
          SELECT requested_at, snapshot_at, filter, result_count, cache_status, outcome
          FROM usage_records ORDER BY id
        `).all();
        const schemaVersion = database.prepare('PRAGMA user_version').get() as { user_version: number };
        expect(rows).toEqual([
          {
            requested_at: '2026-11-12T14:00:00.000Z',
            snapshot_at: '2026-11-12T13:59:59.000Z',
            filter: 'all',
            result_count: 30,
            cache_status: 'miss',
            outcome: 'success',
          },
          {
            requested_at: '2026-11-12T15:00:00.000Z',
            snapshot_at: null,
            filter: 'short',
            result_count: 0,
            cache_status: 'miss',
            outcome: 'timeout',
          },
        ]);
        expect(schemaVersion.user_version).toBe(3);
      } finally {
        database.close();
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('adopts the existing unversioned schema without losing usage records', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'hn-crawler-'));
    const databasePath = join(directory, 'usage.sqlite');
    const existingDatabase = new DatabaseSync(databasePath);
    existingDatabase.exec(`
      CREATE TABLE usage_records (
        id INTEGER PRIMARY KEY,
        requested_at TEXT NOT NULL,
        filter TEXT NOT NULL CHECK (filter IN ('all', 'long', 'short')),
        result_count INTEGER NOT NULL CHECK (result_count >= 0)
      )
    `);
    existingDatabase.prepare(`
      INSERT INTO usage_records (requested_at, filter, result_count)
      VALUES (?, ?, ?)
    `).run('2026-11-12T14:00:00.000Z', 'all', 30);
    existingDatabase.close();

    try {
      const repository = new SQLiteUsageRepository(databasePath);
      try {
        repository.record({
          requestedAt: '2026-11-12T15:00:00.000Z',
          snapshotAt: '2026-11-12T14:59:59.000Z',
          filter: 'short',
          resultCount: 18,
          cacheStatus: 'coalesced',
          outcome: 'success',
        });
      } finally {
        repository.close();
      }

      const database = new DatabaseSync(databasePath);
      try {
        const rows = database.prepare(`
          SELECT requested_at, snapshot_at, filter, result_count, cache_status, outcome
          FROM usage_records
          ORDER BY id
        `).all();
        const schemaVersion = database.prepare('PRAGMA user_version').get() as { user_version: number };
        expect(rows).toEqual([
          {
            requested_at: '2026-11-12T14:00:00.000Z',
            snapshot_at: null,
            filter: 'all',
            result_count: 30,
            cache_status: 'miss',
            outcome: 'success',
          },
          {
            requested_at: '2026-11-12T15:00:00.000Z',
            snapshot_at: '2026-11-12T14:59:59.000Z',
            filter: 'short',
            result_count: 18,
            cache_status: 'coalesced',
            outcome: 'success',
          },
        ]);
        expect(schemaVersion.user_version).toBe(3);
      } finally {
        database.close();
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

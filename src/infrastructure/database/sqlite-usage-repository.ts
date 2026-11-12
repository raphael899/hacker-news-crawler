import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync, type StatementSync } from 'node:sqlite';
import type { UsageRepositoryPort } from '../../application/ports/usage-repository.port.ts';
import type { UsageRecord } from '../../domain/usage-record.ts';

export class SQLiteUsageRepository implements UsageRepositoryPort {
  private readonly database: DatabaseSync;
  private readonly insertStatement: StatementSync;

  constructor(databasePath: string) {
    const resolvedPath = databasePath === ':memory:' ? databasePath : resolve(databasePath);
    if (resolvedPath !== ':memory:') {
      mkdirSync(dirname(resolvedPath), { recursive: true });
    }

    this.database = new DatabaseSync(resolvedPath);
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS usage_records (
        id INTEGER PRIMARY KEY,
        requested_at TEXT NOT NULL,
        filter TEXT NOT NULL CHECK (filter IN ('all', 'long', 'short')),
        result_count INTEGER NOT NULL CHECK (result_count >= 0)
      )
    `);
    this.insertStatement = this.database.prepare(`
      INSERT INTO usage_records (requested_at, filter, result_count)
      VALUES (?, ?, ?)
    `);
  }

  record(usageRecord: UsageRecord): void {
    this.insertStatement.run(
      usageRecord.requestedAt,
      usageRecord.filter,
      usageRecord.resultCount,
    );
  }

  close(): void {
    this.database.close();
  }
}

import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync, type StatementSync } from 'node:sqlite';
import type { UsageRepositoryPort } from '../../application/ports/usage-repository.port.ts';
import type { UsageRecord } from '../../domain/usage-record.ts';

type Migration = (database: DatabaseSync) => void;

const migrations: readonly Migration[] = [
  createUsageRecordsTable,
];

export class SQLiteUsageRepository implements UsageRepositoryPort {
  private readonly database: DatabaseSync;
  private readonly insertStatement: StatementSync;

  constructor(databasePath: string) {
    const resolvedPath = databasePath === ':memory:' ? databasePath : resolve(databasePath);
    if (resolvedPath !== ':memory:') {
      mkdirSync(dirname(resolvedPath), { recursive: true });
    }

    const database = new DatabaseSync(resolvedPath);
    try {
      migrateDatabase(database);
      const insertStatement = database.prepare(`
        INSERT INTO usage_records (requested_at, filter, result_count)
        VALUES (?, ?, ?)
      `);
      this.database = database;
      this.insertStatement = insertStatement;
    } catch (error) {
      try {
        database.close();
      } catch (closeError) {
        throw new AggregateError(
          [error, closeError],
          'SQLite initialization failed and the database connection could not be closed',
          { cause: error },
        );
      }
      throw error;
    }
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

function migrateDatabase(database: DatabaseSync): void {
  const versionRow = database.prepare('PRAGMA user_version').get() as { user_version: number } | undefined;
  if (!versionRow) throw new Error('Could not read the SQLite schema version');

  if (versionRow.user_version > migrations.length) {
    throw new Error(`Database schema version ${versionRow.user_version} is newer than this application supports`);
  }

  for (const [index, migration] of migrations.entries()) {
    const targetVersion = index + 1;
    if (targetVersion <= versionRow.user_version) continue;

    database.exec('BEGIN IMMEDIATE');
    try {
      migration(database);
      database.exec(`PRAGMA user_version = ${targetVersion}`);
      database.exec('COMMIT');
    } catch (error) {
      try {
        database.exec('ROLLBACK');
      } catch (rollbackError) {
        throw new AggregateError(
          [error, rollbackError],
          `SQLite migration ${targetVersion} failed and could not be rolled back`,
          { cause: error },
        );
      }
      throw error;
    }
  }
}

function createUsageRecordsTable(database: DatabaseSync): void {
  const existingObject = database.prepare(`
    SELECT type
    FROM sqlite_master
    WHERE name = ?
  `).get('usage_records') as { type: string } | undefined;

  if (!existingObject) {
    database.exec(`
      CREATE TABLE usage_records (
        id INTEGER PRIMARY KEY,
        requested_at TEXT NOT NULL,
        filter TEXT NOT NULL CHECK (filter IN ('all', 'long', 'short')),
        result_count INTEGER NOT NULL CHECK (result_count >= 0)
      )
    `);
    return;
  }

  if (existingObject.type !== 'table') {
    throw new Error('SQLite object usage_records exists but is not a table');
  }

  const existingColumns = database.prepare('PRAGMA table_info(usage_records)')
    .all() as { name: string }[];
  const existingColumnNames = new Set(existingColumns.map(({ name }) => name));
  const requiredColumns = ['id', 'requested_at', 'filter', 'result_count'];
  const missingColumns = requiredColumns.filter((column) => !existingColumnNames.has(column));
  if (missingColumns.length > 0) {
    throw new Error(`Existing usage_records table is missing columns: ${missingColumns.join(', ')}`);
  }
}

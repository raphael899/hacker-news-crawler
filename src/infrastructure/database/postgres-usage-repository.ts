import { Pool } from 'pg';
import type { UsageRepositoryPort } from '../../application/ports/usage-repository.port.ts';
import { CACHE_STATUSES } from '../../domain/cache-status.ts';
import { USAGE_OUTCOMES } from '../../domain/crawler-outcome.ts';
import type { UsageRecord } from '../../domain/usage-record.ts';

interface Migration {
  readonly version: number;
  readonly sql: string;
}

const MIGRATION_LOCK_NAMESPACE = 7_328_191;
const MIGRATION_LOCK_ID = 1;

const migrations: readonly Migration[] = [{
  version: 1,
  sql: `
    CREATE TABLE usage_records (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      requested_at TIMESTAMPTZ NOT NULL,
      snapshot_at TIMESTAMPTZ,
      filter TEXT NOT NULL CHECK (filter IN ('all', 'long', 'short')),
      result_count INTEGER NOT NULL CHECK (result_count >= 0),
      cache_status TEXT NOT NULL CHECK (cache_status IN (${CACHE_STATUSES.map((status) => `'${status}'`).join(', ')})),
      outcome TEXT NOT NULL CHECK (outcome IN (${USAGE_OUTCOMES.map((outcome) => `'${outcome}'`).join(', ')}))
    );
    CREATE INDEX usage_records_requested_at_idx ON usage_records (requested_at DESC);
  `,
}];

export class PostgresUsageRepository implements UsageRepositoryPort {
  private initialized = false;
  private closed = false;
  private readonly pool: Pool;

  /**
   * `pg` emits `error` when an idle pooled connection drops (for example, when
   * PostgreSQL restarts). An unhandled `error` event would crash the process,
   * so the repository always listens and reports it instead.
   */
  constructor(pool: Pool, onPoolError: (error: Error) => void = reportPoolError) {
    this.pool = pool;
    this.pool.on('error', onPoolError);
  }

  static async connect(connectionString: string): Promise<PostgresUsageRepository> {
    const pool = new Pool({
      connectionString,
      max: 5,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 10_000,
    });
    const repository = new PostgresUsageRepository(pool);
    await repository.initialize();
    return repository;
  }

  async initialize(): Promise<void> {
    if (this.closed) throw new Error('PostgreSQL usage repository has been closed');
    if (this.initialized) return;

    try {
      await this.runMigrations();
      this.initialized = true;
    } catch (error) {
      try {
        await this.close();
      } catch (closeError) {
        throw new AggregateError(
          [error, closeError],
          'PostgreSQL initialization failed and the connection pool could not be closed',
          { cause: error },
        );
      }
      throw error;
    }
  }

  async record(usageRecord: UsageRecord): Promise<void> {
    if (this.closed) throw new Error('PostgreSQL usage repository has been closed');
    if (!this.initialized) throw new Error('PostgreSQL usage repository has not been initialized');

    await this.pool.query(
      `
        INSERT INTO usage_records (requested_at, snapshot_at, filter, result_count, cache_status, outcome)
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        usageRecord.requestedAt,
        usageRecord.snapshotAt,
        usageRecord.filter,
        usageRecord.resultCount,
        usageRecord.cacheStatus,
        usageRecord.outcome,
      ],
    );
  }

  async close(): Promise<void> {
    if (this.closed) return;
    await this.pool.end();
    this.initialized = false;
    this.closed = true;
  }

  private async runMigrations(): Promise<void> {
    const client = await this.pool.connect();
    let transactionStarted = false;

    try {
      await client.query('BEGIN');
      transactionStarted = true;
      await client.query('SELECT pg_advisory_xact_lock($1, $2)', [MIGRATION_LOCK_NAMESPACE, MIGRATION_LOCK_ID]);
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      const versionResult = await client.query<{ version: number }>(
        'SELECT COALESCE(MAX(version), 0)::integer AS version FROM schema_migrations',
      );
      const currentVersion = versionResult.rows[0]?.version;
      if (currentVersion === undefined) throw new Error('Could not read the PostgreSQL schema version');
      if (currentVersion > migrations.length) {
        throw new Error(`Database schema version ${currentVersion} is newer than this application supports`);
      }

      for (const migration of migrations) {
        if (migration.version <= currentVersion) continue;
        await client.query(migration.sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [migration.version]);
      }

      await client.query('COMMIT');
      transactionStarted = false;
    } catch (error) {
      if (transactionStarted) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          throw new AggregateError(
            [error, rollbackError],
            'PostgreSQL migrations failed and could not be rolled back',
            { cause: error },
          );
        }
      }
      throw error;
    } finally {
      client.release();
    }
  }
}

function reportPoolError(error: Error): void {
  console.error('PostgreSQL idle connection error', error);
}

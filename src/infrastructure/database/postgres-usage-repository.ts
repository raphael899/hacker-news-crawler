import { Pool } from 'pg';
import type { UsageRecord, UsageRepositoryPort } from '../../application/ports/usage-repository.port.ts';

/**
 * Runs on every start and is safe to repeat. The CHECK values are literals on
 * purpose; a repository test keeps them in sync with the application types.
 */
const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS usage_records (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    requested_at TIMESTAMPTZ NOT NULL,
    snapshot_at TIMESTAMPTZ,
    filter TEXT NOT NULL CHECK (filter IN ('all', 'long', 'short')),
    result_count INTEGER NOT NULL CHECK (result_count >= 0),
    cache_status TEXT NOT NULL CHECK (cache_status IN ('miss', 'coalesced', 'hit')),
    outcome TEXT NOT NULL CHECK (outcome IN ('success', 'upstream_error', 'timeout', 'invalid_html'))
  );
  -- Added after the first release, so existing tables gain it here; older rows keep NULL.
  ALTER TABLE usage_records ADD COLUMN IF NOT EXISTS duration_ms INTEGER CHECK (duration_ms >= 0);
  CREATE INDEX IF NOT EXISTS usage_records_requested_at_idx ON usage_records (requested_at DESC);
`;

export class PostgresUsageRepository implements UsageRepositoryPort {
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

  /** Opens a connection pool and creates the schema; closes the pool again if that fails. */
  static async connect(connectionString: string): Promise<PostgresUsageRepository> {
    const pool = new Pool({
      connectionString,
      max: 5,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 10_000,
    });
    const repository = new PostgresUsageRepository(pool);
    try {
      await repository.ensureSchema();
    } catch (error) {
      // The schema error explains the failure; an error from closing the pool would only hide it.
      await pool.end().catch(() => undefined);
      throw error;
    }
    return repository;
  }

  async ensureSchema(): Promise<void> {
    await this.pool.query(SCHEMA_SQL);
  }

  async record(usageRecord: UsageRecord): Promise<void> {
    await this.pool.query(
      `
        INSERT INTO usage_records
          (requested_at, snapshot_at, filter, result_count, cache_status, outcome, duration_ms)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        usageRecord.requestedAt,
        usageRecord.snapshotAt,
        usageRecord.filter,
        usageRecord.resultCount,
        usageRecord.cacheStatus,
        usageRecord.outcome,
        usageRecord.durationMs,
      ],
    );
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

function reportPoolError(error: Error): void {
  console.error('PostgreSQL idle connection error', error);
}

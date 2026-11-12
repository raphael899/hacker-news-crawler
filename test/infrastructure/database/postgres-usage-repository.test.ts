import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { CACHE_STATUSES } from '../../../src/application/ports/front-page-cache.port.ts';
import { USAGE_OUTCOMES } from '../../../src/application/ports/usage-repository.port.ts';
import { ENTRY_FILTERS } from '../../../src/domain/filter.ts';
import { PostgresUsageRepository } from '../../../src/infrastructure/database/postgres-usage-repository.ts';

interface UsageRow {
  readonly requested_at: Date;
  readonly snapshot_at: Date | null;
  readonly filter: string;
  readonly result_count: number;
  readonly cache_status: string;
  readonly outcome: string;
  readonly duration_ms: number | null;
}

const connectionString = process.env.TEST_DATABASE_URL;
const describePostgres = connectionString ? describe : describe.skip;

const adminPool = new Pool(connectionString ? { connectionString } : {});
let schemaName: string;
let testPool: Pool;
let repository: PostgresUsageRepository | undefined;

describe('PostgresUsageRepository pool errors', () => {
  it('reports idle connection errors instead of crashing the process', async () => {
    const pool = new Pool({ connectionString: 'postgresql://crawler:crawler@127.0.0.1:1/unused' });
    const onPoolError = vi.fn();
    new PostgresUsageRepository(pool, onPoolError);
    const failure = new Error('terminating connection due to administrator command');

    try {
      expect(() => pool.emit('error', failure)).not.toThrow();
      expect(onPoolError).toHaveBeenCalledWith(failure);
    } finally {
      await pool.end();
    }
  });
});

describePostgres('PostgresUsageRepository', () => {
  beforeAll(async () => {
    await adminPool.query('SELECT 1');
  });

  beforeEach(async () => {
    schemaName = `hn_test_${randomUUID().replaceAll('-', '')}`;
    await adminPool.query(`CREATE SCHEMA "${schemaName}"`);
    testPool = new Pool(connectionString
      ? { connectionString, options: `-c search_path=${schemaName}` }
      : { options: `-c search_path=${schemaName}` });
    repository = undefined;
  });

  afterEach(async () => {
    if (repository) await repository.close();
    await adminPool.query(`DROP SCHEMA "${schemaName}" CASCADE`);
  });

  afterAll(async () => {
    await adminPool.end();
  });

  const record = {
    requestedAt: '2026-11-12T15:00:00.000Z',
    snapshotAt: null,
    filter: 'all',
    resultCount: 0,
    cacheStatus: 'miss',
    outcome: 'success',
    durationMs: 12,
  } as const;

  async function selectUsageRows(): Promise<UsageRow[]> {
    const { rows } = await testPool.query<UsageRow>(`
      SELECT requested_at, snapshot_at, filter, result_count, cache_status, outcome, duration_ms
      FROM usage_records
      ORDER BY id
    `);
    return rows;
  }

  it('creates the schema on connect and persists complete usage records', async () => {
    const databaseUrl = new URL(connectionString!);
    databaseUrl.searchParams.set('options', `-c search_path=${schemaName}`);
    repository = await PostgresUsageRepository.connect(databaseUrl.href);
    await repository.record({
      ...record,
      snapshotAt: '2026-11-12T14:59:59.000Z',
      filter: 'long',
      resultCount: 7,
      cacheStatus: 'coalesced',
      durationMs: 184,
    });

    expect(await selectUsageRows()).toEqual([{
      requested_at: new Date('2026-11-12T15:00:00.000Z'),
      snapshot_at: new Date('2026-11-12T14:59:59.000Z'),
      filter: 'long',
      result_count: 7,
      cache_status: 'coalesced',
      outcome: 'success',
      duration_ms: 184,
    }]);
  });

  it('persists failed requests with a null snapshot timestamp and zero results', async () => {
    repository = new PostgresUsageRepository(testPool);
    await repository.ensureSchema();
    await repository.record({ ...record, filter: 'short', outcome: 'timeout' });

    expect(await selectUsageRows()).toMatchObject([{
      snapshot_at: null,
      filter: 'short',
      result_count: 0,
      outcome: 'timeout',
      duration_ms: 12,
    }]);
  });

  it('accepts every filter, cache status, and outcome the application defines', async () => {
    repository = new PostgresUsageRepository(testPool);
    await repository.ensureSchema();

    for (const filter of ENTRY_FILTERS) await repository.record({ ...record, filter });
    for (const cacheStatus of CACHE_STATUSES) await repository.record({ ...record, cacheStatus });
    for (const outcome of USAGE_OUTCOMES) await repository.record({ ...record, outcome });

    expect(await selectUsageRows()).toHaveLength(ENTRY_FILTERS.length + CACHE_STATUSES.length + USAGE_OUTCOMES.length);
  });

  it('can run on every start and adds duration_ms to a table created before it existed', async () => {
    await testPool.query(`
      CREATE TABLE usage_records (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        requested_at TIMESTAMPTZ NOT NULL,
        snapshot_at TIMESTAMPTZ,
        filter TEXT NOT NULL,
        result_count INTEGER NOT NULL,
        cache_status TEXT NOT NULL,
        outcome TEXT NOT NULL
      );
      INSERT INTO usage_records (requested_at, filter, result_count, cache_status, outcome)
      VALUES ('2026-11-11T10:00:00Z', 'all', 30, 'miss', 'success');
    `);
    repository = new PostgresUsageRepository(testPool);
    await repository.ensureSchema();
    await repository.ensureSchema();
    await repository.record(record);

    expect((await selectUsageRows()).map(({ duration_ms }) => duration_ms)).toEqual([null, 12]);
  });

  it('rejects a failed database connection during repository startup', async () => {
    await expect(PostgresUsageRepository.connect(
      'postgresql://crawler:crawler@127.0.0.1:1/hn_crawler_test',
    )).rejects.toThrow();
  });
});

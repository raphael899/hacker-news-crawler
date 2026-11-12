import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PostgresUsageRepository } from '../../../src/infrastructure/database/postgres-usage-repository.ts';

interface UsageRow {
  readonly requested_at: Date;
  readonly snapshot_at: Date | null;
  readonly filter: string;
  readonly result_count: number;
  readonly cache_status: string;
  readonly outcome: string;
}

const connectionString = process.env.TEST_DATABASE_URL;
const describePostgres = connectionString ? describe : describe.skip;

const adminPool = new Pool(connectionString ? { connectionString } : {});
let schemaName: string;
let testPool: Pool;
let repository: PostgresUsageRepository | undefined;

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

  it('migrates the schema once and persists complete usage records', async () => {
    const databaseUrl = new URL(connectionString!);
    databaseUrl.searchParams.set('options', `-c search_path=${schemaName}`);
    repository = await PostgresUsageRepository.connect(databaseUrl.href);
    await repository.initialize();
    await repository.record({
      requestedAt: '2026-11-12T15:00:00.000Z',
      snapshotAt: '2026-11-12T14:59:59.000Z',
      filter: 'long',
      resultCount: 7,
      cacheStatus: 'coalesced',
      outcome: 'success',
    });

    const usageRows = await testPool.query<UsageRow>(`
      SELECT requested_at, snapshot_at, filter, result_count, cache_status, outcome
      FROM usage_records
    `);
    const migrationRows = await testPool.query<{ version: number }>('SELECT version FROM schema_migrations');

    expect(usageRows.rows).toHaveLength(1);
    expect(usageRows.rows[0]).toMatchObject({
      requested_at: new Date('2026-11-12T15:00:00.000Z'),
      snapshot_at: new Date('2026-11-12T14:59:59.000Z'),
      filter: 'long',
      result_count: 7,
      cache_status: 'coalesced',
      outcome: 'success',
    });
    expect(migrationRows.rows).toEqual([{ version: 1 }]);
  });

  it('persists failed requests with a null snapshot timestamp and zero results', async () => {
    repository = new PostgresUsageRepository(testPool);
    await repository.initialize();
    await repository.record({
      requestedAt: '2026-11-12T15:00:00.000Z',
      snapshotAt: null,
      filter: 'short',
      resultCount: 0,
      cacheStatus: 'miss',
      outcome: 'timeout',
    });

    const result = await testPool.query<UsageRow>(`
      SELECT requested_at, snapshot_at, filter, result_count, cache_status, outcome
      FROM usage_records
    `);

    expect(result.rows[0]).toMatchObject({
      requested_at: new Date('2026-11-12T15:00:00.000Z'),
      snapshot_at: null,
      filter: 'short',
      result_count: 0,
      cache_status: 'miss',
      outcome: 'timeout',
    });
  });

  it('rejects a schema version newer than the application and closes the pool', async () => {
    await testPool.query(`
      CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
      INSERT INTO schema_migrations (version) VALUES (99)
    `);
    repository = new PostgresUsageRepository(testPool);

    await expect(repository.initialize()).rejects.toThrow('newer than this application supports');
    await expect(testPool.query('SELECT 1')).rejects.toThrow('calling end on the pool');
  });

  it('preserves both migration and cleanup errors when initialization cannot close the pool', async () => {
    await testPool.query(`
      CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
      INSERT INTO schema_migrations (version) VALUES (99)
    `);
    repository = new PostgresUsageRepository(testPool);
    const closePool = testPool.end.bind(testPool);
    testPool.end = async () => {
      throw new Error('pool close failure');
    };

    try {
      await expect(repository.initialize()).rejects.toBeInstanceOf(AggregateError);
    } finally {
      testPool.end = closePool;
    }
  });

  it('rejects a failed database connection during repository startup', async () => {
    await expect(PostgresUsageRepository.connect(
      'postgresql://crawler:crawler@127.0.0.1:1/hn_crawler_test',
    )).rejects.toThrow();
  });

  it('reports a rollback failure together with the migration error', async () => {
    const release = vi.fn();
    const client = {
      query: vi.fn(async (queryText: string) => {
        if (queryText.startsWith('SELECT COALESCE')) return { rows: [{ version: 99 }] };
        if (queryText === 'ROLLBACK') throw new Error('rollback failure');
        return { rows: [] };
      }),
      release,
    } as unknown as PoolClient;
    Object.defineProperty(testPool, 'connect', { value: async () => client });
    repository = new PostgresUsageRepository(testPool);

    await expect(repository.initialize()).rejects.toBeInstanceOf(AggregateError);
    expect(release).toHaveBeenCalledOnce();
  });
});

# Testing and local verification

Run commands from the repository root. Copy `.env.example` to `.env`, then set `DATABASE_URL` to a PostgreSQL connection URL. For local development, use the provider's external URL. For a Render web service in the same region as the database, use its internal URL. Never commit `.env` or paste a connection URL into source code.

## Automated checks

```sh
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm lint
pnpm build
```

The PostgreSQL repository tests run when `TEST_DATABASE_URL` is set. They create a unique temporary schema per test and drop only that schema during cleanup; use a disposable database and never point this variable at a production database. When the variable is absent, Vitest skips these integration tests. GitHub Actions starts PostgreSQL 18 for the CI run and sets `TEST_DATABASE_URL`, so those tests always run there.

The repository integration tests cover schema creation, idempotent startup, persisted success and failure records, newer-schema rejection, and connection-pool cleanup. The remaining tests use deterministic fixtures and clocks and do not depend on a live Hacker News response or wall-clock delays.

## Verify the managed database

Wait until the database provider reports the instance as available. Confirm that the web service and Render database use the same region before configuring the service with the database's internal URL. The Render free database is for testing/prototyping and expires after 30 days; its dashboard shows the exact expiry date.

For a service using `DATABASE_URL`, make a successful request:

```sh
curl -i 'https://YOUR-SERVICE.onrender.com/entries'
```

Then run this query with `psql` connected to the same database:

```sql
SELECT requested_at, snapshot_at, filter, outcome, result_count, cache_status
FROM usage_records
ORDER BY id DESC
LIMIT 10;
```

Each successful request should add a row containing its request time, snapshot time, filter, result count, cache status, and `success` outcome. Recognized crawler failures also add a row with a null snapshot time, zero results, and an outcome such as `timeout`. If the table is missing, check the service logs for migration errors and confirm that the service is using the expected `DATABASE_URL`.

## Measure parser, downloads, and cache hits

Run `pnpm benchmark` from the repository root with `.env` configured. The benchmark parses the checked-in HTML fixture, makes a few sequential live downloads, and measures repeated cache hits. Optional positional arguments set parse iterations, cache-hit iterations, and live download samples, in that order; for example, `pnpm benchmark 1000 500 3`. Live samples are spaced by one second. See [benchmark methodology and live results](benchmark-results.md). Do not add live benchmark execution to CI.

The timing comparison isolates parser work and application request paths. It uses a no-op usage repository, so download/cache timings exclude PostgreSQL writes and Fastify overhead. Network timings vary with Hacker News and the local connection; use the recorded environment and sample counts when comparing runs.

## Check cache reuse and expiration manually

The cache belongs to one server process. Restart `pnpm dev` to start with an empty cache; this does not erase PostgreSQL history. Immediately send two requests:

```sh
curl -i 'http://localhost:3000/entries'
curl -i 'http://localhost:3000/entries?filter=long'
```

The first successful request after restart should return `X-Cache-Status: miss`. The next request within the TTL should return `hit`. Both should have the same `X-Front-Page-Fetched-At`, since filtering runs on the same cached front-page snapshot. The rows in `usage_records` should show the corresponding statuses.

To verify recovery after a timeout through the HTTP boundary, use the automated case in `test/infrastructure/http/app.test.ts`. It makes the first source attempt fail with a timeout and the next attempt succeed, then checks for a `504`, a later `200`, and both usage records. This is deterministic and does not rely on making Hacker News time out in a live environment.

To observe expiration, set a short positive `CACHE_TTL_MS` in `.env` (for example, `5000`), restart the server, make a successful request, wait longer than five seconds, then make another successful request. The later response should return `miss` with a newer snapshot timestamp. Restore the desired TTL afterwards. Restarting the server also clears the in-memory cache, so do not restart between the two requests in this check.

Concurrent requests can finish too quickly to reliably demonstrate `coalesced` with manual `curl` commands. Use the automated HTTP concurrency test; it verifies one download, a shared snapshot timestamp, and `miss` plus `coalesced` outcomes.

## Code landmarks

- `src/domain/front-page.ts` enforces the 30-entry snapshot rule; `src/domain/filter.ts` applies the title-length filters and ordering.
- `src/application/get-entries.use-case.ts` coordinates fetching, snapshot validation, caching, filtering, and usage recording.
- `src/application/ports/usage-repository.port.ts` defines the application-owned storage contract.
- `src/infrastructure/database/postgres-usage-repository.ts` manages the PostgreSQL pool, migrations, and usage writes.
- `src/infrastructure/cache/in-memory-front-page-cache.ts` handles TTL reuse and in-flight request sharing.
- `src/infrastructure/hacker-news/hacker-news-news-source.ts` downloads and parses the Hacker News page.

For the reasoning behind these boundaries and technology choices, see [Architecture](architecture.md).

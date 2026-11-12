# Testing and local verification

Run commands from the repository root. Copy `.env.example` to `.env`; its values (`HN_URL=https://news.ycombinator.com/`, `FETCH_TIMEOUT_MS=5000`, and the defaults for the optional settings) work without edits. `DB_PATH` is relative to the directory where `pnpm dev` starts. For example, `DB_PATH=./data/usage.sqlite` means the database to inspect is `data/usage.sqlite`, not the README's default `data/hn-crawler.sqlite`.

## Automated checks

```sh
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm lint
pnpm build
```

The cache tests use an injected monotonic clock to check hits and expiration without waiting in real time. The HTTP concurrency test holds the source response behind a promise, sends two requests, and verifies that one source download serves both. This makes the `miss`/`coalesced` behavior repeatable. Tests use fixtures and do not need a live request to Hacker News.

## Performance measurements and live check

Run `pnpm benchmark` from the repository root with `.env` configured. It parses the checked-in HTML fixture repeatedly, makes a few sequential live downloads, then measures repeated use-case calls served from the in-memory cache. Optional positional arguments set parse iterations, cache-hit iterations, and live download samples, in that order; for example, `pnpm benchmark 1000 500 3`. Live samples are spaced by one second. The live check validates that each request returns exactly 30 entries and the cache samples are actual hits. The report includes the runtime, platform, configuration, mean, p50, p95, minimum, and maximum durations.

The timing comparison isolates parser work and application request paths. It uses a no-op usage repository, so download/cache request timings exclude SQLite writes and Fastify overhead. Network timings vary with Hacker News and the local connection; use the recorded environment and sample counts when comparing runs. Never add live benchmark execution to CI.

See [benchmark methodology and live results](benchmark-results.md) for the recorded run.

## Check SQLite records

Start the service with `pnpm dev`, then make a successful request:

```sh
curl -i 'http://localhost:3000/entries'
```

Inspect the database configured by `DB_PATH`. For `DB_PATH=./data/usage.sqlite`:

```sh
sqlite3 ./data/usage.sqlite '.tables'
sqlite3 ./data/usage.sqlite \
  'SELECT requested_at, snapshot_at, filter, result_count, cache_status, outcome FROM usage_records ORDER BY id DESC LIMIT 10;'
```

The table appears after the service initializes the database. A successful endpoint request adds one row with its request time, snapshot time, filter, result count, cache status, and `success` outcome. Recognized crawler failures also add a row; failed downloads have a null snapshot time, zero results, and an outcome such as `timeout`. If SQLite says `no such table`, first check that the server is running and that the command points to the same `DB_PATH` as `.env`.

## Check cache reuse and expiration manually

The cache belongs to one server process. Restart `pnpm dev` to start with an empty cache; this does not erase SQLite history. Immediately send two requests:

```sh
curl -i 'http://localhost:3000/entries'
curl -i 'http://localhost:3000/entries?filter=long'
```

The first successful request after restart should return `X-Cache-Status: miss`. The next request within the TTL should return `hit`. Both should have the same `X-Front-Page-Fetched-At`, since filtering runs on the same cached front-page snapshot. The request rows in SQLite should show the corresponding statuses.

To verify recovery after a timeout through the HTTP boundary, use the automated case in `test/infrastructure/http/app.test.ts`. It makes the first source attempt fail with a timeout and the next attempt succeed, then checks for a `504`, a later `200`, and both usage records. This is deterministic and does not rely on making Hacker News time out in a live environment.

To observe expiration, set a short positive `CACHE_TTL_MS` in `.env` (for example, `5000`), restart the server, make a successful request, wait longer than five seconds, then make another successful request. The later response should return `miss` with a newer snapshot timestamp. Restore the desired TTL afterwards. Restarting the server also clears the in-memory cache, so do not restart between the two requests in this check.

Concurrent requests can finish too quickly to reliably demonstrate `coalesced` with manual `curl` commands. Use the automated HTTP concurrency test for that guarantee; it verifies one download, a shared snapshot timestamp, and `miss` plus `coalesced` outcomes.

## Code landmarks

- `src/domain/front-page.ts` enforces the 30-entry snapshot rule; `src/domain/filter.ts` applies the title-length filters and ordering.
- `src/application/get-entries.use-case.ts` coordinates fetching, snapshot validation, caching, filtering, and usage recording.
- `src/application/ports/front-page-cache.port.ts` defines the cache contract; `src/infrastructure/cache/in-memory-front-page-cache.ts` implements TTL reuse and in-flight request sharing.
- `src/infrastructure/hacker-news/hacker-news-news-source.ts` downloads and parses the Hacker News page.
- `src/infrastructure/database/sqlite-usage-repository.ts` persists request records and applies schema migrations.
- `src/infrastructure/http/app.ts` validates requests, calls the use case, and exposes cache metadata in response headers.

For the reasoning behind these boundaries and technology choices, see [Architecture](architecture.md).

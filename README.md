# Hacker News Crawler

## Requirements

- Node.js 24.15.0
- [pnpm](https://pnpm.io/installation) 10.24.0

## Install and configure

Run these commands from the repository root:

```sh
pnpm install --frozen-lockfile
cp .env.example .env
```

Fill in the values in your local `.env`. Set `HN_URL` to `https://news.ycombinator.com/` and `FETCH_TIMEOUT_MS` to a positive decimal integer in milliseconds. For a five-second deadline, use `5000`. `PORT` is optional and defaults to `3000`. `DB_PATH` is optional and defaults to `./data/hn-crawler.sqlite`; its parent directory is created when the server starts. `CACHE_TTL_MS` is optional and defaults to `60000` (one minute).

## Start the service

For development, start the TypeScript server with Node's watch mode:

```sh
pnpm dev
```

For a production-style run, compile and start the generated JavaScript:

```sh
pnpm build
pnpm start
```

The server listens on `PORT` (default `3000`). Request the first 30 entries with:

```sh
curl http://localhost:3000/entries
```

The optional `filter` query parameter defaults to `all`. Use `long` to select titles with more than five words, ordered by comment count, or `short` to select titles with five words or fewer, ordered by points. Both orders are descending, with rank ascending to break ties. Unsupported filter values receive a `400` response. Hacker News failures receive `502`, and download timeouts receive `504`.

Successful requests and recognized crawler failures are recorded in SQLite with their UTC request timestamp, filter, outcome, result count, snapshot timestamp, and cache status. The database is stored at `DB_PATH` or, by default, `./data/hn-crawler.sqlite`.

Outcomes are `success`, `upstream_error`, `timeout`, and `invalid_html`. Failed crawler requests have a `NULL` snapshot timestamp and a result count of zero.

Inspect the latest recorded requests with the SQLite CLI (adjust the path if you set a custom `DB_PATH`):

```sh
sqlite3 ./data/hn-crawler.sqlite \
  'SELECT requested_at, snapshot_at, filter, outcome, result_count, cache_status FROM usage_records ORDER BY id DESC LIMIT 10;'
```

The response includes `X-Front-Page-Fetched-At` (the shared snapshot timestamp) and `X-Cache-Status` (`miss`, `coalesced`, or `hit`). The in-memory cache is shared by requests handled by the same server process.

```sh
curl 'http://localhost:3000/entries?filter=long'
curl 'http://localhost:3000/entries?filter=short'
```

## Run tests

```sh
pnpm test
pnpm test:coverage
```

Use `pnpm test` to run the suite once and `pnpm test:coverage` to check it against the configured coverage thresholds. Test directories mirror `src/`.

## Measure parser, downloads, and cache hits

With `.env` configured, run `pnpm benchmark`. See [benchmark methodology and live results](docs/benchmark-results.md). The benchmark makes a small number of live requests to Hacker News, so run it manually and outside CI.

## Lint, check types, and build

```sh
pnpm lint
pnpm typecheck
pnpm build
```

The build writes compiled JavaScript to `dist/`.

## Further reading

- [Architecture and design decisions](docs/architecture.md)
- [Testing and local verification](docs/testing.md)
- [Repository guidance for agents](AGENTS.md)

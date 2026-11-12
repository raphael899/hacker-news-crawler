# Hacker News Crawler

## Quick start with Docker (recommended)

Requirements: [Docker](https://docs.docker.com/get-docker/) with Compose v2. Node.js and PostgreSQL do not need to be installed on the host.

Start PostgreSQL 18 and the API from the repository root:

```sh
docker compose up --build
```

The API waits until PostgreSQL is healthy, applies the versioned migrations, and listens on `http://localhost:3000`. Request the first 30 entries:

```sh
curl -i http://localhost:3000/entries
```

```sh
curl 'http://localhost:3000/entries?filter=long'
```

```sh
curl 'http://localhost:3000/entries?filter=short'
```

The optional `filter` query parameter defaults to `all`. Use `long` to select titles with more than five words, ordered by comment count, or `short` to select titles with five words or fewer, ordered by points. Both orders are descending, with rank ascending to break ties. Unsupported filter values receive a `400` response. Hacker News failures receive `502`, and download timeouts receive `504`.

The response includes `X-Front-Page-Fetched-At` (the shared snapshot timestamp) and `X-Cache-Status` (`miss`, `coalesced`, or `hit`). The in-memory cache is shared by requests handled by the same server process.

Successful requests and recognized crawler failures are recorded in PostgreSQL with their UTC request timestamp, filter, outcome, result count, snapshot timestamp, and cache status. Outcomes are `success`, `upstream_error`, `timeout`, and `invalid_html`; failed requests have a `NULL` snapshot timestamp and a result count of zero. Inspect the latest records:

```sh
docker compose exec postgres psql -U crawler -d hn_crawler -c 'SELECT requested_at, snapshot_at, filter, outcome, result_count, cache_status FROM usage_records ORDER BY id DESC LIMIT 10;'
```

Run the whole test suite, including the PostgreSQL integration tests, in a container:

```sh
docker compose run --rm --build test
```

Stop the stack with `docker compose down`. The usage history is kept in the `postgres-data` volume; `docker compose down -v` deletes it. If ports `3000` or `5432` are taken, set `APP_PORT` or `POSTGRES_PORT`, for example `APP_PORT=3100 docker compose up --build`.

The Compose credentials (`crawler`/`crawler`) are for this disposable local database only.

## Develop on the host

Requirements: Node.js 24.15.0 and [pnpm](https://pnpm.io/installation) 10.24.0. Start only the database in Docker, then install dependencies and copy the environment template:

```sh
docker compose up -d postgres
```

```sh
pnpm install --frozen-lockfile
```

```sh
cp .env.example .env
```

The template already points `DATABASE_URL` at the Compose database (`postgresql://crawler:crawler@localhost:5432/hn_crawler`), so it works without edits. `HN_URL`, `FETCH_TIMEOUT_MS`, and `DATABASE_URL` are required. `PORT` defaults to `3000`, and `CACHE_TTL_MS` defaults to `60000` (one minute). Never commit `.env`.

Start the TypeScript server with Node's watch mode:

```sh
pnpm dev
```

For a production-style run, compile and start the generated JavaScript:

```sh
pnpm build
pnpm start
```

## Run tests on the host

```sh
pnpm test
pnpm test:coverage
```

The PostgreSQL repository tests run only when `TEST_DATABASE_URL` is set; otherwise Vitest skips them and `pnpm test:coverage` falls below its thresholds. With the Compose database running, use its `hn_crawler_test` database:

```sh
TEST_DATABASE_URL=postgresql://crawler:crawler@localhost:5432/hn_crawler_test pnpm test:coverage
```

GitHub Actions starts its own PostgreSQL service for each CI run. The suite uses saved Hacker News HTML fixtures and does not make live requests to the site.

## Deploy with managed PostgreSQL

The service only needs `DATABASE_URL` and the Hacker News settings from the environment. The runtime image (`docker build --target runtime .`) reads them from its environment, not from a `.env` file. On Render, use the database's internal connection URL for a web service in the same region. Free Render PostgreSQL instances are intended for testing and expire after 30 days; check the dashboard for the exact date.

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

# Hacker News Crawler

## Requirements

- Node.js 24.15.0
- [pnpm](https://pnpm.io/installation) 10.24.0
- A PostgreSQL database

## Install and configure

Run these commands from the repository root:

```sh
pnpm install --frozen-lockfile
cp .env.example .env
```

Set `DATABASE_URL` in your local `.env`. For local development, use your provider's external PostgreSQL URL; for a Render service in the same region as its database, use the internal URL. Keep the URL private and never commit `.env`. The example file intentionally leaves this value empty. The other example values configure Hacker News and the default port/cache settings.

`HN_URL` and `FETCH_TIMEOUT_MS` are required. `PORT` defaults to `3000`, and `CACHE_TTL_MS` defaults to `60000` (one minute).

The service applies versioned PostgreSQL migrations before it begins listening. No manual schema setup is needed.

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

Successful requests and recognized crawler failures are recorded in PostgreSQL with their UTC request timestamp, filter, outcome, result count, snapshot timestamp, and cache status. The response includes `X-Front-Page-Fetched-At` (the shared snapshot timestamp) and `X-Cache-Status` (`miss`, `coalesced`, or `hit`). The in-memory cache is shared by requests handled by the same server process.

Inspect recent request history from a shell where `DATABASE_URL` is set:

```sh
psql "$DATABASE_URL" -c 'SELECT requested_at, snapshot_at, filter, outcome, result_count, cache_status FROM usage_records ORDER BY id DESC LIMIT 10;'
```

For Render, use the internal connection URL for a web service in the same region as the database. Free PostgreSQL instances are intended for testing and prototyping and expire after 30 days; check the provider dashboard for the instance's exact expiry date.

## Run tests

```sh
pnpm test
pnpm test:coverage
```

The PostgreSQL repository tests use a dedicated test database. Set `TEST_DATABASE_URL` to a disposable PostgreSQL database before running them locally; Vitest skips those integration cases when it is not set. GitHub Actions starts a temporary PostgreSQL service for each CI run. The suite also uses saved Hacker News HTML fixtures and does not make live requests to the site.

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

# Hacker News Crawler

A TypeScript service that scrapes the first 30 entries of [Hacker News](https://news.ycombinator.com/) (rank, title, points, and comments), filters them by title length, and records every request in PostgreSQL. It follows a hexagonal architecture; [Architecture](docs/architecture.md) explains the key design decisions.

## Quick start

Requirements: [Docker](https://docs.docker.com/get-docker/) with Compose v2.

```sh
docker compose up --build
```

This starts PostgreSQL and the API on `http://localhost:3000`. If port `3000` or `5432` is taken, set `APP_PORT` or `POSTGRES_PORT`, for example `APP_PORT=3100 docker compose up --build`.

## API

`GET /entries?filter=all|long|short`

| Filter | Entries | Order |
| --- | --- | --- |
| `all` (default) | All 30 | Rank |
| `long` | Titles with more than five words | Comments, descending |
| `short` | Titles with five words or fewer | Points, descending |

Ties keep their original rank order. Words are whitespace-separated tokens that contain a letter or digit, so `This is - a self-explained example` has 5 words.

```sh
curl -i 'http://localhost:3000/entries?filter=long'
```

```json
[{ "rank": 3, "title": "An example title with seven words", "points": 412, "comments": 262 }]
```

The response headers `X-Cache-Status` (`miss`, `coalesced`, or `hit`) and `X-Front-Page-Fetched-At` show whether the shared front-page snapshot was reused and when it was downloaded. An unsupported filter returns `400`, a Hacker News failure `502`, and a timeout `504`.

## Usage data

Each request is stored in the `usage_records` table with its request time, filter, outcome (`success`, `upstream_error`, `timeout`, or `invalid_html`), result count, snapshot time, cache status, and duration in milliseconds.

```sh
docker compose exec postgres psql -U crawler -d hn_crawler -c 'SELECT requested_at, filter, outcome, result_count, cache_status, duration_ms FROM usage_records ORDER BY id DESC LIMIT 10;'
```

The data is kept in the `postgres-data` volume; `docker compose down -v` deletes it.

## Tests

Run the whole suite, including the PostgreSQL integration tests, in a container:

```sh
docker compose run --rm --build test
```

The tests use saved Hacker News HTML and make no live requests. CI runs lint, type checking, the tests with coverage, and the build on every push. See [Testing](docs/testing.md) for manual checks and troubleshooting.

## Develop on the host

Requirements: Node.js 24.15.0 and pnpm 10.24.0. Start only the database in Docker, then run the API with Node's watch mode:

```sh
docker compose up -d postgres
```

```sh
pnpm install --frozen-lockfile
```

```sh
cp .env.example .env.local
```

The template is empty on purpose. For the Compose database, fill `.env.local` with:

```sh
HN_URL=https://news.ycombinator.com/
FETCH_TIMEOUT_MS=5000
DATABASE_URL=postgresql://crawler:crawler@localhost:5432/hn_crawler
```

```sh
pnpm dev
```

Other commands: `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `pnpm benchmark` (makes a few live requests; see [benchmark results](docs/benchmark-results.md)). Host test runs skip the PostgreSQL tests unless `TEST_DATABASE_URL` is set:

```sh
TEST_DATABASE_URL=postgresql://crawler:crawler@localhost:5432/hn_crawler_test pnpm test:coverage
```

## Configuration

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `HN_URL` | Yes | — | Page to scrape, normally `https://news.ycombinator.com/` |
| `FETCH_TIMEOUT_MS` | Yes | — | Deadline for the whole download |
| `DATABASE_URL` | Yes | — | PostgreSQL URL (`postgresql://user:password@host:port/database`) |
| `PORT` | No | `3000` | Port the API listens on |
| `CACHE_TTL_MS` | No | `60000` | How long a downloaded front page is reused |

Both env files start from `.env.example`. `pnpm dev` reads `.env.local` and `pnpm start` reads `.env`; Docker Compose sets the variables itself. Blank optional variables use their defaults. An invalid value stops startup with an error that names the variable. Never commit `.env` or `.env.local`.

## Project structure

```text
src/
  domain/          Entries, the 30-entry front page, word counting, filters
  application/     GetEntries use case and its ports
  infrastructure/  Adapters: HTTP (Fastify), Hacker News (fetch + Cheerio), cache, PostgreSQL, config
  main.ts          Composition root and graceful shutdown
test/              Mirrors src/, plus fixtures and the architecture boundary test
```

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

Fill in the values in your local `.env`. Set `HN_URL` to `https://news.ycombinator.com/` and `FETCH_TIMEOUT_MS` to a positive decimal integer in milliseconds. For a five-second deadline, use `5000`. `PORT`, `CACHE_TTL_MS`, and `DB_PATH` are reserved for the upcoming server, cache, and storage integrations.

## Start the service

The HTTP adapter currently runs through the test suite. Starting a standalone server requires connecting the Hacker News downloader and parser to the route.

## Run tests

```sh
pnpm test
pnpm test:coverage
```

Use `pnpm test` to run the suite once and `pnpm test:coverage` to check it against the configured coverage thresholds. Test directories mirror `src/`.

## Lint, check types, and build

```sh
pnpm lint
pnpm typecheck
pnpm build
```

The build writes compiled JavaScript to `dist/`.

[Design decisions](docs/architecture.md)

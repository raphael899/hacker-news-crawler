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

Set `HN_URL` to the front-page URL and `FETCH_TIMEOUT_MS` to the download deadline as a positive decimal integer in milliseconds. The example file uses Hacker News and a 5-second deadline.

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

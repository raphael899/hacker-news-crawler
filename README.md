# Hacker News Crawler

## Requirements

- Node.js 24.15.0
- npm

## Install and configure

Run these commands from the repository root:

```sh
npm ci
cp .env.example .env
```

Set `HN_URL` to the front-page URL and `FETCH_TIMEOUT_MS` to the download deadline in milliseconds. The example file uses Hacker News and a 5-second deadline.

## Start the service

T01 provides the project foundation. Startup commands will be available once the HTTP server is wired to the Hacker News adapter.

## Run tests

```sh
npm test
npm run test:coverage
```

Use `npm test` to run the suite once and `npm run test:coverage` to check it against the configured coverage thresholds.

## Lint, check types, and build

```sh
npm run lint
npm run typecheck
npm run build
```

The build writes compiled JavaScript to `dist/`.

[Design decisions](docs/architecture.md)

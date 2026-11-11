# Hacker News Crawler

A small Node.js and TypeScript service for reading the first 30 Hacker News entries.

## Requirements

- Node.js 24.15.0
- npm

## Setup

```sh
npm ci
cp .env.example .env
```

## Development checks

```sh
npm run lint
npm run typecheck
npm run test:coverage
npm run build
```

## Architecture

The application uses a lightweight hexagonal structure.

- `src/domain` contains core types and business rules.
- `src/application` contains use cases that depend on ports.
- `src/ports` defines contracts for external capabilities.
- `src/adapters/http` is the Fastify entry point.
- `src/adapters/hacker-news` will implement the news source port.
- `src/adapters/sqlite` will implement the usage repository port.

Dependencies point inward. The domain, application, and ports do not import Fastify, Cheerio, or SQLite. See [docs/architecture.md](docs/architecture.md).

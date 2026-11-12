# Architecture

## Why a hexagonal structure

The crawler has external dependencies with different reasons to change. Hacker News can change its HTML, and the application can change how it stores usage records. Ports give the use case a stable contract for each dependency. This lets us test the use case with in-memory implementations and keep page selectors and SQL inside their respective adapters.

The diagram shows how the adapters will connect to the application.

```mermaid
flowchart LR
  HTTP[HTTP adapter] --> UseCase[Application use case]
  UseCase --> Domain[Domain types and rules]
  UseCase --> SourcePort[News source port]
  HN[Hacker News adapter] -. implements .-> SourcePort
  UseCase --> UsagePort[Usage repository port]
  SQLite[SQLite adapter] -. implements .-> UsagePort
```

Dependencies point inward. The domain defines the entry and usage-record shapes, the filter rules, and the front-page size rule. The application requests entries through the news source port, validates and filters the result, and records usage through the usage repository port. Fastify is the inbound adapter. The Hacker News infrastructure downloads and parses HTML; the SQLite adapter writes usage records.

The source tree groups business concepts under `src/domain/`, use cases and their contracts under `src/application/`, and concrete adapters under `src/infrastructure/`. The ports live in `src/application/ports/` because the use case defines the capabilities it needs. The HTTP adapter, Hacker News downloader, database, and environment configuration each have a folder in infrastructure.

`src/main.ts` is the composition root: it loads configuration, constructs the Hacker News and SQLite adapters and the use case, builds the Fastify application, and starts listening. It also closes the database when Fastify shuts down. Keeping this wiring outside the adapters makes dependencies visible and lets route tests inject a fake use case without opening a socket.

## Why Node.js and TypeScript

Node.js provides `fetch` for downloading the HTML. TypeScript gives the parser, use case, and ports a shared definition of an entry. Strict type checking helps catch missing fields and incorrect assumptions about optional values. The parser and HTTP adapter still validate external input at runtime.

## Why Fastify

Fastify provides query validation through a schema and lets tests exercise the route with an injected request. The adapter can validate the filter at the HTTP boundary and delegate the work to the use case.

## Why pnpm

The project declares the pnpm version in `package.json` and commits `pnpm-lock.yaml`. Local setup and CI use a frozen lockfile so both install the recorded dependency graph. CI caches the pnpm store to reuse downloaded packages between runs.

## Why Vitest and CI

Vitest lets us test the use case with a fake source, simulate failed downloads, and exercise the Fastify route without opening a port. The test directories mirror `src/`. The parser tests use saved HTML and run independently of the live site. CI runs lint, type checking, tests with coverage, and the build so reviewers can see whether a change meets the same checks used locally.

## Why SQLite for usage records

The usage history should survive a restart and be easy to inspect. SQLite provides persistent, queryable storage in a local file without requiring a separate database service. Node 24.15 includes `node:sqlite`, so this small project avoids another runtime dependency and native add-on. Its `DatabaseSync` API blocks the event loop during database work; that tradeoff is reasonable for these short, local writes at the crawler's expected request volume. The application sees only the `UsageRepositoryPort`, so storage can be replaced if concurrency or throughput needs grow. Node 24.15 documents `node:sqlite` as a release candidate, so this choice relies on the project's pinned Node major and should be reassessed before a wider production rollout ([Node.js SQLite documentation](https://nodejs.org/download/release/v24.15.0/docs/api/sqlite.html)).

Each successful, valid request records an ISO 8601 UTC timestamp, the normalized filter, and the result count. The use case writes only after the source has returned and the 30-entry domain rule and filter have succeeded. A storage error propagates to the HTTP boundary and returns `500` rather than returning an unrecorded success. The Fastify close hook closes the database connection.

The repository tracks schema versions with SQLite's `PRAGMA user_version` and applies migrations sequentially inside transactions. The first migration also adopts the unversioned table created by the earlier T08 implementation, preserving its rows. Future schema changes should add another migration rather than relying on `CREATE TABLE IF NOT EXISTS` to modify an existing table. If opening, migrating, or preparing the insert statement fails, the repository closes its connection before rethrowing the initialization error.

## Why Cheerio for Hacker News

The titles, scores, and comment counts are already present in the HTML returned by the Hacker News front page. Node's `fetch` downloads that response, and the parser uses Cheerio selectors to pair each story with its metadata row. The parser can also run against saved HTML in tests, which makes the results repeatable without a network request.

We considered three alternatives:

- **Playwright** runs a browser and can read content that appears after JavaScript executes or after user interaction. We would reconsider it if Hacker News moved the required fields to client-side rendering. The current page already provides them in the response.
- **jsdom** provides browser-style APIs such as `window` and `document`. The scraper only needs to select elements, traverse the HTML, and read text, which Cheerio provides directly.
- **The Hacker News API** would provide structured data, but the exercise specifically asks us to extract it by scraping the front page.

The parser selects the first 30 ranked rows before validating them. It rejects malformed entries within that group to preserve their original positions. It treats `discuss` as zero comments and assigns zero points and comments to entries with the job listing markup.

Cheerio belongs inside the Hacker News adapter. The application receives typed entries through the news source port, so a change to the parser or page markup stays inside that adapter.

## Why load configuration at startup

`loadConfig()` reads and validates the environment in one place. The server entry point calls it once and passes the resulting settings to the downloader and listener. Node's `--env-file=.env` option loads local values before the application starts, so application code does not need to read `process.env` from multiple modules. The port defaults to `3000`; the Hacker News URL and request timeout must be configured. The downloader accepts settings directly, which lets its tests run without changing the process environment.

## Why use Node's TypeScript support in development

`pnpm dev` runs `src/main.ts` with Node's built-in TypeScript type stripping and watch mode. This avoids a separate development transpiler in a small Node 24 project. `pnpm start` runs the JavaScript emitted by the TypeScript build, keeping development execution separate from the production-style path.

## Why one download deadline

The adapter uses one abort signal for both the request and the response body. A server can send headers promptly and then stall while sending HTML, so a deadline that ends when the headers arrive would leave the crawler waiting. The adapter reports timeouts separately from HTTP and network errors. Each download makes one request, with redirects rejected, so the time and request count stay predictable.

## Why map errors at the HTTP boundary

The news source port defines errors in terms of the operation that failed. Fastify translates those errors into HTTP status codes and gives every route the same response format. Clients receive a stable code and a public message, while the server log keeps details such as the original cause.

## Why the domain validates the front page size

`FrontPage.create()` accepts exactly 30 entries. The use case requests that count and validates the collection it receives, so a source that returns fewer or more entries cannot produce a successful response. This rule applies before filtering, since each filtered list can legitimately contain fewer entries.

## Why title word counting is a domain function

`countTitleWords()` is a pure domain rule, so it does not depend on the crawler, HTTP framework, or storage. It splits on whitespace and counts only tokens containing a Unicode letter or number. This keeps hyphenated text within one spaced word and ignores standalone punctuation and emoji, matching the exercise's example.

## Why filtering runs after the front-page validation

The use case first verifies that the source returned exactly 30 entries, then applies the requested domain filter. The `long` and `short` predicates are complementary (`> 5` and `<= 5`), so every source entry belongs to exactly one group. Long titles sort by comments and short titles by points, both descending, with the original rank as a deterministic tie-breaker. The `all` filter preserves the source order.

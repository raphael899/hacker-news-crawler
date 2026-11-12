# Architecture

## Why a hexagonal structure

The crawler has two external dependencies with different reasons to change. Hacker News can change its HTML, and the application can change how it stores usage records. Ports give the use case a stable contract for each dependency. This lets us test the use case with an in-memory source and keep page selectors and SQL inside their respective adapters.

```mermaid
flowchart LR
  HTTP[HTTP adapter] --> UseCase[Application use case]
  UseCase --> Domain[Domain types and rules]
  UseCase --> SourcePort[News source port]
  HN[Hacker News adapter] -. implements .-> SourcePort
  UseCase --> UsagePort[Usage repository port]
  SQLite[Planned SQLite adapter] -. implements .-> UsagePort
```

Dependencies point inward. The domain defines entry types and filtering rules, and the application coordinates the use case through ports. Fastify is the inbound adapter. The Hacker News adapter currently downloads HTML. The parser will turn that HTML into entries, and the planned SQLite adapter will store usage records.

The source tree groups business concepts under `src/domain/`, use cases and their contracts under `src/application/`, and concrete adapters under `src/infrastructure/`. The ports live in `src/application/ports/` because the use case defines the capabilities it needs. HTTP and the Hacker News downloader each have a folder in infrastructure. The SQLite folder will be added with its implementation.

## Why Node.js and TypeScript

Node.js provides `fetch` for downloading the HTML. TypeScript gives the parser, use case, and ports a shared definition of an entry. Strict type checking helps catch missing fields and incorrect assumptions about optional values. The parser and HTTP adapter still validate external input at runtime.

## Why Fastify

Fastify provides query validation through a schema and lets tests exercise the route with an injected request. The adapter can validate the filter at the HTTP boundary and delegate the work to the use case.

## Why Vitest and CI

Vitest lets us test the use case with a fake source and the parser with saved HTML. CI runs lint, type checking, tests with coverage, and the build so reviewers can see whether a change meets the same checks used locally.

## Why SQLite for usage records

The usage history should survive a restart and be easy to inspect. SQLite provides persistent, queryable storage in a local file without requiring a database service. When usage tracking is added, its repository port will keep storage details out of the use case.

## Why Cheerio for Hacker News

The titles, scores, and comment counts are already present in the HTML returned by the Hacker News front page. Node's `fetch` downloads that response, and the parser will use Cheerio so the adapter can use CSS selectors to read each story and its metadata. The parser can also run against saved HTML in tests, which makes the results repeatable without a network request.

We considered three alternatives:

- **Playwright** runs a browser and can read content that appears after JavaScript executes or after user interaction. We would reconsider it if Hacker News moved the required fields to client-side rendering. The current page already provides them in the response.
- **jsdom** provides browser-style APIs such as `window` and `document`. The scraper only needs to select elements, traverse the HTML, and read text, which Cheerio provides directly.
- **The Hacker News API** would provide structured data, but the exercise specifically asks us to extract it by scraping the front page.

Cheerio belongs inside the Hacker News adapter. The application receives typed entries through the news source port, so a change to the parser or page markup stays inside that adapter.

## Why one download deadline

The adapter uses one abort signal for both the request and the response body. A server can send headers promptly and then stall while sending HTML, so a deadline that ends when the headers arrive would leave the crawler waiting. The adapter reports timeouts separately from HTTP and network errors. Each download makes one request, with redirects rejected, so the time and request count stay predictable.

## Why map errors at the HTTP boundary

The news source port defines errors in terms of the operation that failed. Fastify translates those errors into HTTP status codes and gives every route the same response format. Clients receive a stable code and a public message, while the server log keeps details such as the original cause.

## Why the domain validates the front page size

`FrontPage.create()` accepts exactly 30 entries. The use case requests that count and validates the collection it receives, so a source that returns fewer or more entries cannot produce a successful response. This rule applies before filtering, since each filtered list can legitimately contain fewer entries.

# Architecture

The project uses a small hexagonal structure.

```mermaid
flowchart LR
  HTTP[HTTP adapter] --> UseCase[Application use case]
  UseCase --> Domain[Domain types and rules]
  UseCase --> SourcePort[News source port]
  HN[Hacker News adapter] -. implements .-> SourcePort
  UseCase --> UsagePort[Usage repository port]
  SQLite[SQLite adapter] -. implements .-> UsagePort
```

Dependencies point inward. Domain and application do not import Fastify, Cheerio, or SQLite. The outer adapters will implement the application ports.

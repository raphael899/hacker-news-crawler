# Benchmark methodology and live results

## Method

Run the benchmark manually from the repository root with Node 24 and a configured `.env.local`:

```sh
pnpm benchmark 500 500 3
```

Arguments are parser iterations, cached request iterations, and live uncached download samples. The script parses the saved HTML fixture, fetches and parses the live Hacker News page once per uncached sample (with a one-second pause between downloads), then times requests served by the same in-memory cache. Every live and cached request must produce exactly 30 entries. The cache and download measurements use `GetEntriesUseCase` with a no-op usage repository, isolating that path from PostgreSQL and Fastify overhead.

The script reports mean, p50, p95, minimum, and maximum latency. It is kept out of CI because it calls Hacker News and network latency is outside the test runner's control.

## Recorded live run

- Date: 2026-11-12 14:52 UTC
- Runtime: Node.js 24.16.0, pnpm 10.24.0
- Platform: macOS 26.7.1, Darwin arm64
- Source: `https://news.ycombinator.com/`
- Fetch timeout: 5,000 ms
- Cache TTL: 60,000 ms
- Samples: 500 fixture parses, 3 live downloads, 500 cache hits
- Result: all live downloads and cache hits returned the expected 30 entries.

| Operation | Mean | p50 | p95 | Min | Max |
| --- | ---: | ---: | ---: | ---: | ---: |
| Parse saved HTML fixture | 1.306 ms | 1.040 ms | 3.340 ms | 0.921 ms | 10.001 ms |
| Request with live download and parse | 538.503 ms | 150.048 ms | 1,330.855 ms | 134.605 ms | 1,330.855 ms |
| Request served from cache | 0.003 ms | 0.002 ms | 0.004 ms | 0.002 ms | 0.132 ms |

These are local observations, not service-level guarantees. The live-download sample is intentionally small and network timing varied substantially, so compare the environment and sample count before drawing conclusions. In the three-sample download group, p95 equals the maximum by the percentile definition used by the script.

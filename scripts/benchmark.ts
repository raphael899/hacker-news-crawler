import { readFileSync } from 'node:fs';
import { GetEntriesUseCase } from '../src/application/get-entries.use-case.ts';
import type { UsageRepositoryPort } from '../src/application/ports/usage-repository.port.ts';
import { InMemoryFrontPageCache } from '../src/infrastructure/cache/in-memory-front-page-cache.ts';
import { loadConfig } from '../src/infrastructure/config/app-config.ts';
import { HackerNewsNewsSource } from '../src/infrastructure/hacker-news/hacker-news-news-source.ts';
import { parseFrontPage } from '../src/infrastructure/hacker-news/parse-front-page.ts';
import { FrontPage } from '../src/domain/front-page.ts';

const [parseIterations = '500', cacheIterations = '500', downloadSamples = '3'] = process.argv.slice(2);
const settings = {
  parseIterations: readPositiveInteger(parseIterations, 'parse iterations'),
  cacheIterations: readPositiveInteger(cacheIterations, 'cache iterations'),
  downloadSamples: readPositiveInteger(downloadSamples, 'download samples'),
};

const config = loadConfig();
const source = new HackerNewsNewsSource(config.hackerNews);
const usageRepository: UsageRepositoryPort = { record() {} };
const html = readFileSync(new URL('../test/fixtures/front-page.html', import.meta.url), 'utf8');

console.log('HN crawler benchmark');
console.log(`Date: ${new Date().toISOString()}`);
console.log(`Runtime: ${process.version} (${process.platform}/${process.arch})`);
console.log(`Source: ${config.hackerNews.url}`);
console.log(`Fetch timeout: ${config.hackerNews.timeoutMs} ms`);
console.log(`Cache TTL: ${config.cacheTtlMs} ms`);
console.log(`Samples: parse=${settings.parseIterations}, uncached downloads=${settings.downloadSamples}, cache hits=${settings.cacheIterations}`);

const parseDurations = measureSync(settings.parseIterations, () => {
  const entries = parseFrontPage(html);
  assertEntryCount(entries.length, 'fixture parse');
});
printStats('Parse saved HTML', parseDurations);

const downloadDurations: number[] = [];
let cachedUseCase: GetEntriesUseCase | undefined;
for (let index = 0; index < settings.downloadSamples; index += 1) {
  const useCase = new GetEntriesUseCase(
    source,
    new InMemoryFrontPageCache(config.cacheTtlMs),
    usageRepository,
  );
  const startedAt = performance.now();
  const result = await useCase.execute('all');
  downloadDurations.push(performance.now() - startedAt);
  assertEntryCount(result.entries.length, 'live download');
  if (index === settings.downloadSamples - 1) cachedUseCase = useCase;
  if (index < settings.downloadSamples - 1) await delay(1_000);
}
printStats('Request with download + parse', downloadDurations);

if (!cachedUseCase) throw new Error('Could not initialize the cached use case');
const cacheDurations = measureAsync(settings.cacheIterations, async () => {
  const result = await cachedUseCase.execute('all');
  assertEntryCount(result.entries.length, 'cache hit');
  if (result.cacheStatus !== 'hit') {
    throw new Error(`Expected a cache hit, received ${result.cacheStatus}; increase CACHE_TTL_MS or reduce cache iterations`);
  }
});
printStats('Request served from cache', await cacheDurations);

function readPositiveInteger(value: string, label: string): number {
  const parsed = Number(value);
  if (!/^\d+$/u.test(value) || !Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${label} must be a positive safe integer`);
  }
  return parsed;
}

function assertEntryCount(actual: number, operation: string): void {
  if (actual !== FrontPage.entryCount) {
    throw new Error(`${operation} returned ${actual} entries, expected ${FrontPage.entryCount}`);
  }
}

function measureSync(iterations: number, operation: () => void): number[] {
  const durations: number[] = [];
  for (let index = 0; index < iterations; index += 1) {
    const startedAt = performance.now();
    operation();
    durations.push(performance.now() - startedAt);
  }
  return durations;
}

async function measureAsync(iterations: number, operation: () => Promise<void>): Promise<number[]> {
  const durations: number[] = [];
  for (let index = 0; index < iterations; index += 1) {
    const startedAt = performance.now();
    await operation();
    durations.push(performance.now() - startedAt);
  }
  return durations;
}

function printStats(label: string, durations: readonly number[]): void {
  const sorted = [...durations].sort((left, right) => left - right);
  const sum = sorted.reduce((total, value) => total + value, 0);
  const percentile = (rank: number): number => sorted[Math.max(0, Math.ceil(rank * sorted.length) - 1)] ?? 0;
  console.log(`${label}: mean=${(sum / sorted.length).toFixed(3)} ms, p50=${percentile(0.50).toFixed(3)} ms, p95=${percentile(0.95).toFixed(3)} ms, min=${(sorted[0] ?? 0).toFixed(3)} ms, max=${(sorted.at(-1) ?? 0).toFixed(3)} ms`);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

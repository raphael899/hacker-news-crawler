import { GetEntriesUseCase } from './application/get-entries.use-case.ts';
import { loadConfig } from './infrastructure/config/app-config.ts';
import { buildApp } from './infrastructure/http/app.ts';
import { SQLiteUsageRepository } from './infrastructure/database/sqlite-usage-repository.ts';
import { HackerNewsNewsSource } from './infrastructure/hacker-news/hacker-news-news-source.ts';
import { InMemoryFrontPageCache } from './infrastructure/cache/in-memory-front-page-cache.ts';

const config = loadConfig();
const newsSource = new HackerNewsNewsSource(config.hackerNews);
const frontPageCache = new InMemoryFrontPageCache(config.cacheTtlMs);
const usageRepository = new SQLiteUsageRepository(config.databasePath);
const getEntries = new GetEntriesUseCase(newsSource, frontPageCache, usageRepository);
const app = buildApp(getEntries, { logger: true });
app.addHook('onClose', async () => usageRepository.close());

try {
  await app.listen({ port: config.port, host: '0.0.0.0' });
} catch (error) {
  app.log.error(error, 'Could not start the server');
  process.exitCode = 1;
}

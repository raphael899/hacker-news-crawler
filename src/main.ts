import { GetEntriesUseCase } from './application/get-entries.use-case.ts';
import { loadConfig } from './infrastructure/config/app-config.ts';
import { buildApp } from './infrastructure/http/app.ts';
import { PostgresUsageRepository } from './infrastructure/database/postgres-usage-repository.ts';
import { HackerNewsNewsSource } from './infrastructure/hacker-news/hacker-news-news-source.ts';
import { InMemoryFrontPageCache } from './infrastructure/cache/in-memory-front-page-cache.ts';

const config = loadConfig();
const newsSource = new HackerNewsNewsSource(config.hackerNews);
const frontPageCache = new InMemoryFrontPageCache(config.cacheTtlMs);
const usageRepository = await PostgresUsageRepository.connect(config.databaseUrl);
const getEntries = new GetEntriesUseCase(newsSource, frontPageCache, usageRepository);
const app = buildApp(getEntries, { logger: true });
app.addHook('onClose', async () => usageRepository.close());

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  app.log.info({ signal }, 'Shutting down');
  try {
    await app.close();
  } catch (error) {
    app.log.error(error, 'Could not shut down cleanly');
    process.exitCode = 1;
  }
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

try {
  await app.listen({ port: config.port, host: '0.0.0.0' });
} catch (error) {
  app.log.error(error, 'Could not start the server');
  process.exitCode = 1;
  await app.close();
}

import { GetEntriesUseCase } from './application/get-entries.use-case.ts';
import { loadConfig } from './infrastructure/config/app-config.ts';
import { buildApp } from './infrastructure/http/app.ts';
import { HackerNewsNewsSource } from './infrastructure/hacker-news/hacker-news-news-source.ts';

const config = loadConfig();
const newsSource = new HackerNewsNewsSource(config.hackerNews);
const getEntries = new GetEntriesUseCase(newsSource);
const app = buildApp(getEntries, true);

try {
  await app.listen({ port: config.port, host: '0.0.0.0' });
} catch (error) {
  app.log.error(error, 'Could not start the server');
  process.exitCode = 1;
}

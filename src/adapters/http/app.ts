import Fastify from 'fastify';
import type { GetEntriesUseCase } from '../../application/get-entries.use-case.ts';

export function buildApp(useCase: GetEntriesUseCase, logger = false) {
  const app = Fastify({ logger });
  app.get<{ Querystring: { filter?: string } }>('/entries', {
    schema: {
      querystring: {
        type: 'object',
        properties: { filter: { type: 'string', enum: ['all', 'long', 'short'] } },
      },
    },
  }, () => useCase.execute());
  return app;
}

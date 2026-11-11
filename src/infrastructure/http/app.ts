import Fastify from 'fastify';
import { mapHttpError } from './error-mapper.ts';
import type { GetEntriesUseCase } from '../../application/get-entries.use-case.ts';

export function buildApp(useCase: GetEntriesUseCase, logger = false) {
  const app = Fastify({ logger });
  app.setErrorHandler((error, request, reply) => {
    const { statusCode, body } = mapHttpError(error);
    if (statusCode >= 500) {
      request.log.error({ err: error }, 'Request failed');
    }
    return reply.code(statusCode).send(body);
  });

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

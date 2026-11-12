import Fastify from 'fastify';
import { mapHttpError } from './error-mapper.ts';
import type { GetEntriesUseCase } from '../../application/get-entries.use-case.ts';
import { ENTRY_FILTERS, type EntryFilter } from '../../domain/filter.ts';

interface EntriesQuery {
  readonly filter?: EntryFilter;
}

export function buildApp(useCase: GetEntriesUseCase, logger = false) {
  const app = Fastify({ logger });
  app.setErrorHandler((error, request, reply) => {
    const { statusCode, body } = mapHttpError(error);
    if (statusCode >= 500) {
      request.log.error({ err: error }, 'Request failed');
    }
    return reply.code(statusCode).send(body);
  });

  app.get<{ Querystring: EntriesQuery }>('/entries', {
    schema: {
      querystring: {
        type: 'object',
        properties: { filter: { type: 'string', enum: ENTRY_FILTERS } },
      },
    },
  }, (request) => useCase.execute(request.query.filter ?? 'all'));
  return app;
}

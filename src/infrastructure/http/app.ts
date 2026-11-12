import Fastify from 'fastify';
import { mapHttpError } from './error-mapper.ts';
import type { GetEntriesPort } from '../../application/ports/get-entries.port.ts';
import { ENTRY_FILTERS, type EntryFilter } from '../../domain/filter.ts';

interface EntriesQuery {
  readonly filter?: EntryFilter;
}

export interface AppOptions {
  readonly logger?: boolean;
}

export function buildApp(getEntries: GetEntriesPort, { logger = false }: AppOptions = {}) {
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
  }, async (request, reply) => {
    const result = await getEntries.execute(request.query.filter ?? 'all');
    reply
      .header('X-Front-Page-Fetched-At', result.fetchedAt)
      .header('X-Cache-Status', result.cacheStatus);
    return result.entries;
  });
  return app;
}

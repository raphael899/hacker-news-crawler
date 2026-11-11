import { CrawlerError, type CrawlerOutcome } from '../../application/ports/crawler-error.ts';

interface HttpErrorResponse {
  statusCode: number;
  body: {
    error: {
      code: string;
      message: string;
    };
  };
}

const crawlerResponses = {
  upstream_error: { statusCode: 502, message: 'Could not fetch the Hacker News front page.' },
  timeout: { statusCode: 504, message: 'Hacker News did not respond in time.' },
} satisfies Record<CrawlerOutcome, { statusCode: number; message: string }>;

export function mapHttpError(error: unknown): HttpErrorResponse {
  if (error instanceof CrawlerError) {
    const { statusCode, message } = crawlerResponses[error.outcome];
    return { statusCode, body: { error: { code: error.outcome, message } } };
  }

  if (error instanceof Error && 'code' in error && error.code === 'FST_ERR_VALIDATION') {
    return {
      statusCode: 400,
      body: { error: { code: 'invalid_request', message: 'Request validation failed.' } },
    };
  }

  return {
    statusCode: 500,
    body: { error: { code: 'internal_error', message: 'An unexpected error occurred.' } },
  };
}

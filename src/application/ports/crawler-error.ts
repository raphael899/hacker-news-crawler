import type { CrawlerOutcome } from '../../domain/crawler-outcome.ts';

export class CrawlerError extends Error {
  readonly outcome: CrawlerOutcome;

  constructor(outcome: CrawlerOutcome, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'CrawlerError';
    this.outcome = outcome;
  }
}

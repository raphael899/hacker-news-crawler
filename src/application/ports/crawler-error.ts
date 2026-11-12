export const CRAWLER_OUTCOMES = ['upstream_error', 'timeout', 'invalid_html'] as const;

export type CrawlerOutcome = typeof CRAWLER_OUTCOMES[number];

export class CrawlerError extends Error {
  readonly outcome: CrawlerOutcome;

  constructor(outcome: CrawlerOutcome, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'CrawlerError';
    this.outcome = outcome;
  }
}

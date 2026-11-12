export class CrawlerError extends Error {
  readonly outcome: 'upstream_error' | 'timeout';

  constructor(outcome: CrawlerError['outcome'], message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'CrawlerError';
    this.outcome = outcome;
  }
}

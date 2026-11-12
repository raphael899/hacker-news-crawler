export class CrawlerError extends Error {
  readonly outcome: 'upstream_error' | 'timeout' | 'invalid_html';

  constructor(outcome: CrawlerError['outcome'], message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'CrawlerError';
    this.outcome = outcome;
  }
}

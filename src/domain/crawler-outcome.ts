export const CRAWLER_OUTCOMES = ['upstream_error', 'timeout', 'invalid_html'] as const;

export type CrawlerOutcome = typeof CRAWLER_OUTCOMES[number];

export const USAGE_OUTCOMES = ['success', ...CRAWLER_OUTCOMES] as const;

export type UsageOutcome = typeof USAGE_OUTCOMES[number];

import type { Entry } from '../../domain/entry.ts';

export interface NewsSourcePort {
  /**
   * Returns the first `limit` ranked entries, in source order.
   * `limit` must be a positive integer; implementations reject other values with a RangeError.
   */
  fetchTopEntries(limit: number): Promise<readonly Entry[]>;
}

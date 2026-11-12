import type { Entry } from '../../domain/entry.ts';

export interface NewsSourcePort {
  fetchTopEntries(limit: number): Promise<readonly Entry[]>;
}

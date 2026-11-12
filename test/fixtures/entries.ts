import type { Entry } from '../../src/domain/entry.ts';

export function makeEntries(count: number): Entry[] {
  return Array.from({ length: count }, (_, index) => ({
    rank: index + 1,
    title: `Example ${index + 1}`,
    points: 10,
    comments: 2,
  }));
}

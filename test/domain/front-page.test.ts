import { describe, expect, it } from 'vitest';
import { FrontPage } from '../../src/domain/front-page.ts';
import { makeEntries } from '../fixtures/entries.ts';

describe('FrontPage', () => {
  it('preserves its 30 entries when the source list changes', () => {
    const entries = makeEntries(30);
    const frontPage = FrontPage.create(entries);

    entries.pop();

    expect(frontPage.entries).toHaveLength(30);
  });
});

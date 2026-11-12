import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CrawlerError } from '../../../src/application/ports/crawler-error.ts';
import { parseFrontPage } from '../../../src/infrastructure/hacker-news/parse-front-page.ts';

const html = readFileSync(new URL('../../fixtures/front-page.html', import.meta.url), 'utf8');

describe('front page parser', () => {
  it('reads the first 30 rows with their own metadata', () => {
    const entries = parseFrontPage(html);
    expect(entries.map(({ rank }) => rank)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    expect(entries[0]).toEqual({ rank: 1, title: 'Reliable systems', points: 213, comments: 57 });
    expect(entries[14]).toMatchObject({ points: 7, comments: 0 });
    expect(entries[20]).toMatchObject({ points: 0, comments: 0 });
  });

  it('accepts singular points and comments', () => {
    const entries = parseFrontPage(html.replace('213 points', '1 point').replace('57&nbsp;comments', '1 comment'));
    expect(entries[0]).toMatchObject({ points: 1, comments: 1 });
  });

  it('rejects a page with fewer than 30 ranked rows', () => {
    expect(() => parseFrontPage('<table></table>')).toThrow(expect.objectContaining({ outcome: 'invalid_html' }));
  });

  it('ignores the 31st entry and rejects a broken entry within the first 30', () => {
    const lastEntry = html.split('\n').find((line) => line.includes('class="rank">30.'));
    if (lastEntry === undefined) throw new Error('Fixture is missing entry 30');

    const extraEntry = lastEntry.replaceAll('50455031', '99999999').replace('class="rank">30.', 'class="rank">31.');
    const extendedHtml = html.replace('</table>', `${extraEntry}\n</table>`);

    expect(parseFrontPage(extendedHtml)).toEqual(parseFrontPage(html));
    const brokenHtml = extendedHtml.replace('class="rank">12.', 'class="missing-rank">12.');
    expect(() => parseFrontPage(brokenHtml)).toThrow('Entry 12');
  });

  it.each([
    ['wrong rank', html.replace('class="rank">1.', 'class="rank">2.')],
    ['mismatched metadata', html.replace('class="age" title=', 'class="missing-age" title=')],
    ['missing score', html.replace('class="score"', 'class="missing-score"')],
    ['missing discussion', html.replace('57&nbsp;comments', 'unexpected')],
    ['unsafe points', html.replace('213 points', '9007199254740992 points')],
    ['unsafe comment count', html.replace('57&nbsp;comments', '9007199254740992 comments')],
  ])('rejects %s', (_, input) => {
    expect(() => parseFrontPage(input)).toThrow(CrawlerError);
  });
});

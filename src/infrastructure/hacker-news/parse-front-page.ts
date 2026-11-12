import { load } from 'cheerio';
import { CrawlerError } from '../../application/ports/crawler-error.ts';
import type { Entry } from '../../domain/entry.ts';
import { FrontPage, InvalidFrontPageError } from '../../domain/front-page.ts';

function invalidEntry(rank: number, reason: string): never {
  throw new CrawlerError('invalid_html', `Entry ${rank}: ${reason}`);
}

export function parseFrontPage(html: string, limit: number = FrontPage.entryCount): readonly Entry[] {
  const $ = load(html);
  const rows = $('tr.athing').slice(0, limit).toArray();
  if (rows.length !== limit) {
    throw new InvalidFrontPageError(limit, rows.length);
  }

  const ids = new Set<string>();
  return rows.map((row, index) => {
    const rank = index + 1;
    const story = $(row);
    const id = story.attr('id');
    const rankText = story.find('.rank').text().trim();
    const titleLink = story.find('.titleline > a').first();
    const title = titleLink.text().trim();
    if (!id || ids.has(id) || rankText !== `${rank}.` || !title) {
      return invalidEntry(rank, 'invalid identity, rank, or title');
    }
    ids.add(id);

    const metadata = story.next('tr').children('td.subtext');
    const itemUrl = `item?id=${id}`;
    if (metadata.length !== 1 || metadata.find('.age > a').attr('href') !== itemUrl) {
      return invalidEntry(rank, 'missing or mismatched metadata');
    }

    const subline = metadata.children('.subline');
    if (subline.length === 0 && story.find('.votelinks').length === 0 &&
        story.children('td').eq(1).children('img').attr('src') === 's.gif' &&
        titleLink.attr('href') === itemUrl &&
        metadata.find('.score').length === 0) {
      return { rank, title, points: 0, comments: 0 };
    }

    const score = subline.find('.score');
    const points = Number(/^(\d+)\s+points?$/.exec(score.text().trim())?.[1]);
    const commentLabel = subline.children('a').filter((_, link) =>
      $(link).attr('href') === itemUrl,
    ).text().trim();
    const comments = commentLabel === 'discuss' ? 0 : Number(/^(\d+)\s+comments?$/.exec(commentLabel)?.[1]);
    if (score.attr('id') !== `score_${id}` || !Number.isSafeInteger(points) ||
        !Number.isSafeInteger(comments)) {
      return invalidEntry(rank, 'unrecognized points or comments');
    }

    return { rank, title, points, comments };
  });
}

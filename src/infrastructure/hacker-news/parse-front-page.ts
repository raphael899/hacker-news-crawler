import { load, type CheerioAPI } from 'cheerio';
import { CrawlerError } from '../../application/ports/crawler-error.ts';
import type { Entry } from '../../domain/entry.ts';
import { FrontPage } from '../../domain/front-page.ts';

type Selection = ReturnType<CheerioAPI>;

const POINTS_PATTERN = /^(\d+)\s+points?$/u;
const COMMENTS_PATTERN = /^(\d+)\s+comments?$/u;

export function parseFrontPage(html: string, limit: number = FrontPage.entryCount): readonly Entry[] {
  const $ = load(html);
  const rows = $('tr.athing').slice(0, limit).toArray();
  if (rows.length !== limit) {
    throw new CrawlerError('invalid_html', `Expected ${limit} front-page entries, received ${rows.length}.`);
  }

  const seenIds = new Set<string>();
  return rows.map((row, index) => parseEntry($, $(row), index + 1, seenIds));
}

function parseEntry($: CheerioAPI, story: Selection, rank: number, seenIds: Set<string>): Entry {
  const id = story.attr('id');
  const titleLink = story.find('.titleline > a').first();
  const title = titleLink.text().trim();
  const rankText = story.find('.rank').text().trim();
  if (!id || seenIds.has(id) || rankText !== `${rank}.` || !title) {
    throw invalidEntry(rank, 'invalid identity, rank, or title');
  }
  seenIds.add(id);

  const itemUrl = `item?id=${id}`;
  const metadata = story.next('tr').children('td.subtext');
  if (metadata.length !== 1 || metadata.find('.age > a').attr('href') !== itemUrl) {
    throw invalidEntry(rank, 'missing or mismatched metadata');
  }

  if (isJobPosting(story, metadata, titleLink, itemUrl)) {
    return { rank, title, points: 0, comments: 0 };
  }

  const subline = metadata.children('.subline');
  const points = parsePoints(subline, id);
  const comments = parseComments($, subline, itemUrl);
  if (points === undefined || comments === undefined) {
    throw invalidEntry(rank, 'unrecognized points or comments');
  }
  return { rank, title, points, comments };
}

function isJobPosting(story: Selection, metadata: Selection, titleLink: Selection, itemUrl: string): boolean {
  const spacerImage = story.children('td').eq(1).children('img').attr('src');
  return metadata.children('.subline').length === 0 &&
    metadata.find('.score').length === 0 &&
    story.find('.votelinks').length === 0 &&
    spacerImage === 's.gif' &&
    titleLink.attr('href') === itemUrl;
}

function parsePoints(subline: Selection, id: string): number | undefined {
  const score = subline.find('.score');
  if (score.attr('id') !== `score_${id}`) return undefined;
  return parseCount(score.text(), POINTS_PATTERN);
}

function parseComments($: CheerioAPI, subline: Selection, itemUrl: string): number | undefined {
  const label = subline.children('a').filter((_, link) => $(link).attr('href') === itemUrl).text().trim();
  return label === 'discuss' ? 0 : parseCount(label, COMMENTS_PATTERN);
}

function parseCount(text: string, pattern: RegExp): number | undefined {
  const count = Number(pattern.exec(text.trim())?.[1]);
  return Number.isSafeInteger(count) ? count : undefined;
}

function invalidEntry(rank: number, reason: string): CrawlerError {
  return new CrawlerError('invalid_html', `Entry ${rank}: ${reason}`);
}

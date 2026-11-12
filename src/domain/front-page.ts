import type { Entry } from './entry.ts';

export class InvalidFrontPageError extends Error {
  constructor(expected: number, actual: number) {
    super(`Expected ${expected} front-page entries, received ${actual}.`);
    this.name = 'InvalidFrontPageError';
  }
}

export class FrontPage {
  static readonly entryCount = 30;

  readonly entries: readonly Entry[];

  private constructor(entries: readonly Entry[]) {
    this.entries = Object.freeze([...entries]);
  }

  static create(entries: readonly Entry[]): FrontPage {
    if (entries.length !== FrontPage.entryCount) {
      throw new InvalidFrontPageError(FrontPage.entryCount, entries.length);
    }
    return new FrontPage(entries);
  }
}

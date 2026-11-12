import { describe, expect, it } from 'vitest';
import { countTitleWords } from '../../src/domain/title.ts';

describe('countTitleWords', () => {
  it('counts spaced words and ignores tokens made only of symbols', () => {
    expect(countTitleWords('This is - a self-explained example')).toBe(5);
  });

  it.each([
    ['four words count today', 4],
    ['these are five words exactly', 5],
    ['these are six spaced words exactly', 6],
  ])('counts the title "%s" as %i words', (title, expected) => {
    expect(countTitleWords(title)).toBe(expected);
  });

  it('counts Unicode letters and words from different writing systems', () => {
    expect(countTitleWords('¡Hola, señor! 東京 こんにちは')).toBe(4);
  });

  it('keeps hyphenated text within one whitespace-delimited word', () => {
    expect(countTitleWords('well-known self-explained foo—bar')).toBe(3);
  });

  it('ignores punctuation, emoji, and other symbol-only fragments', () => {
    expect(countTitleWords(' -- 💡 + … ')).toBe(0);
    expect(countTitleWords('word!!! 🚀 another?')).toBe(2);
  });

  it('handles empty text and repeated whitespace', () => {
    expect(countTitleWords('')).toBe(0);
    expect(countTitleWords('  one\t two\nthree  ')).toBe(3);
  });
});

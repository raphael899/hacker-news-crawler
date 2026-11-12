export function countTitleWords(title: string): number {
  return title
    .trim()
    .split(/\s+/u)
    .filter((word) => /[\p{L}\p{N}]/u.test(word))
    .length;
}

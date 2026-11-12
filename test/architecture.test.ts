import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const sourceRoot = fileURLToPath(new URL('../src/', import.meta.url));

interface Layer {
  readonly name: string;
  readonly allowedLayers: readonly string[];
}

const innerLayers: readonly Layer[] = [
  { name: 'domain', allowedLayers: ['domain'] },
  { name: 'application', allowedLayers: ['domain', 'application'] },
];

function listTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.ts'))
    .map((file) => join(directory, file));
}

function importSpecifiers(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  return [...source.matchAll(/(?:from|import)\s+['"]([^'"]+)['"]/gu)].map(([, specifier]) => specifier!);
}

function layerOf(file: string, specifier: string): string {
  return relative(sourceRoot, resolve(dirname(file), specifier)).split(/[\\/]/u)[0]!;
}

describe('architecture boundaries', () => {
  it.each(innerLayers)('$name depends only on $allowedLayers and no external packages', ({ name, allowedLayers }) => {
    const files = listTypeScriptFiles(join(sourceRoot, name));
    expect(files.length).toBeGreaterThan(0);

    const violations = files.flatMap((file) => importSpecifiers(file)
      .filter((specifier) => !specifier.startsWith('.') || !allowedLayers.includes(layerOf(file, specifier)))
      .map((specifier) => `${relative(sourceRoot, file)} -> ${specifier}`));

    expect(violations).toEqual([]);
  });
});

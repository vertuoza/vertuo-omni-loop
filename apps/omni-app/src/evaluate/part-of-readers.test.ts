// The guard of issue 1690: a `Part of` claim is a line that starts with it, outside fenced code. Every
// regular expression of the App that reads one is anchored at a line's start, and its module reads the
// body through `proseLines`, so a new reader cannot take a quoted example for a claim again.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const READER = /^\s*const \w+ = \/(.*Part of.*)\/[a-z]*;\s*$/gm;

/** The App's source modules, tests left out. */
function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [path] : [];
  });
}

/** Each `Part of` regular expression in `text` that is not anchored, or whose module skips `proseLines`. */
function looseReaders(text: string): string[] {
  const readers = [...text.matchAll(READER)].map((match) => match[1] ?? '');
  const lines = /\bproseLines\(/.test(text);
  return readers.filter((source) => !source.startsWith('^') || !lines);
}

describe('the App\'s `Part of` readers (issue 1690)', () => {
  it('flags an unanchored reader, and an anchored one whose module reads the whole body', () => {
    expect(looseReaders('const PART_OF = /(?:^|[^\\w-])Part of (x)/;\nproseLines(body);')).toHaveLength(1);
    expect(looseReaders('const PART_OF = /^Part of (x)/m;\nPART_OF.exec(body);')).toHaveLength(1);
    expect(looseReaders('const PART_OF = /^ {0,3}Part of (x)/;\nproseLines(body).map((l) => PART_OF.exec(l));')).toEqual([]);
  });

  it('every reader in apps/omni-app/src is anchored at a line\'s start and reads lines outside fenced code', () => {
    const loose = sources(SRC).flatMap((path) => looseReaders(readFileSync(path, 'utf8')).map((source) => `${relative(SRC, path)}: /${source}/`));
    expect(loose).toEqual([]);
  });

  it('finds the two readers it guards, so it is not passing on nothing', () => {
    const found = sources(SRC).filter((path) => [...readFileSync(path, 'utf8').matchAll(READER)].length > 0).map((path) => relative(SRC, path)).sort();
    expect(found).toEqual(['approved-check/state.ts', 'evaluate/evaluate.ts']);
  });
});

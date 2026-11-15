// PRD 2898, s1: an outbox item's `excuses:` field, written into its front matter and read back.
import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { excuseProblem, itemExcuses, withExcuses } from './excuses.ts';
import { parseOutboxItem } from './outbox.ts';

const ITEM = [
  '---',
  'id: s1-01-label-style',
  'prd: 2898',
  'slice: s1',
  'rank: medium',
  'bears-on: none',
  'raised: 2026-11-15',
  'wave: 1',
  '---',
  '',
  '## What I had to decide',
  '',
  'x',
  '',
].join('\n');

describe('withExcuses (PRD 2898)', () => {
  it('writes the paths as the front matter\'s last field, and changes nothing else', () => {
    const text = withExcuses(ITEM, ['kit/lib/init/labels.ts', 'a/b.ts']);
    expect(text).toBe(ITEM.replace('wave: 1\n---', 'wave: 1\nexcuses: [kit/lib/init/labels.ts, a/b.ts]\n---'));
    expect(itemExcuses(text)).toEqual(['kit/lib/init/labels.ts', 'a/b.ts']);
  });

  it('leaves an item with no path exactly as it was', () => {
    expect(withExcuses(ITEM, [])).toBe(ITEM);
  });

  it('refuses a text with no front matter', () => {
    expect(() => withExcuses('## no front matter\n', ['a.ts'])).toThrow(/front matter/);
  });
});

describe('itemExcuses (PRD 2898)', () => {
  it('reads none from an item without the field, or from text that is no item', () => {
    expect(itemExcuses(ITEM)).toEqual([]);
    expect(itemExcuses('nothing here')).toEqual([]);
  });

  it('reads none from a field the schema refuses: a folder excuses nothing', () => {
    expect(itemExcuses(ITEM.replace('wave: 1\n', 'wave: 1\nexcuses: [kit/lib/]\n'))).toEqual([]);
  });

  it('keeps the item readable by the outbox parser with the field written', () => {
    const full = [
      '## The question, in plain words', '', 'Q?', '', '## The decision, in plain words', '', 'D.', '',
      '## The options, in plain words', '', 'A. Keep it as built.', 'B. Drop it.', '',
      '## What I had to decide', '', 'x', '', '## What I did meanwhile', '', 'y', '',
      '## What it costs to change later', '', 'z', '', '## What I could not know', '', '- nothing', '',
    ].join('\n');
    const text = withExcuses(ITEM.replace(/## What I had to decide[\s\S]*$/, full), ['a/b.ts']);
    const read = parseOutboxItem(text);
    expect(read.ok ? 'read' : read.errors).toBe('read');
  });
});

describe('excuseProblem (PRD 2898)', () => {
  const root = mkdtempSync(join(tmpdir(), 'omni-excuses-'));
  mkdirSync(join(root, 'kit/lib'), { recursive: true });

  it('passes an exact path once, there or not', () => {
    expect(excuseProblem(root, 'kit/lib/x.ts', 0, ['kit/lib/x.ts'])).toBeNull();
  });

  it('names a folder on disk, a path given twice and any problem of the path itself', () => {
    expect(excuseProblem(root, 'kit/lib', 0, ['kit/lib'])).toBe('kit/lib is a folder: an item excuses exact paths only');
    expect(excuseProblem(root, 'a.ts', 1, ['a.ts', 'a.ts'])).toBe('a.ts is given twice');
    expect(excuseProblem(root, 'a.ts', 0, ['a.ts', 'a.ts'])).toBeNull();
    expect(excuseProblem(root, 'kit/*.ts', 0, ['kit/*.ts'])).toBe('kit/*.ts is a pattern: an item excuses exact paths only');
  });
});

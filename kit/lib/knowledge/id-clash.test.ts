// An id new on this branch that the base gave to another entry (PRD 3015, s3): the pure comparison.
import { describe, expect, it } from 'vitest';
import { clashLine, idClashes, type Stated } from './id-clash.ts';

const FILE = '.omni-loop/knowledge/domains/pipeline/rules.md';

function at(id: string, statement: string, file = FILE): Stated {
  return { id, statement, file };
}

/** `then` as a reader that counts its calls: it is read only when some id differs. */
function reader(ids: string[]) {
  const calls = { n: 0 };
  return {
    calls,
    then: () => {
      calls.n += 1;
      return ids;
    },
  };
}

describe('idClashes', () => {
  it('names an id new on this branch that the base holds with other words, and the next free id (AC-3)', () => {
    const { then } = reader(['BR-PIPELINE-46']);
    const clashes = idClashes({
      tree: [at('BR-PIPELINE-46', 'A pipeline has stages.'), at('BR-PIPELINE-47', 'An order backlog is counted in months.')],
      now: [at('BR-PIPELINE-46', 'A pipeline has stages.'), at('BR-PIPELINE-47', 'A quote is signed once.')],
      then,
    });
    expect(clashes).toEqual([{ file: FILE, id: 'BR-PIPELINE-47', theirs: 'A quote is signed once.', next: 'BR-PIPELINE-48' }]);
  });

  it('keeps an entry the branch reworded in place: it was there at the merge base (AC-4)', () => {
    const { then } = reader(['BR-PIPELINE-47']);
    expect(idClashes({ tree: [at('BR-PIPELINE-47', 'A quote is signed twice.')], now: [at('BR-PIPELINE-47', 'A quote is signed once.')], then })).toEqual([]);
  });

  it('reads the same id with the same words on both sides as one entry, never a clash, without reading the merge base', () => {
    const { then, calls } = reader([]);
    const clashes = idClashes({ tree: [at('BR-PIPELINE-47', 'A quote is\n  signed once. ')], now: [at('BR-PIPELINE-47', 'A quote is signed once.')], then });
    expect(clashes).toEqual([]);
    expect(calls.n).toBe(0);
  });

  it('ignores an id the base does not hold', () => {
    const { then, calls } = reader([]);
    expect(idClashes({ tree: [at('BR-PIPELINE-47', 'New.')], now: [at('BR-PIPELINE-46', 'Old.')], then })).toEqual([]);
    expect(calls.n).toBe(0);
  });

  it('numbers past both the tree and the base, and gives two clashes of one prefix two different ids', () => {
    const { then } = reader([]);
    const clashes = idClashes({
      tree: [at('BR-PIPELINE-47', 'Ours one.'), at('BR-PIPELINE-48', 'Ours two.'), at('BR-PIPELINE-50', 'Ours three.')],
      now: [at('BR-PIPELINE-47', 'Theirs one.'), at('BR-PIPELINE-48', 'Theirs two.'), at('BR-PIPELINE-51', 'Theirs four.')],
      then,
    });
    expect(clashes.map(({ id, next }) => [id, next])).toEqual([
      ['BR-PIPELINE-47', 'BR-PIPELINE-52'],
      ['BR-PIPELINE-48', 'BR-PIPELINE-53'],
    ]);
  });

  it('reads the merge base once, however many ids differ', () => {
    const { then, calls } = reader(['P-GATE-1']);
    idClashes({ tree: [at('P-GATE-1', 'Ours.'), at('P-GATE-2', 'Ours.')], now: [at('P-GATE-1', 'Theirs.'), at('P-GATE-2', 'Theirs.')], then });
    expect(calls.n).toBe(1);
  });

  it('numbers a core id (N<n>) past every core id', () => {
    const { then } = reader([]);
    const clashes = idClashes({ tree: [at('N3', 'Ours.'), at('N1', 'Same.')], now: [at('N3', 'Theirs.'), at('N1', 'Same.'), at('N4', 'More.')], then });
    expect(clashes.map(({ next }) => next)).toEqual(['N5']);
  });

  it('gives no number to an id of no known shape, never throwing', () => {
    const { then } = reader([]);
    expect(idClashes({ tree: [at('WIDGET-1', 'Ours.')], now: [at('WIDGET-1', 'Theirs.')], then }).map(({ next }) => next)).toEqual(['a free id']);
  });

  it('names an id once, even when the tree holds it twice', () => {
    const { then } = reader([]);
    const clashes = idClashes({ tree: [at('BR-PIPELINE-47', 'Ours.'), at('BR-PIPELINE-47', 'Ours again.', 'other.md')], now: [at('BR-PIPELINE-47', 'Theirs.')], then });
    expect(clashes.map(({ id, file }) => [id, file])).toEqual([['BR-PIPELINE-47', FILE]]);
  });
});

describe('clashLine', () => {
  it('names the base, its statement, the id to renumber to and the ledger line', () => {
    expect(clashLine({ file: FILE, id: 'BR-PIPELINE-47', theirs: 'A quote is signed once.', next: 'BR-PIPELINE-48' }, 'origin/main')).toBe(
      `${FILE}: BR-PIPELINE-47 is taken on origin/main by another entry ("A quote is signed once.").\n` +
        '    Renumber this one to BR-PIPELINE-48, and its ledger\'s Became: line with it.',
    );
  });

  it('cuts the base statement to its first 80 characters, on one line', () => {
    const long = `${'a'.repeat(78)}\nbcdef`;
    const line = clashLine({ file: FILE, id: 'BR-PIPELINE-47', theirs: long, next: 'BR-PIPELINE-48' }, 'origin/main');
    expect(line).toContain(`("${'a'.repeat(78)} b…")`);
  });
});

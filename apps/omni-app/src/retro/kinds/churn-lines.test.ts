import { describe, expect, it } from 'vitest';
import { changeBlocks, followLines, rewrittenRanges } from './churn-lines.ts';

const lines = (from, to, history) => Array.from({ length: to - from + 1 }, (_, i) => [from + i, history]);

describe('changeBlocks', () => {
  it('reads a new file as one block adding every line', () => {
    expect(changeBlocks('@@ -0,0 +1,3 @@\n+a\n+b\n+c')).toEqual([[1, 0, 1, 3]]);
  });

  it('reads a deleted file as one block removing every line', () => {
    expect(changeBlocks('@@ -1,2 +0,0 @@\n-a\n-b')).toEqual([[1, 2, 1, 0]]);
  });

  it('splits a hunk into blocks at its context lines, counting old and new lines apart', () => {
    const patch = [
      '@@ -3,9 +3,9 @@ function widget() {',
      ' three',
      ' four',
      '-five',
      '-six',
      '+FIVE',
      ' seven',
      '+inserted',
      '+inserted too',
      ' eight',
      ' nine',
      '-ten',
      ' eleven',
      '\\ No newline at end of file',
    ].join('\n');
    expect(changeBlocks(patch)).toEqual([
      [5, 2, 5, 1],
      [8, 0, 7, 2],
      [10, 1, 11, 0],
    ]);
  });

  it('reads several hunks, each from its own header', () => {
    const patch = ['@@ -1,2 +1,2 @@', '-a', '+A', ' b', '@@ -40,2 +40,3 @@', ' x', '+y', ' z'].join('\n');
    expect(changeBlocks(patch)).toEqual([
      [1, 1, 1, 1],
      [41, 0, 41, 1],
    ]);
  });

  it('reads a header without counts, and an empty line as context', () => {
    expect(changeBlocks('@@ -7 +7 @@\n-a\n+b')).toEqual([[7, 1, 7, 1]]);
    expect(changeBlocks('@@ -1,3 +1,3 @@\n\n-b\n+B\n c')).toEqual([[2, 1, 2, 1]]);
  });

  it('reads nothing from an empty patch', () => {
    expect(changeBlocks('')).toEqual([]);
  });
});

describe('followLines', () => {
  it('writes a new file’s lines with the commit that wrote them', () => {
    expect(followLines([], [[1, 0, 1, 3]], 'c1')).toEqual(lines(1, 3, ['c1']));
  });

  it('passes the commits of the lines a block replaces to the lines that replace them', () => {
    const before = lines(1, 6, ['c1']);
    const after = followLines(before, [[3, 2, 3, 3]], 'c2');
    expect(after).toEqual([...lines(1, 2, ['c1']), ...lines(3, 5, ['c1', 'c2']), ...lines(6, 7, ['c1'])]);
  });

  it('follows untouched lines through the blocks above them that shift their numbers', () => {
    const before = [...lines(10, 12, ['c1', 'c2'])];
    const after = followLines(before, [[1, 0, 1, 3], [5, 2, 8, 0]], 'c3');
    expect(after).toEqual([...lines(1, 3, ['c3']), ...lines(11, 13, ['c1', 'c2'])]);
  });

  it('gives an inserted line only the commit that inserted it, and drops a removed line', () => {
    const before = lines(1, 4, ['c1']);
    const after = followLines(before, [[3, 0, 3, 1], [4, 1, 5, 0]], 'c2');
    expect(after).toEqual([...lines(1, 2, ['c1']), [3, ['c2']], [4, ['c1']]]);
  });

  it('keeps each commit once, oldest first', () => {
    const before = [[1, ['c1', 'c2']], [2, ['c2']]];
    expect(followLines(before, [[1, 2, 1, 1]], 'c2')).toEqual([[1, ['c1', 'c2']]]);
  });
});

describe('rewrittenRanges', () => {
  it('groups consecutive lines each written in at least the given number of commits', () => {
    const tracked = [
      ...lines(1, 3, ['c1']),
      ...lines(4, 6, ['c1', 'c2', 'c3']),
      [7, ['c1', 'c2', 'c4']],
      [8, ['c1', 'c2']],
      [10, ['c1', 'c2', 'c3']],
    ];
    expect(rewrittenRanges(tracked, 3)).toEqual([
      { from: 4, to: 7, commits: ['c1', 'c2', 'c3', 'c4'] },
      { from: 10, to: 10, commits: ['c1', 'c2', 'c3'] },
    ]);
  });

  it('finds nothing below the threshold', () => {
    expect(rewrittenRanges(lines(1, 5, ['c1', 'c2']), 3)).toEqual([]);
  });
});

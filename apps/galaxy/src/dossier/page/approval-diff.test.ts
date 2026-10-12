import { describe, expect, it } from 'vitest';
import { lineDiff } from './approval-diff';

// The diff a voided or drifted approval shows above Approve (PRD 1322 s7): the lines of a pinned file
// that changed since it was approved, two unchanged lines around each change, a gap marked `…`.

const lines = (n: number, from = 1) => Array.from({ length: n }, (_, i) => `line ${i + from}`);

describe('lineDiff', () => {
  it('is empty when nothing changed', () => {
    expect(lineDiff('a\nb\nc', 'a\nb\nc')).toEqual([]);
  });

  it('shows a changed line as removed then added, with the lines around it', () => {
    expect(lineDiff('a\nb\nc', 'a\nB\nc')).toEqual([
      { sign: ' ', text: 'a' }, { sign: '-', text: 'b' }, { sign: '+', text: 'B' }, { sign: ' ', text: 'c' },
    ]);
  });

  it('keeps two unchanged lines around a change and marks the gaps', () => {
    const before = lines(10).join('\n');
    const after = [...lines(4), 'new', ...lines(6, 5)].join('\n');
    expect(lineDiff(before, after)).toEqual([
      { sign: '…', text: '' },
      { sign: ' ', text: 'line 3' }, { sign: ' ', text: 'line 4' },
      { sign: '+', text: 'new' },
      { sign: ' ', text: 'line 5' }, { sign: ' ', text: 'line 6' },
      { sign: '…', text: '' },
    ]);
  });

  it('finds the lines both keep between two changes', () => {
    expect(lineDiff('x\na\nb\ny', 'a\nz\nb')).toEqual([
      { sign: '-', text: 'x' }, { sign: ' ', text: 'a' }, { sign: '+', text: 'z' }, { sign: ' ', text: 'b' }, { sign: '-', text: 'y' },
    ]);
  });

  it('shows a whole file removed and added when the change is too large to match line by line', () => {
    const before = lines(1200).join('\n');
    const after = lines(1200, 5000).join('\n');
    const diff = lineDiff(before, after);
    expect(diff.filter((l) => l.sign === '-')).toHaveLength(1200);
    expect(diff.filter((l) => l.sign === '+')).toHaveLength(1200);
    expect(diff[0]).toEqual({ sign: '-', text: 'line 1' });
  });
});

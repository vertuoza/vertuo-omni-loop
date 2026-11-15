import { describe, expect, it } from 'vitest';
import { parsePrd } from '../ids.ts';
import { dropLine, droppedOf, dropSet, dropWords, standingAsks } from './drop.ts';

const p = parsePrd;
const GROUND: Record<number, string[] | null> = { 1: ['apps/a/'], 2: ['apps/b/'], 3: ['apps/a/x/'], 4: null, 5: ['apps/b/y/'] };
const territory = (prd: number): string[] | null => GROUND[prd] ?? null;
const order = [p(1), p(2), p(3), p(4), p(5)];

describe('dropSet', () => {
  it('takes the PRD and the later PRDs sharing its territory, in join order', () => {
    expect(dropSet({ order, prd: p(1), keep: false, territory })).toEqual({ prd: 1, sharing: [3], dropped: [1, 3] });
  });

  it('follows a chain: a later PRD sharing ground with one dropped before it goes too', () => {
    const chain: Record<number, string[]> = { 1: ['a/'], 2: ['a/'], 3: ['a/b/', 'c/'], 4: ['c/d/'] };
    expect(dropSet({ order: [p(1), p(2), p(3), p(4)], prd: p(2), keep: false, territory: (n) => chain[n] ?? null })?.dropped).toEqual([2, 3, 4]);
  });

  it('never takes an earlier PRD, nor one whose territory is unknown', () => {
    expect(dropSet({ order, prd: p(3), keep: false, territory })?.dropped).toEqual([3]);
    expect(dropSet({ order, prd: p(2), keep: false, territory })?.sharing).toEqual([5]);
  });

  it('with keep still names the PRDs sharing the territory, and drops only the PRD', () => {
    expect(dropSet({ order, prd: p(1), keep: true, territory })).toEqual({ prd: 1, sharing: [3], dropped: [1] });
  });

  it('is null for a PRD that is not on the branch', () => {
    expect(dropSet({ order, prd: p(9), keep: false, territory })).toBeNull();
  });
});

describe('standingAsks and droppedOf', () => {
  const ev = (kind: string, prd: number | null) => ({ kind, prd: prd === null ? null : p(prd) });

  it('an ask stands while the PRD is on the branch, until it is dropped', () => {
    expect(standingAsks([ev('prd-joined', 1), ev('drop-asked', 1), ev('prd-joined', 2), ev('drop-asked-keep', 2)])).toEqual([{ prd: 1, keep: false }, { prd: 2, keep: true }]);
    expect(standingAsks([ev('prd-joined', 1), ev('drop-asked', 1), ev('prd-dropped', 1)])).toEqual([]);
  });

  it('an ask for a PRD that is not on the branch is void, and a join clears an older ask', () => {
    expect(standingAsks([ev('drop-asked', 1)])).toEqual([]);
    expect(standingAsks([ev('prd-joined', 1), ev('drop-asked', 1), ev('prd-dropped', 1), ev('prd-joined', 1)])).toEqual([]);
  });

  it('a PRD is dropped from its drop until it joins again or lands', () => {
    expect([...droppedOf([ev('prd-joined', 1), ev('prd-dropped', 1)])]).toEqual([1]);
    expect([...droppedOf([ev('prd-dropped', 1), ev('prd-joined', 1)])]).toEqual([]);
    expect([...droppedOf([ev('prd-dropped', 1), ev('prd-merged', 1)])]).toEqual([]);
  });
});

describe('words', () => {
  it('names the command and what goes or stays', () => {
    expect(dropLine(41, p(12))).toBe('omni mission drop 41 12');
    const set = { prd: p(1), sharing: [p(3)], dropped: [p(1), p(3)] };
    expect(dropWords({ branch: 'mission/41-x', set, keep: false }).join('\n')).toContain('dropped with it: PRD 3');
    expect(dropWords({ branch: 'mission/41-x', set, keep: true }).join('\n')).toContain('kept on the branch (--keep): PRD 3');
    expect(dropWords({ branch: 'mission/41-x', set: { prd: p(1), sharing: [], dropped: [p(1)] }, keep: false })[1]).toBe('No later PRD on the branch shares its territory.');
  });
});

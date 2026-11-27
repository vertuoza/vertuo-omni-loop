// Bug #3371: whether a product PRD's merged work is in a base, on omni-loop-27's shape: its target feature pull request merged into
// a mission branch, and the mission's pull request then squash-merged that branch into the default branch.
import { describe, expect, it } from 'vitest';
import { parseProductPrdId } from '../ids.ts';
import { landedIn, saysPartOf, type MergedPull } from './landed.ts';

const P27 = parseProductPrdId('demo-27');
const MISSION = 'mission/70-settings';
const TARGET: MergedPull = { number: 83, base: MISSION, head: 'feat/demo-27', merge: 'a'.repeat(40) };
const MISSION_PR: MergedPull = { number: 118, base: 'main', head: MISSION, merge: 'b'.repeat(40) };

/** The reads of a repository where `pulls` merged, `onward` from each head, and `inBase` the commits the base holds. */
const reads = (pulls: MergedPull[], onward: MergedPull[], inBase: string[]) => ({
  partOf: () => pulls,
  from: (head: string) => onward.filter((one) => one.head === head),
  within: (sha: string) => inBase.includes(sha),
});

describe('landedIn (bug #3371)', () => {
  it('is landed when its target pull request merged into a mission branch and the mission pull request is in the base', async () => {
    expect(await landedIn(P27, reads([TARGET], [MISSION_PR], [MISSION_PR.merge]))).toEqual({ landed: true, via: `#83 into ${MISSION}, then #118 into main` });
  });

  it('is landed when its target pull request merge commit is in the base itself', async () => {
    expect(await landedIn(P27, reads([TARGET], [], [TARGET.merge]))).toEqual({ landed: true, via: '#83' });
  });

  it('is not landed while the mission pull request is not in the base, nor the target pull request', async () => {
    expect(await landedIn(P27, reads([TARGET], [MISSION_PR], []))).toEqual({ landed: false, why: `#83 into ${MISSION}, not in the base yet` });
  });

  it('is not landed with no merged pull request part of the PRD', async () => {
    expect(await landedIn(P27, reads([], [MISSION_PR], [MISSION_PR.merge]))).toEqual({ landed: false, why: 'no merged pull request says Part of demo-27' });
  });

  it('reads async reads too', async () => {
    const at = reads([TARGET], [MISSION_PR], [MISSION_PR.merge]);
    const async = { partOf: () => Promise.resolve(at.partOf()), from: (head: string) => Promise.resolve(at.from(head)), within: (sha: string) => Promise.resolve(at.within(sha)) };
    expect((await landedIn(P27, async)).landed).toBe(true);
  });
});

describe('saysPartOf (bug #3371)', () => {
  it('reads the line alone or followed by its page link, and nothing else', () => {
    expect(saysPartOf('Part of demo-27', P27)).toBe(true);
    expect(saysPartOf('Part of demo-27 · https://example.test/prd/1\n\n## Slices', P27)).toBe(true);
    expect(saysPartOf('Part of demo-270', P27)).toBe(false);
    expect(saysPartOf('See Part of demo-27', P27)).toBe(false);
    expect(saysPartOf(null, P27)).toBe(false);
  });
});

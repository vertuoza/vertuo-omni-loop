// PRD 1118, slice s1: what a care round reads of one target of a plan repository's board.
import { describe, expect, it } from 'vitest';
import type { LandingRow } from '../board.ts';
import { parsePr } from '../ids.ts';
import { claimedIn, landingsIn } from './target.ts';

const row = (id: string, repo: string, state: string) => ({ id, repo, state });
const landing = (n: number, repo: string): LandingRow => ({
  landing: n,
  name: `l${n}`,
  branch: `feat/w-${n}of2-l${n}`,
  repo,
  slices: [],
  merged: 0,
  open: 0,
  notStarted: 0,
  complete: false,
  current: false,
  pr: { number: parsePr(n), state: 'draft', base: 'main' },
});

describe('claimedIn', () => {
  const rows = [row('s1', 'backend', 'in-flight'), row('s2', 'frontend', 'merged'), row('s3', 'frontend', 'claimed-stale'), row('s4', 'backend', 'runnable')];

  it("counts only the claims among the target's own slices", () => {
    expect(claimedIn(rows, 'backend')).toEqual(['s1']);
    expect(claimedIn(rows, 'frontend')).toEqual(['s3']);
  });

  it('counts every claim without a target, as a one-repository board does', () => {
    expect(claimedIn(rows, null)).toEqual(['s1', 's3']);
  });

  it('is empty for a target whose slices hold no claim while another target builds', () => {
    expect(claimedIn([row('s1', 'backend', 'in-flight'), row('s2', 'frontend', 'merged')], 'frontend')).toEqual([]);
  });
});

describe('landingsIn', () => {
  it("keeps only the target's own landings, in order", () => {
    const rows = [landing(1, 'backend'), landing(1, 'frontend'), landing(2, 'backend')];
    expect(landingsIn(rows, 'backend').map((l) => [l.repo, l.landing])).toEqual([
      ['backend', 1],
      ['backend', 2],
    ]);
    expect(landingsIn(rows, 'web')).toEqual([]);
  });
});

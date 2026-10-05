import { describe, expect, it } from 'vitest';
import type { LandingRow } from '../board.ts';
import { parsePr } from '../ids.ts';
import { landingChain, landingPrToWatch } from './chain.ts';

function landing(n: number, pr: LandingRow['pr']): LandingRow {
  return { landing: n, name: `l${n}`, branch: `feat/w-${n}of3-l${n}`, slices: [], merged: 0, open: 0, notStarted: 0, complete: false, pr };
}

describe('landingChain', () => {
  it('restacks nothing while landing 1 is open', () => {
    const chain = landingChain(
      [landing(1, { number: parsePr(1), state: 'draft', base: 'main' }), landing(2, { number: parsePr(2), state: 'draft', base: 'feat/w-1of3-l1' })],
      'main',
    );
    expect(chain).toEqual([]);
  });

  it('after landing 1 merged with its branch deleted, finds landing 2 already on the default branch: no retarget, a rebase', () => {
    const chain = landingChain(
      [
        landing(1, { number: parsePr(1), state: 'merged', base: 'main' }),
        landing(2, { number: parsePr(2), state: 'draft', base: 'main' }),
        landing(3, { number: parsePr(3), state: 'draft', base: 'feat/w-2of3-l2' }),
      ],
      'main',
    );
    expect(chain).toEqual([
      {
        landing: 2,
        pr: 2,
        branch: 'feat/w-2of3-l2',
        base: 'main',
        retarget: false,
        after: { landing: 1, pr: 1, branch: 'feat/w-1of3-l1' },
        later: [{ landing: 3, pr: 3, branch: 'feat/w-3of3-l3' }],
      },
    ]);
  });

  it('after landing 1 merged with its branch kept, retargets landing 2 onto the default branch', () => {
    const [link] = landingChain(
      [landing(1, { number: parsePr(1), state: 'merged', base: 'main' }), landing(2, { number: parsePr(2), state: 'ready', base: 'feat/w-1of3-l1' })],
      'main',
    );
    expect(link).toMatchObject({ landing: 2, retarget: true, base: 'feat/w-1of3-l1', later: [] });
  });

  it('restacks the first open landing after the last merged one, and nothing once all merged', () => {
    const rows = [
      landing(1, { number: parsePr(1), state: 'merged', base: 'main' }),
      landing(2, { number: parsePr(2), state: 'merged', base: 'main' }),
      landing(3, { number: parsePr(3), state: 'draft', base: 'feat/w-2of3-l2' }),
    ];
    expect(landingChain(rows, 'main').map((link) => [link.landing, link.after.landing])).toEqual([[3, 2]]);
    expect(landingChain(rows.map((row) => ({ ...row, pr: { ...row.pr, state: 'merged' as const } })), 'main')).toEqual([]);
  });
});

describe('landingPrToWatch', () => {
  it('watches the first open landing PR, else the last one opened', () => {
    expect(landingPrToWatch([landing(1, { number: parsePr(1), state: 'merged', base: 'main' }), landing(2, { number: parsePr(2), state: 'draft', base: 'main' })])).toBe(2);
    expect(landingPrToWatch([landing(1, { number: parsePr(1), state: 'merged', base: 'main' }), landing(2, { number: parsePr(2), state: 'merged', base: 'main' })])).toBe(2);
    expect(landingPrToWatch([landing(1, { number: null, state: 'absent', base: null })])).toBeNull();
  });
});

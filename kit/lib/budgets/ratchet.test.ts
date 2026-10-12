// PRD 1679, s2: the ratchet on its pure inputs — every row of the spec's verdict table, and the
// raises a person said yes to, matched by target and ceiling alone.
import { describe, expect, it } from 'vitest';
import { overall, raiseLine, ratchet, settledRaises } from './ratchet.ts';
import type { Raise, RatchetInput, TargetVerdict } from './ratchet.ts';

const DESIGN = 'form:design';
const measured = (bytes: number) => [{ target: DESIGN, bytes }];

function one(input: Partial<RatchetInput>): TargetVerdict {
  const [verdict] = ratchet({ base: {}, head: {}, measures: measured(100), raises: [], ...input });
  if (verdict === undefined) throw new Error('no verdict');
  return verdict;
}

const yes = (ceiling: number, target = DESIGN): Raise => ({ id: 's2-01-raise', target, ceiling });

describe('ratchet: the verdict table', () => {
  it('is green under a ceiling that did not move, and at the ceiling exactly', () => {
    expect(one({ base: { [DESIGN]: 200 }, head: { [DESIGN]: 200 } })).toEqual({
      target: DESIGN, verdict: 'green', bytes: 100, ceiling: 200, baseCeiling: 200, raised: false, raise: null, error: null,
    });
    expect(one({ base: { [DESIGN]: 100 }, head: { [DESIGN]: 100 } }).verdict).toBe('green');
  });

  it('is green when the ceiling is lowered, and over budget when lowered below the measure', () => {
    expect(one({ base: { [DESIGN]: 300 }, head: { [DESIGN]: 200 } })).toMatchObject({ verdict: 'green', raised: false });
    expect(one({ base: { [DESIGN]: 300 }, head: { [DESIGN]: 99 } }).verdict).toBe('over-budget');
  });

  it('is over budget one byte past the ceiling', () => {
    expect(one({ base: { [DESIGN]: 99 }, head: { [DESIGN]: 99 } })).toMatchObject({ verdict: 'over-budget', bytes: 100, ceiling: 99, raised: false });
  });

  it('needs a yes for a raised ceiling, and for a first ceiling where the base has ceilings', () => {
    expect(one({ base: { [DESIGN]: 150 }, head: { [DESIGN]: 200 } })).toMatchObject({ verdict: 'needs-yes', raised: true, raise: null, baseCeiling: 150 });
    expect(one({ base: { other: 1 }, head: { [DESIGN]: 200 } })).toMatchObject({ verdict: 'needs-yes', raised: true, baseCeiling: null });
  });

  it('is green for a raised or first ceiling a person said yes to, naming the item', () => {
    expect(one({ base: { [DESIGN]: 150 }, head: { [DESIGN]: 200 }, raises: [yes(200)] })).toMatchObject({ verdict: 'green', raised: true, raise: 's2-01-raise' });
    expect(one({ base: {}, head: { [DESIGN]: 200 }, raises: [yes(200)] })).toMatchObject({ verdict: 'green', raise: 's2-01-raise' });
  });

  it('does not match a raise for another target or another ceiling', () => {
    expect(one({ base: { [DESIGN]: 150 }, head: { [DESIGN]: 200 }, raises: [yes(200, 'form:testing')] }).verdict).toBe('needs-yes');
    expect(one({ base: { [DESIGN]: 150 }, head: { [DESIGN]: 200 }, raises: [yes(180)] }).verdict).toBe('needs-yes');
  });

  it('is red again when the ceiling changes after a settled raise', () => {
    expect(one({ base: { [DESIGN]: 150 }, head: { [DESIGN]: 250 }, raises: [yes(200)] }).verdict).toBe('needs-yes');
  });

  it('is over budget, not needs-yes, when a raised ceiling is still too small', () => {
    expect(one({ base: { [DESIGN]: 50 }, head: { [DESIGN]: 60 } })).toMatchObject({ verdict: 'over-budget', raised: true });
  });

  it('raises nothing on an install: a base with no ceilings file', () => {
    expect(one({ base: null, head: { [DESIGN]: 200 } })).toMatchObject({ verdict: 'green', raised: false, baseCeiling: null });
    expect(one({ base: null, head: { [DESIGN]: 50 } }).verdict).toBe('over-budget');
  });

  it('is green for a target with no ceiling at the head or the base', () => {
    expect(one({ base: {}, head: {} })).toMatchObject({ verdict: 'green', ceiling: null, raised: false });
  });

  it('needs a yes no item can give when a ceiling the base had is removed', () => {
    expect(one({ base: { [DESIGN]: 200 }, head: {}, raises: [yes(200)] })).toMatchObject({ verdict: 'needs-yes', raised: true, raise: null, ceiling: null });
  });

  it('is neutral on a measurement error, carrying why', () => {
    const [verdict] = ratchet({ base: { [DESIGN]: 1 }, head: { [DESIGN]: 1 }, measures: [{ target: DESIGN, error: 'pointer leads nowhere' }], raises: [] });
    expect(verdict).toMatchObject({ verdict: 'neutral', bytes: null, error: 'pointer leads nowhere', ceiling: 1 });
  });

  it('reads a ceiling the head names only for itself, never one inherited from the object', () => {
    expect(one({ base: {}, head: { toString: 5 } })).toMatchObject({ ceiling: null, verdict: 'green' });
  });

  it('keeps the measure order', () => {
    const verdicts = ratchet({ base: null, head: {}, measures: [{ target: 'b', bytes: 1 }, { target: 'a', bytes: 2 }], raises: [] });
    expect(verdicts.map(({ target }) => target)).toEqual(['b', 'a']);
  });
});

describe('overall', () => {
  const v = (verdict: TargetVerdict['verdict']): TargetVerdict => ({ target: 't', verdict, bytes: 1, ceiling: 1, baseCeiling: 1, raised: false, raise: null, error: null });
  it('is red on any red target, else neutral on an error, else green', () => {
    expect(overall([v('green'), v('neutral'), v('over-budget')])).toBe('red');
    expect(overall([v('needs-yes'), v('neutral')])).toBe('red');
    expect(overall([v('green'), v('neutral')])).toBe('neutral');
    expect(overall([v('green')])).toBe('green');
    expect(overall([])).toBe('green');
  });
});

describe('settledRaises', () => {
  const text = (lines: string[]) => ['---', 'id: s2-01-raise', '---', '', '## What I had to decide', '', ...lines].join('\n');

  it('reads every raise line of an agreed entry, by target and ceiling', () => {
    const entry = { id: 's2-01-raise', verdict: 'agreed', itemText: text([raiseLine(DESIGN, 10240), 'and BUDGET RAISE: `session` to 4096 bytes']) };
    expect(settledRaises([entry])).toEqual([
      { id: 's2-01-raise', target: DESIGN, ceiling: 10240 },
      { id: 's2-01-raise', target: 'session', ceiling: 4096 },
    ]);
  });

  it('reads nothing from an entry adopted or drifted, or with no raise line', () => {
    const itemText = text([raiseLine(DESIGN, 10240)]);
    expect(settledRaises([{ id: 'a', verdict: 'adopted', itemText }, { id: 'b', verdict: 'drifted', itemText }, { id: 'c', verdict: undefined, itemText }])).toEqual([]);
    expect(settledRaises([{ id: 'd', verdict: 'agreed', itemText: text(['Raise the design ceiling.']) }])).toEqual([]);
  });

  it('reads a raise line however its words are spaced', () => {
    const entry = { id: 'e', verdict: 'agreed', itemText: 'Budget raise:`session`  to  4096  bytes' };
    expect(settledRaises([entry])).toEqual([{ id: 'e', target: 'session', ceiling: 4096 }]);
  });

  it('writes the line it reads', () => {
    expect(raiseLine('context:AGENTS.md', 2048)).toBe('Budget raise: `context:AGENTS.md` to 2048 bytes');
  });
});

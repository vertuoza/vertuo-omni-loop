import { describe, expect, it } from 'vitest';
import { addWorkingDays, decide, escalates } from './escalation.ts';
import type { EscalationSettings, HeldThing } from './escalation.ts';

const settings: EscalationSettings = {
  owners: [{ login: 'pierrederval', delegate: 'jdoe' }, 'acme/platform'],
  leadership: ['cto-login'],
  workingDays: 2,
};

// Friday 2026-10-09, 15:00 UTC.
const FRIDAY = '2026-10-09T15:00:00Z';
const law: HeldThing = { thing: 'N-PRODUCT-4', kind: 'law', firstHeld: FRIDAY, answered: false };
const item: HeldThing = { thing: 's1-01-name-a-delegate', kind: 'item', firstHeld: FRIDAY, answered: false };

const at = (iso: string): Date => new Date(iso);

describe('addWorkingDays', () => {
  it('reaches Tuesday 15:00 UTC two working days after Friday 15:00 UTC', () => {
    expect(addWorkingDays(at(FRIDAY), 2).toISOString()).toBe('2026-10-13T15:00:00.000Z');
  });

  it('counts a Saturday start from Monday 00:00 UTC', () => {
    expect(addWorkingDays(at('2026-10-10T11:30:00Z'), 2).toISOString()).toBe('2026-10-14T00:00:00.000Z');
  });

  it('counts a Sunday start from Monday 00:00 UTC', () => {
    expect(addWorkingDays(at('2026-10-11T23:59:00Z'), 1).toISOString()).toBe('2026-10-13T00:00:00.000Z');
  });

  it('counts plain weekdays one day each', () => {
    expect(addWorkingDays(at('2026-10-12T09:00:00Z'), 3).toISOString()).toBe('2026-10-15T09:00:00.000Z');
  });

  it('crosses two weekends for ten working days', () => {
    expect(addWorkingDays(at('2026-10-12T09:00:00Z'), 10).toISOString()).toBe('2026-10-26T09:00:00.000Z');
  });
});

describe('decide, for a held law', () => {
  it('stays at step 0 just before the first step falls due, asking nobody new', () => {
    const [one] = decide([law], at('2026-10-13T14:59:59Z'), settings);
    expect(one).toEqual({
      thing: 'N-PRODUCT-4',
      kind: 'law',
      firstHeld: FRIDAY,
      step: 0,
      asked: [],
      newlyAsked: [],
      nextDue: '2026-10-13T15:00:00Z',
    });
  });

  it('asks each delegate at step 1, never the owners or leadership', () => {
    const [one] = decide([law], at('2026-10-13T15:00:00Z'), settings);
    expect(one).toMatchObject({ step: 1, asked: ['jdoe'], newlyAsked: ['jdoe'], nextDue: '2026-10-15T15:00:00Z' });
  });

  it('adds leadership at step 2, and no step falls due after it', () => {
    const [one] = decide([law], at('2026-10-15T15:00:00Z'), settings);
    expect(one).toMatchObject({ step: 2, asked: ['jdoe', 'cto-login'], newlyAsked: ['cto-login'], nextDue: null });
  });

  it('asks nobody at step 1 when no owner has a delegate, and leadership at step 2', () => {
    const own: EscalationSettings = { ...settings, owners: ['pierrederval'] };
    expect(decide([law], at('2026-10-13T15:00:00Z'), own)[0]).toMatchObject({ step: 1, asked: [], newlyAsked: [] });
    expect(decide([law], at('2026-10-15T15:00:00Z'), own)[0]).toMatchObject({ step: 2, asked: ['cto-login'] });
  });
});

describe('decide, for a held item', () => {
  it('stays at step 0 before the first step falls due', () => {
    expect(decide([item], at('2026-10-12T10:00:00Z'), settings)[0]).toMatchObject({ step: 0, asked: [], newlyAsked: [] });
  });

  it('asks each owner and each delegate at step 1', () => {
    const [one] = decide([item], at('2026-10-14T08:00:00Z'), settings);
    expect(one).toMatchObject({
      step: 1,
      asked: ['pierrederval', 'jdoe', 'acme/platform'],
      newlyAsked: ['pierrederval', 'jdoe', 'acme/platform'],
      nextDue: '2026-10-15T15:00:00Z',
    });
  });

  it('adds leadership at step 2', () => {
    const [one] = decide([item], at('2026-10-20T08:00:00Z'), settings);
    expect(one).toMatchObject({
      step: 2,
      asked: ['pierrederval', 'jdoe', 'acme/platform', 'cto-login'],
      newlyAsked: ['cto-login'],
      nextDue: null,
    });
  });

  it('names a person once, whatever its case or its @, when an owner is also a leader', () => {
    const twice: EscalationSettings = { ...settings, leadership: ['@PierreDerval', 'cto-login'] };
    expect(decide([item], at('2026-10-20T08:00:00Z'), twice)[0]).toMatchObject({
      asked: ['pierrederval', 'jdoe', 'acme/platform', 'cto-login'],
      newlyAsked: ['cto-login'],
    });
  });
});

describe('decide, when nobody is to be asked', () => {
  it('asks nobody about an answered thing, and no step falls due', () => {
    const answered = decide([{ ...law, answered: true }, { ...item, answered: true }], at('2026-10-20T08:00:00Z'), settings);
    for (const one of answered) expect(one).toMatchObject({ asked: [], newlyAsked: [], nextDue: null });
  });

  it('asks nobody, ever, with no delegate and no leadership', () => {
    const none: EscalationSettings = { owners: ['pierrederval', 'acme/platform'], leadership: [], workingDays: 2 };
    expect(escalates(none)).toBe(false);
    for (const one of decide([law, item], at('2026-11-30T08:00:00Z'), none)) {
      expect(one).toMatchObject({ step: 0, asked: [], newlyAsked: [], nextDue: null });
    }
  });

  it('escalates with a delegate alone, or leadership alone', () => {
    expect(escalates(settings)).toBe(true);
    expect(escalates({ owners: [{ login: 'a', delegate: 'b' }], leadership: [], workingDays: 2 })).toBe(true);
    expect(escalates({ owners: [], leadership: ['c'], workingDays: 2 })).toBe(true);
  });
});

describe('what decide gives', () => {
  it('has no field that approves, adopts, labels or sets a verdict', () => {
    const out = decide([law, item, { ...item, answered: true }], at('2026-10-20T08:00:00Z'), settings);
    for (const one of out) {
      expect(Object.keys(one).sort()).toEqual(['asked', 'firstHeld', 'kind', 'newlyAsked', 'nextDue', 'step', 'thing']);
    }
  });

  it('keeps the order of the held things', () => {
    expect(decide([item, law], at(FRIDAY), settings).map((one) => one.thing)).toEqual(['s1-01-name-a-delegate', 'N-PRODUCT-4']);
  });

  it('refuses a first-held time it cannot read', () => {
    expect(() => decide([{ ...law, firstHeld: 'last week' }], at(FRIDAY), settings)).toThrow(/firstHeld/);
  });
});

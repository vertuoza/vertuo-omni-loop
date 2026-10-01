import { describe, expect, it } from 'vitest';
import { constituentBreak, constituentBreakInput, constituentBreakOld } from './constituent-break';
import { JEV_DECISIONS, jevEntry } from './index';

// The constituent break's registry entry (PRD 871 s4): a Noul "does this spec break the Statement or a
// Never line?", mapped with the decision's threshold; what it sends Jev (the spec, the constituents and
// today's verdict); and the state and old answer the App may send.

const STATE = {
  spec: "The gallery loads its rows with fetch('/api/v1/projects') on the real backend.",
  statement: 'The component workshop, shown with fixtures.',
  never: [{ id: 'never#1', text: 'calls real Vertuoza data or real Vertuoza APIs' }],
  verdict: { broken: true, findings: [{ quote: "fetch('/api/v1/projects')", constituents: ['never#1'], why: 'a real API' }] },
};

describe('constituent-break', () => {
  it('is registered and listed on Settings › Jev with its question and what it sends', () => {
    expect(jevEntry('constituent-break')).toBe(constituentBreak);
    const row = JEV_DECISIONS.find((d) => d.name === 'constituent-break');
    expect(row?.title).toBe('Constituent break');
    expect(row?.sends).toMatch(/spec/);
    const q = constituentBreak.question;
    expect(q.type).toBe('noul');
    if (q.type !== 'noul') return;
    expect(q.statement).toMatch(/Statement/);
    expect(q.statement).toMatch(/Never lines/);
  });

  it('is asked by the App only, never from a terminal', () => {
    expect(constituentBreak.terminal).toBeUndefined();
  });

  it('maps a Noul at or above the threshold to broken, under it to not broken', () => {
    expect(constituentBreak.value(0.5, { threshold: 0.5 })).toBe(true);
    expect(constituentBreak.value(0.49, { threshold: 0.5 })).toBe(false);
    expect(constituentBreak.value(0.7, { threshold: 0.75 })).toBe(false);
    expect(constituentBreak.value('true', { threshold: 0.5 })).toBeNull();
    expect(constituentBreak.value(1.1, { threshold: 0.5 })).toBeNull();
    expect(constituentBreak.show(true)).toBe('true');
  });

  it('gives Jev the Statement, the Never lines, today’s verdict and the spec', () => {
    const state = constituentBreak.state(constituentBreakInput(STATE)!);
    expect(state).toContain('Statement: The component workshop, shown with fixtures.');
    expect(state).toContain('- never#1: calls real Vertuoza data or real Vertuoza APIs');
    expect(state).toContain("Today's verdict: broken");
    expect(state).toContain(`- never#1: "fetch('/api/v1/projects')" (a real API)`);
    expect(state).toContain(STATE.spec);
  });

  it('reads a state without a verdict or a Statement, and refuses one with nothing to judge by', () => {
    expect(constituentBreakInput({ spec: 'x', never: STATE.never })).toEqual({ spec: 'x', statement: null, never: STATE.never, verdict: null });
    expect(constituentBreakInput({ spec: 'x' })).toBeNull();
    expect(constituentBreakInput({ ...STATE, spec: '' })).toBeNull();
    expect(constituentBreakInput({ ...STATE, never: [{ id: 'claim-4', text: 'x' }] })).toBeNull();
    expect(constituentBreakInput({ ...STATE, extra: 1 })).toBeNull();
    expect(constituentBreakInput(null)).toBeNull();
  });

  it('reads today’s answer as true or false only', () => {
    expect(constituentBreakOld('true')).toBe(true);
    expect(constituentBreakOld('false')).toBe(false);
    expect(constituentBreakOld('red')).toBeNull();
    expect(constituentBreakOld(true)).toBeNull();
  });
});

import { describe, expect, it, vi } from 'vitest';
import type { JevOutcome } from '../client';
import { decide, type JevDecideDeps } from '../resolve';
import type { JevCall, JevMode } from '../store';
import { JEV_DECISIONS, jevEntry } from './index';
import { lawWorth, lawWorthInput, lawWorthOld } from './law-worth';
import { sure } from '../../arcade/test/sure';

vi.mock('server-only', () => ({}));

// Worth a law's registry entry (PRD 1342 s3): a Noul "is this decision worth a law, an executable test
// that fails when it is broken?", mapped with the decision's threshold; what it sends Jev (the statement,
// its Why, the principle it serves, the domain and the PRD's title); the state and old answer the App's
// harvest and `omni decide law-worth` send; and the resolver running it Off, in Shadow and On.

const STATE = {
  statement: 'A sub-PR is never merged into the default branch.',
  why: 'A person merges into main; the loop only merges into a feature branch.',
  principle: 'principle#3: A person owns what reaches main.',
  domain: 'delivery',
  prdTitle: 'Laws are born with their test',
};

describe('law-worth', () => {
  it('is registered and listed on Settings › Jev with its question and what it sends', () => {
    expect(jevEntry('law-worth')).toBe(lawWorth);
    const row = sure(JEV_DECISIONS.find((d) => d.name === 'law-worth'), 'the law-worth row');
    expect(row.title).toBe('Worth a law');
    for (const part of [/statement/i, /why/i, /principle/i, /domain/i, /PRD/]) expect(row.sends).toMatch(part);
    const q = lawWorth.question;
    expect(q.type).toBe('noul');
    if (q.type !== 'noul') return;
    expect(q.statement).toMatch(/worth a law/);
    expect(q.statement).toMatch(/test that fails when it is broken/);
  });

  it('maps a Noul at or above the threshold to worth a law, under it to not', () => {
    expect(lawWorth.value(0.5, { threshold: 0.5 })).toBe(true);
    expect(lawWorth.value(0.49, { threshold: 0.5 })).toBe(false);
    expect(lawWorth.value('yes', { threshold: 0.5 })).toBeNull();
    expect(lawWorth.value(-0.1, { threshold: 0.5 })).toBeNull();
    expect(lawWorth.show(true)).toBe('true');
  });

  it('sends the statement, its Why, the principle, the domain and the PRD title', () => {
    const input = sure(lawWorthInput(STATE), 'the input');
    const state = String(lawWorth.state(input));
    for (const part of Object.values(STATE)) expect(state).toContain(part);
    const bare = String(lawWorth.state(sure(lawWorthInput({ statement: 'Never log a key.' }), 'the bare input')));
    expect(bare).toBe('Statement: Never log a key.');
  });

  it('can be asked from a terminal, reading the state and the classifier’s own answer', () => {
    const terminal = sure(lawWorth.terminal, 'the terminal');
    expect(terminal.input(STATE)).toEqual(STATE);
    expect(terminal.input({ statement: 'Never log a key.' })).toEqual({ statement: 'Never log a key.', why: null, principle: null, domain: null, prdTitle: null });
    expect(terminal.old('true')).toBe(true);
    expect(terminal.old('false')).toBe(false);
    expect(terminal.old('yes')).toBeNull();
    expect(lawWorthOld('false')).toBe(false);
  });

  it('refuses a state that is not one: no statement, an unknown key, a field past its cap', () => {
    expect(lawWorthInput(null)).toBeNull();
    expect(lawWorthInput({ why: 'because' })).toBeNull();
    expect(lawWorthInput({ statement: '   ' })).toBeNull();
    expect(lawWorthInput({ ...STATE, kind: 'rule' })).toBeNull();
    expect(lawWorthInput({ ...STATE, statement: 'x'.repeat(2001) })).toBeNull();
    expect(lawWorthInput({ ...STATE, why: 'x'.repeat(8001) })).toBeNull();
    expect(lawWorthInput({ ...STATE, prdTitle: 7 })).toBeNull();
  });
});

describe('law-worth, through the resolver', () => {
  const input = sure(lawWorthInput(STATE), 'the input');

  function world(mode: JevMode, outcome: JevOutcome) {
    const asked: string[] = [];
    const logged: JevCall[] = [];
    const deps: JevDecideDeps = {
      settings: (_w, decision) => Promise.resolve({ decision, mode, threshold: 0.5, floor: 0.4 }),
      key: () => Promise.resolve({ kind: 'key', key: 'ts-key' }),
      ask: (_key, state) => {
        asked.push(String(state));
        return Promise.resolve(outcome);
      },
      log: (_w, call) => {
        logged.push(call);
        return Promise.resolve();
      },
    };
    return { deps, asked, logged };
  }
  const answered = (noul: number): JevOutcome => ({ kind: 'answered', model: 'jev-1.13.0', answer: noul, confidence: Math.abs(2 * noul - 1), probabilities: null, ms: 50 });
  const ask = (w: ReturnType<typeof world>, old = false) =>
    decide(w.deps, { workspace: 'w1', entry: lawWorth, input, old: () => Promise.resolve(old), ref: 'PRD 1342' });

  it('Off: the classifier’s answer counts, and Jev is never asked', async () => {
    const w = world('off', answered(0.95));
    expect(await ask(w, false)).toMatchObject({ value: false, decidedBy: 'old' });
    expect(w.asked).toEqual([]);
    expect(w.logged).toEqual([]);
  });

  it('Shadow: the classifier’s answer counts, and Jev’s is logged beside it', async () => {
    const w = world('shadow', answered(0.95));
    expect(await ask(w, false)).toMatchObject({ value: false, decidedBy: 'old' });
    expect(w.asked).toHaveLength(1);
    expect(w.logged).toEqual([expect.objectContaining({ decision: 'law-worth', mode: 'shadow', jevAnswer: 'true', oldAnswer: 'false', decidedBy: 'old' })]);
  });

  it('On: Jev’s answer counts at or above the floor; under it, or when Jev fails, the classifier’s', async () => {
    const sure_ = world('on', answered(0.95));
    expect(await ask(sure_, false)).toMatchObject({ value: true, decidedBy: 'jev' });

    const unsure = world('on', answered(0.6));
    expect(await ask(unsure, false)).toMatchObject({ value: false, decidedBy: 'old' });
    expect(unsure.logged).toEqual([expect.objectContaining({ outcome: 'under-floor', decidedBy: 'old' })]);

    const down = world('on', { kind: 'failed', reason: 'timeout', status: null, message: 'Jev timed out.', ms: 5000 });
    expect(await ask(down, true)).toMatchObject({ value: true, decidedBy: 'old' });
    expect(down.logged).toEqual([expect.objectContaining({ outcome: 'failed' })]);
  });
});

import { randomBytes } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { JevOutcome, JevQuestion } from './client';
import type { JevDecisionEntry } from './decisions';
import { decide, openKey, resolve, type JevAttempt, type JevDecideDeps, type JevKey } from './resolve';
import { sealSecret } from './secret-box';
import type { JevCall, JevDecisionSettings, JevMode } from './store';
import { sure } from '../arcade/sure';

// The resolver (PRD 812 s2): every mode × every outcome gives the answer that counts, who decided, and
// the one log row (Off logs nothing: Jev is not called). Decisions 4 and 6: On replaces in both
// directions, and Jev never blocks anything.

type Colour = 'red' | 'green' | 'blue';
const COLOURS: Colour[] = ['red', 'green', 'blue'];
const QUESTION: JevQuestion = { type: 'choice', instructions: 'Which colour?', options: COLOURS.map((key) => ({ key, description: key })) };
const colour: JevDecisionEntry<string, Colour> = {
  name: 'question-category',
  question: QUESTION,
  state: (input) => `The sky is ${input}.`,
  value: (answer) => (COLOURS.includes(answer as Colour) ? (answer as Colour) : null),
  show: (value) => value,
};

const W = 'ws-1';
const settings = (mode: JevMode, over: Partial<JevDecisionSettings> = {}): JevDecisionSettings =>
  ({ decision: 'question-category', mode, threshold: 0.5, floor: 0.4, ...over });
const answered = (answer: string | number, confidence = 0.9): JevOutcome =>
  ({ kind: 'answered', model: 'jev-1.13.0', answer, confidence, probabilities: null, ms: 120 });
const FAILED: JevOutcome = { kind: 'failed', reason: 'timeout', status: null, message: 'Jev did not answer within 5 s.', ms: 5000 };

const row = (over: Partial<JevCall>): JevCall => ({
  decision: 'question-category', mode: 'on', outcome: 'answered', model: 'jev-1.13.0', jevAnswer: 'blue', confidence: 0.9,
  oldAnswer: 'red', counted: 'blue', decidedBy: 'jev', ref: 'round:r1', reason: null, ms: 120, ...over,
});

const run = (mode: JevMode, attempt: JevAttempt | null, old: Colour | null = 'red', over: Partial<JevDecisionSettings> = {}) =>
  resolve({ entry: colour, settings: settings(mode, over), old, attempt, ref: 'round:r1' });

describe('resolve: Off', () => {
  it('counts the old answer and logs nothing: Jev is not called', () => {
    expect(run('off', null)).toEqual({ value: 'red', decidedBy: 'old', confidence: null, call: null });
    expect(run('off', null, null)).toEqual({ value: null, decidedBy: 'old', confidence: null, call: null });
  });
});

describe('resolve: Shadow', () => {
  it('counts the old answer and logs Jev\'s beside it', () => {
    expect(run('shadow', answered('blue'))).toEqual({
      value: 'red', decidedBy: 'old', confidence: null,
      call: row({ mode: 'shadow', counted: 'red', decidedBy: 'old' }),
    });
  });

  it('logs an answer under the floor as such, and the old answer still counts', () => {
    const got = run('shadow', answered('blue', 0.2));
    expect(got.value).toBe('red');
    expect(got.call).toEqual(row({ mode: 'shadow', outcome: 'under-floor', confidence: 0.2, counted: 'red', decidedBy: 'old' }));
  });

  it('logs a failure and a missing key', () => {
    expect(run('shadow', FAILED).call).toEqual(row({
      mode: 'shadow', outcome: 'failed', model: null, jevAnswer: null, confidence: null, counted: 'red', decidedBy: 'old',
      reason: 'Jev did not answer within 5 s.', ms: 5000,
    }));
    expect(run('shadow', { kind: 'no-key' }).call).toMatchObject({ outcome: 'no-key', counted: 'red', decidedBy: 'old', ms: null });
  });
});

describe('resolve: On', () => {
  it('counts Jev\'s answer when it answered above the floor, even against the old one (decision 4)', () => {
    expect(run('on', answered('blue', 0.82))).toEqual({ value: 'blue', decidedBy: 'jev', confidence: 0.82, call: row({ confidence: 0.82 }) });
  });

  it('counts Jev\'s answer at the floor exactly, and when there is no old answer', () => {
    expect(run('on', answered('green', 0.4)).value).toBe('green');
    const got = run('on', answered('green'), null);
    expect(got).toMatchObject({ value: 'green', decidedBy: 'jev' });
    expect(got.call).toMatchObject({ oldAnswer: null, counted: 'green' });
  });

  it('counts the old answer when Jev answered under the floor', () => {
    const got = run('on', answered('blue', 0.39));
    expect(got).toMatchObject({ value: 'red', decidedBy: 'old', confidence: null });
    expect(got.call).toMatchObject({ outcome: 'under-floor', jevAnswer: 'blue', confidence: 0.39, counted: 'red', decidedBy: 'old' });
  });

  it('uses the decision\'s own floor', () => {
    expect(run('on', answered('blue', 0.6), 'red', { floor: 0.7 }).value).toBe('red');
    expect(run('on', answered('blue', 0.6), 'red', { floor: 0.5 }).value).toBe('blue');
  });

  it('counts the old answer when Jev failed, had no key, or its key could not be opened', () => {
    for (const attempt of [FAILED, { kind: 'no-key' }, { kind: 'unopened', message: 'no master key' }] as JevAttempt[]) {
      const got = run('on', attempt);
      expect(got).toMatchObject({ value: 'red', decidedBy: 'old' });
      expect(got.call).toMatchObject({ decidedBy: 'old', counted: 'red', jevAnswer: null });
    }
    expect(run('on', { kind: 'unopened', message: 'no master key' }).call).toMatchObject({ outcome: 'failed', reason: 'no master key' });
    expect(run('on', FAILED, null)).toMatchObject({ value: null, decidedBy: 'old' });
  });

  it('reads an answer outside the decision as a failure, and the old answer counts', () => {
    const got = run('on', answered('purple'));
    expect(got).toMatchObject({ value: 'red', decidedBy: 'old' });
    expect(got.call).toMatchObject({ outcome: 'failed', jevAnswer: 'purple', counted: 'red', reason: 'Jev answered outside the decision’s options.' });
  });
});

describe('openKey', () => {
  const MASTER = randomBytes(32);
  const sealed = sealSecret('ts_live_0123456789abcdef', MASTER);

  it('opens a stored key with the master key', () => {
    expect(openKey(sealed, MASTER)).toEqual({ kind: 'key', key: 'ts_live_0123456789abcdef' });
  });

  it('says there is no key, and fails without the master key or with another one', () => {
    expect(openKey(null, MASTER)).toEqual({ kind: 'none' });
    expect(openKey(null, null)).toEqual({ kind: 'none' });
    expect(openKey(sealed, null)).toMatchObject({ kind: 'failed' });
    expect(openKey(sealed, randomBytes(32))).toMatchObject({ kind: 'failed' });
  });
});

describe('decide', () => {
  function deps({ mode = 'on', key = { kind: 'key', key: 'k' }, outcome = answered('blue'), settingsFail = false, logFail = false }: { mode?: JevMode; key?: JevKey; outcome?: JevOutcome | Error; settingsFail?: boolean; logFail?: boolean } = {}) {
    const asked: Array<{ key: string; state: unknown; question: JevQuestion }> = [];
    const logged: Array<[string, JevCall]> = [];
    const d: JevDecideDeps = {
      settings(workspace, decision) {
        if (settingsFail) return Promise.reject(new Error('db down'));
        return Promise.resolve({ ...settings(mode), decision });
      },
      key() { return Promise.resolve(key); },
      ask(k, state, question) {
        asked.push({ key: k, state, question });
        if (outcome instanceof Error) return Promise.reject(outcome);
        return Promise.resolve(outcome);
      },
      log(workspace, call) {
        if (logFail) return Promise.reject(new Error('insert refused'));
        logged.push([workspace, call]);
        return Promise.resolve();
      },
    };
    return { d, asked, logged };
  }
  const quiet = () => vi.spyOn(console, 'error').mockImplementation(() => {});

  it('Off: runs today\'s path only, never reads the key, never asks Jev, logs nothing', async () => {
    const { d, asked, logged } = deps({ mode: 'off' });
    const key = vi.spyOn(d, 'key');
    const old = vi.fn(() => Promise.resolve('red' as Colour));
    expect(await decide(d, { workspace: W, entry: colour, input: 'blue', old, ref: 'round:r1' })).toMatchObject({ value: 'red', decidedBy: 'old' });
    expect(old).toHaveBeenCalledOnce();
    expect(key).not.toHaveBeenCalled();
    expect(asked).toEqual([]);
    expect(logged).toEqual([]);
  });

  it('Off: today\'s failure is today\'s failure', async () => {
    const { d } = deps({ mode: 'off' });
    await expect(decide(d, { workspace: W, entry: colour, input: 'x', old: () => Promise.reject(new Error('boom')), ref: null })).rejects.toThrow('boom');
  });

  it('reads as Off when the settings cannot be read', async () => {
    const spy = quiet();
    const { d, asked } = deps({ settingsFail: true });
    expect(await decide(d, { workspace: W, entry: colour, input: 'x', old: () => Promise.resolve('red'), ref: null })).toMatchObject({ value: 'red', decidedBy: 'old' });
    expect(asked).toEqual([]);
    spy.mockRestore();
  });

  it('Shadow: asks Jev the entry\'s question about the entry\'s state, logs, and today\'s answer counts', async () => {
    const { d, asked, logged } = deps({ mode: 'shadow' });
    const got = await decide(d, { workspace: W, entry: colour, input: 'blue', old: () => Promise.resolve('red'), ref: 'round:r1' });
    expect(got).toMatchObject({ value: 'red', decidedBy: 'old' });
    expect(asked).toEqual([{ key: 'k', state: 'The sky is blue.', question: QUESTION }]);
    expect(logged).toEqual([[W, row({ mode: 'shadow', counted: 'red', decidedBy: 'old' })]]);
  });

  it('On: Jev\'s answer counts; a throwing today\'s path reads as no old answer', async () => {
    const spy = quiet();
    const { d, logged } = deps();
    const got = await decide(d, { workspace: W, entry: colour, input: 'x', old: () => Promise.reject(new Error('haiku down')), ref: 'round:r1' });
    expect(got).toMatchObject({ value: 'blue', decidedBy: 'jev' });
    expect(sure(logged[0], 'logged[0]')[1]).toMatchObject({ oldAnswer: null, counted: 'blue' });
    spy.mockRestore();
  });

  it('On: a throwing ask, a missing key or a failing log never blocks today\'s answer', async () => {
    const spy = quiet();
    expect(await decide(deps({ outcome: new Error('socket') }).d, { workspace: W, entry: colour, input: 'x', old: () => Promise.resolve('red'), ref: null }))
      .toMatchObject({ value: 'red', decidedBy: 'old', call: { outcome: 'failed' } });
    const noKey = deps({ key: { kind: 'none' } });
    expect(await decide(noKey.d, { workspace: W, entry: colour, input: 'x', old: () => Promise.resolve('red'), ref: null })).toMatchObject({ value: 'red', call: { outcome: 'no-key' } });
    expect(noKey.asked).toEqual([]);
    expect(await decide(deps({ logFail: true }).d, { workspace: W, entry: colour, input: 'x', old: () => Promise.resolve('red'), ref: null })).toMatchObject({ value: 'blue' });
    spy.mockRestore();
  });
});

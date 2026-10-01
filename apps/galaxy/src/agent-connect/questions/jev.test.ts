import { describe, expect, it } from 'vitest';
import type { JevOutcome } from '../../jev/client';
import type { JevDecideDeps } from '../../jev/resolve';
import type { JevCall, JevMode } from '../../jev/store';
import { judgeQuestion, questionJudge } from './jev';

// Jev's Unknown worth asking after a report (PRD 855 s4): Off never calls Jev; Shadow logs Jev's answer
// and leaves the question open; On sets it aside on a "no" at or above the confidence floor, and keeps it
// open under the floor or on a "yes". What Jev reads comes from agent_question_for_jev(), and the verdict
// goes to agent_question_set_aside(), as the service role.

const CONTEXT = {
  id: 'q-1', workspace: 'w-1', question: 'Is the sky blue?', state: 'open', repo: 'acme/app', file: 'src/Sky.tsx',
  claims: ['region#1: Belgium'],
};

type Rpc = { fn: string; args: Record<string, unknown> };

function world({ mode = 'off' as JevMode, noul = 0.05, confidence = 0.9, context = CONTEXT as unknown } = {}) {
  const rpcs: Rpc[] = [];
  const asked: unknown[] = [];
  const logged: JevCall[] = [];
  const db = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      rpcs.push({ fn, args });
      if (fn === 'agent_question_for_jev') return { data: context, error: null };
      return { data: { id: args.p_question, state: 'set-aside' }, error: null };
    },
  };
  const jev: JevDecideDeps = {
    settings: async (_w, decision) => ({ decision, mode, threshold: 0.5, floor: 0.4 }),
    key: async () => ({ kind: 'key', key: 'ts_key' }),
    ask: async (_key, state): Promise<JevOutcome> => {
      asked.push(state);
      return { kind: 'answered', model: 'jev-1', answer: noul, confidence, probabilities: null, ms: 12 };
    },
    log: async (_w, call) => {
      logged.push(call);
    },
  };
  const setAside = () => rpcs.filter((r) => r.fn === 'agent_question_set_aside');
  return { deps: questionJudge(db, jev), rpcs, asked, logged, setAside };
}

describe('Unknown worth asking after a report', () => {
  it('Off: Jev is never called, nothing is logged, the question stays open', async () => {
    const w = world({ mode: 'off' });
    expect(await judgeQuestion(w.deps, 'q-1')).toBe('kept');
    expect(w.asked).toEqual([]);
    expect(w.logged).toEqual([]);
    expect(w.setAside()).toEqual([]);
  });

  it('Shadow: Jev\'s "no" is logged beside today\'s "worth asking", and the question stays open', async () => {
    const w = world({ mode: 'shadow' });
    expect(await judgeQuestion(w.deps, 'q-1')).toBe('kept');
    expect(String(w.asked[0])).toContain('Is the sky blue?');
    expect(String(w.asked[0])).toContain('region#1: Belgium');
    expect(w.logged).toMatchObject([{ decision: 'unknown-worth-asking', mode: 'shadow', jevAnswer: 'false', oldAnswer: 'true', decidedBy: 'old', ref: 'agent question q-1' }]);
    expect(w.setAside()).toEqual([]);
  });

  it('On, a "no" at or above the floor: the question is set aside', async () => {
    const w = world({ mode: 'on', noul: 0.05, confidence: 0.9 });
    expect(await judgeQuestion(w.deps, 'q-1')).toBe('set-aside');
    expect(w.setAside()).toEqual([{ fn: 'agent_question_set_aside', args: { p_question: 'q-1' } }]);
    expect(w.logged[0]).toMatchObject({ decidedBy: 'jev', counted: 'false' });
  });

  it('On, a "no" under the floor, or a "yes": the question stays open', async () => {
    const under = world({ mode: 'on', noul: 0.45, confidence: 0.1 });
    expect(await judgeQuestion(under.deps, 'q-1')).toBe('kept');
    expect(under.setAside()).toEqual([]);
    expect(under.logged[0]).toMatchObject({ outcome: 'under-floor' });
    const yes = world({ mode: 'on', noul: 0.95, confidence: 0.9 });
    expect(await judgeQuestion(yes.deps, 'q-1')).toBe('kept');
    expect(yes.setAside()).toEqual([]);
  });

  it('a question gone, no longer open, or unreadable is left alone, and nothing throws', async () => {
    for (const context of [null, { ...CONTEXT, state: 'answered' }, { nope: true }]) {
      const w = world({ mode: 'on', context });
      expect(await judgeQuestion(w.deps, 'q-1')).toBe('kept');
      expect(w.asked).toEqual([]);
    }
    const broken = questionJudge({ rpc: async () => ({ data: null, error: { message: 'down' } }) }, world().deps.jev);
    expect(await judgeQuestion(broken, 'q-1')).toBe('kept');
  });
});

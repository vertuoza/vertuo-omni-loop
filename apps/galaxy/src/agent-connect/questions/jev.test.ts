import { describe, expect, it } from 'vitest';
import type { JevOutcome } from '../../jev/client';
import type { JevDecideDeps, JevKey } from '../../jev/resolve';
import type { JevCall, JevMode } from '../../jev/store';
import { judgeQuestion, questionJudge } from './jev';

// Jev's Unknown worth asking after a report (PRD 855 s4): the Jev step runs only when the link's workspace
// has its Jev key set up (Settings › Jev) and the decision is not Off; otherwise nothing of the question is
// read, Jev is not called, and the question stays open. Shadow logs Jev's answer and leaves the question
// open; On sets it aside on a "no" at or above the confidence floor, and keeps it open under the floor or
// on a "yes". The link names its workspace through agent_link_workspace() (as nobody); what Jev reads comes
// from agent_question_for_jev(), and the verdict goes to agent_question_set_aside(), as the service role.

const CONTEXT = {
  id: 'q-1', workspace: 'w-1', question: 'Is the sky blue?', state: 'open', repo: 'acme/app', file: 'src/Sky.tsx',
  claims: ['region#1: Belgium'],
};

type Rpc = { fn: string; args: Record<string, unknown> };
const REPORT = { question: 'q-1', link: 'a'.repeat(64) };
const KEY: JevKey = { kind: 'key', key: 'ts_key' };

function world({ mode = 'off' as JevMode, noul = 0.05, confidence = 0.9, context = CONTEXT as unknown, key = KEY, workspace = 'w-1' as unknown } = {}) {
  const rpcs: Rpc[] = [];
  const linked = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      rpcs.push({ fn, args });
      return { data: workspace, error: null };
    },
  };
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
    key: async () => key,
    ask: async (_key, state): Promise<JevOutcome> => {
      asked.push(state);
      return { kind: 'answered', model: 'jev-1', answer: noul, confidence, probabilities: null, ms: 12 };
    },
    log: async (_w, call) => {
      logged.push(call);
    },
  };
  const setAside = () => rpcs.filter((r) => r.fn === 'agent_question_set_aside');
  const read = () => rpcs.filter((r) => r.fn !== 'agent_link_workspace');
  return { deps: questionJudge(db, linked, jev), rpcs, asked, logged, setAside, read };
}

describe('Unknown worth asking after a report', () => {
  it('no Jev key set up: the Jev step is not run, nothing of the question is read, it stays open', async () => {
    for (const mode of ['shadow', 'on'] as const) {
      const w = world({ mode, key: { kind: 'none' } });
      expect(await judgeQuestion(w.deps, REPORT)).toBe('not-run');
      expect(w.rpcs).toEqual([{ fn: 'agent_link_workspace', args: { p_hash: REPORT.link } }]);
      expect(w.asked).toEqual([]);
      expect(w.logged).toEqual([]);
    }
  });

  it('Off: the Jev step is not run, even with a key: nothing read, nothing logged, the question stays open', async () => {
    const w = world({ mode: 'off' });
    expect(await judgeQuestion(w.deps, REPORT)).toBe('not-run');
    expect(w.read()).toEqual([]);
    expect(w.asked).toEqual([]);
    expect(w.logged).toEqual([]);
  });

  it('a link that names no workspace: the Jev step is not run', async () => {
    const w = world({ mode: 'on', workspace: null });
    expect(await judgeQuestion(w.deps, REPORT)).toBe('not-run');
    expect(w.read()).toEqual([]);
    expect(w.asked).toEqual([]);
  });

  it('Shadow: Jev\'s "no" is logged beside today\'s "worth asking", and the question stays open', async () => {
    const w = world({ mode: 'shadow' });
    expect(await judgeQuestion(w.deps, REPORT)).toBe('kept');
    expect(String(w.asked[0])).toContain('Is the sky blue?');
    expect(String(w.asked[0])).toContain('region#1: Belgium');
    expect(w.logged).toMatchObject([{ decision: 'unknown-worth-asking', mode: 'shadow', jevAnswer: 'false', oldAnswer: 'true', decidedBy: 'old', ref: 'agent question q-1' }]);
    expect(w.setAside()).toEqual([]);
  });

  it('On, a "no" at or above the floor: the question is set aside', async () => {
    const w = world({ mode: 'on', noul: 0.05, confidence: 0.9 });
    expect(await judgeQuestion(w.deps, REPORT)).toBe('set-aside');
    expect(w.setAside()).toEqual([{ fn: 'agent_question_set_aside', args: { p_question: 'q-1' } }]);
    expect(w.logged[0]).toMatchObject({ decidedBy: 'jev', counted: 'false' });
  });

  it('On, a "no" under the floor, or a "yes": the question stays open', async () => {
    const under = world({ mode: 'on', noul: 0.45, confidence: 0.1 });
    expect(await judgeQuestion(under.deps, REPORT)).toBe('kept');
    expect(under.setAside()).toEqual([]);
    expect(under.logged[0]).toMatchObject({ outcome: 'under-floor' });
    const yes = world({ mode: 'on', noul: 0.95, confidence: 0.9 });
    expect(await judgeQuestion(yes.deps, REPORT)).toBe('kept');
    expect(yes.setAside()).toEqual([]);
  });

  it('a question gone, no longer open, or unreadable is left alone, and nothing throws', async () => {
    for (const context of [null, { ...CONTEXT, state: 'answered' }, { ...CONTEXT, workspace: 'w-2' }, { nope: true }]) {
      const w = world({ mode: 'on', context });
      expect(await judgeQuestion(w.deps, REPORT)).toBe('kept');
      expect(w.asked).toEqual([]);
    }
    const down = { rpc: async () => ({ data: null, error: { message: 'down' } }) };
    const on = world({ mode: 'on' });
    const broken = questionJudge(down, { rpc: async () => ({ data: 'w-1', error: null }) }, on.deps.jev);
    expect(await judgeQuestion(broken, REPORT)).toBe('kept');
  });
});

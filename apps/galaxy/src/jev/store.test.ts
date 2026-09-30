// Jev's store (PRD 812 s1): its Supabase calls on a recording client. No test reaches Supabase.
import { describe, expect, it } from 'vitest';
import { DEFAULT_FLOOR, DEFAULT_THRESHOLD, JevStoreError, decisionOf, jevServiceStore, jevStore, type JevCall } from './store';

const W = 'w-acme';

type Call = unknown[];
type Answer = { data: unknown; error: { message: string; code?: string } | null };

function recording(answers: Record<string, Answer> = {}) {
  const calls: Call[] = [];
  const answer = (key: string) => Promise.resolve(answers[key] ?? { data: null, error: null });
  const from = (table: string) => ({
    select: (columns: string) => {
      const filters: Call = [];
      const chain = {
        eq: (column: string, value: unknown) => { filters.push(['eq', column, value]); return chain; },
        gte: (column: string, value: unknown) => { filters.push(['gte', column, value]); return chain; },
        order: (column: string, options: unknown) => { filters.push(['order', column, options]); return chain; },
        limit: (n: number) => { filters.push(['limit', n]); return chain; },
        maybeSingle: () => { filters.push(['maybeSingle']); return chain; },
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
          calls.push(['select', table, columns, ...filters]);
          return answer(`select ${table}`).then(resolve, reject);
        },
      };
      return chain;
    },
    insert: (values: unknown) => { calls.push(['insert', table, values]); return answer(`insert ${table}`); },
  });
  const rpc = (fn: string, args: unknown) => { calls.push(['rpc', fn, args]); return answer(`rpc ${fn}`); };
  return { calls, db: { from, rpc } as never };
}

const ok = (data: unknown): Answer => ({ data, error: null });
const refused = (code: string, message = 'no'): Answer => ({ data: null, error: { code, message } });

describe('the store, as the signed-in person', () => {
  it('asks whether the person owns the workspace', async () => {
    const { calls, db } = recording({ 'rpc is_owner': ok(true) });
    expect(await jevStore(db).isOwner(W)).toBe(true);
    expect(calls).toEqual([['rpc', 'is_owner', { workspace: W }]]);
    expect(await jevStore(recording({ 'rpc is_owner': ok(false) }).db).isOwner(W)).toBe(false);
  });

  it('reads the key\'s status: stored, and the last four for the owner', async () => {
    const { calls, db } = recording({ 'rpc jev_key_status': ok([{ stored: true, last_four: '1a2b', set_at: '2026-09-30T10:00:00Z' }]) });
    expect(await jevStore(db).keyStatus(W)).toEqual({ stored: true, lastFour: '1a2b', setAt: '2026-09-30T10:00:00Z' });
    expect(calls).toEqual([['rpc', 'jev_key_status', { p_workspace: W }]]);
    const member = recording({ 'rpc jev_key_status': ok([{ stored: true, last_four: null, set_at: null }]) });
    expect(await jevStore(member.db).keyStatus(W)).toEqual({ stored: true, lastFour: null, setAt: null });
    const none = recording({ 'rpc jev_key_status': ok([]) });
    expect(await jevStore(none.db).keyStatus(W)).toEqual({ stored: false, lastFour: null, setAt: null });
  });

  it('stores a sealed key through set_jev_key, and answers its status', async () => {
    const { calls, db } = recording({ 'rpc set_jev_key': ok([{ last_four: '1a2b', set_at: '2026-09-30T10:00:00Z' }]) });
    const status = await jevStore(db).setKey(W, { ciphertext: 'c', iv: 'i', lastFour: '1a2b' });
    expect(status).toEqual({ stored: true, lastFour: '1a2b', setAt: '2026-09-30T10:00:00Z' });
    expect(calls).toEqual([['rpc', 'set_jev_key', { p_workspace: W, p_ciphertext: 'c', p_iv: 'i', p_last_four: '1a2b' }]]);
  });

  it('removes the key through remove_jev_key', async () => {
    const { calls, db } = recording();
    await jevStore(db).removeKey(W);
    expect(calls).toEqual([['rpc', 'remove_jev_key', { p_workspace: W }]]);
  });

  it('reads the decisions, and sets one through set_jev_decision', async () => {
    const { calls, db } = recording({
      'select jev_decisions': ok([{ decision: 'outbox-risk', mode: 'shadow', threshold: '0.65', confidence_floor: 0.3 }]),
      'rpc set_jev_decision': ok({ decision: 'outbox-risk', mode: 'on', threshold: 0.7, confidence_floor: 0.4 }),
    });
    expect(await jevStore(db).decisions(W)).toEqual([{ decision: 'outbox-risk', mode: 'shadow', threshold: 0.65, floor: 0.3 }]);
    expect(await jevStore(db).setDecision(W, { decision: 'outbox-risk', mode: 'on', threshold: 0.7, floor: 0.4 }))
      .toEqual({ decision: 'outbox-risk', mode: 'on', threshold: 0.7, floor: 0.4 });
    expect(calls).toEqual([
      ['select', 'jev_decisions', 'decision, mode, threshold, confidence_floor', ['eq', 'workspace_id', W]],
      ['rpc', 'set_jev_decision', { p_workspace: W, p_decision: 'outbox-risk', p_mode: 'on', p_threshold: 0.7, p_floor: 0.4 }],
    ]);
  });

  it('reads the calls since a date, newest first', async () => {
    const row = {
      id: 7, decision: 'question-category', mode: 'shadow', outcome: 'answered', model: 'jev-1.13.0', jev_answer: 'product', confidence: '0.8200',
      old_answer: 'business', counted: 'business', decided_by: 'old', ref: 'round:9', reason: null, ms: 180, called_at: '2026-09-30T10:00:00Z',
    };
    const { calls, db } = recording({ 'select jev_calls': ok([row]) });
    const got = await jevStore(db).calls(W, '2026-09-01T00:00:00Z');
    expect(got).toEqual([{
      id: 7, decision: 'question-category', mode: 'shadow', outcome: 'answered', model: 'jev-1.13.0', jevAnswer: 'product', confidence: 0.82,
      oldAnswer: 'business', counted: 'business', decidedBy: 'old', ref: 'round:9', reason: null, ms: 180, calledAt: '2026-09-30T10:00:00Z',
    }]);
    expect(calls[0]).toEqual(['select', 'jev_calls', expect.any(String), ['eq', 'workspace_id', W], ['gte', 'called_at', '2026-09-01T00:00:00Z'], ['order', 'called_at', { ascending: false }]]);
  });

  it('throws a JevStoreError with the database\'s code on a refusal', async () => {
    const { db } = recording({ 'rpc set_jev_key': refused('42501', 'Only the owner') });
    const error = await jevStore(db).setKey(W, { ciphertext: 'c', iv: 'i', lastFour: '1a2b' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(JevStoreError);
    expect((error as JevStoreError).code).toBe('42501');
    await expect(jevStore(recording({ 'rpc remove_jev_key': refused('42501') }).db).removeKey(W)).rejects.toBeInstanceOf(JevStoreError);
    await expect(jevStore(recording({ 'select jev_decisions': refused('XX000') }).db).decisions(W)).rejects.toBeInstanceOf(JevStoreError);
  });
});

describe('the store, as the service role', () => {
  it('reads the sealed key, or null when there is none', async () => {
    const { calls, db } = recording({ 'select workspace_secrets': ok({ ciphertext: 'c', iv: 'i' }) });
    expect(await jevServiceStore(db).sealedKey(W)).toEqual({ ciphertext: 'c', iv: 'i' });
    expect(calls).toEqual([['select', 'workspace_secrets', 'ciphertext, iv', ['eq', 'workspace_id', W], ['eq', 'name', 'jev'], ['maybeSingle']]]);
    expect(await jevServiceStore(recording().db).sealedKey(W)).toBeNull();
  });

  it('reads one decision, Off at the defaults when it has no row', async () => {
    const { calls, db } = recording({ 'select jev_decisions': ok({ decision: 'bug-risk', mode: 'on', threshold: 0.6, confidence_floor: 0.5 }) });
    expect(await jevServiceStore(db).decision(W, 'bug-risk')).toEqual({ decision: 'bug-risk', mode: 'on', threshold: 0.6, floor: 0.5 });
    expect(calls).toEqual([['select', 'jev_decisions', 'decision, mode, threshold, confidence_floor', ['eq', 'workspace_id', W], ['eq', 'decision', 'bug-risk'], ['maybeSingle']]]);
    expect(await jevServiceStore(recording().db).decision(W, 'bug-risk')).toEqual({ decision: 'bug-risk', mode: 'off', threshold: DEFAULT_THRESHOLD, floor: DEFAULT_FLOOR });
  });

  it('appends a call', async () => {
    const { calls, db } = recording();
    const call: JevCall = {
      decision: 'question-category', mode: 'shadow', outcome: 'answered', model: 'jev-1.13.0', jevAnswer: 'product', confidence: 0.82,
      oldAnswer: 'business', counted: 'business', decidedBy: 'old', ref: 'round:9', reason: null, ms: 180,
    };
    await jevServiceStore(db).logCall(W, call);
    expect(calls).toEqual([['insert', 'jev_calls', {
      workspace_id: W, decision: 'question-category', mode: 'shadow', outcome: 'answered', model: 'jev-1.13.0', jev_answer: 'product', confidence: 0.82,
      old_answer: 'business', counted: 'business', decided_by: 'old', ref: 'round:9', reason: null, ms: 180,
    }]]);
  });
});

describe('decisionOf', () => {
  it('is the stored row, or Off at the defaults', () => {
    const rows = [{ decision: 'outbox-risk', mode: 'on' as const, threshold: 0.65, floor: 0.3 }];
    expect(decisionOf(rows, 'outbox-risk')).toEqual(rows[0]);
    expect(decisionOf(rows, 'bug-risk')).toEqual({ decision: 'bug-risk', mode: 'off', threshold: 0.5, floor: 0.4 });
  });
});

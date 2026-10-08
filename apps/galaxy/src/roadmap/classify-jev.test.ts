import { afterEach, describe, expect, it, vi } from 'vitest';
import type { JevOutcome } from '../jev/client';
import type { JevDecideDeps } from '../jev/resolve';
import type { JevCall, JevDecisionSettings } from '../jev/store';
// The resolver reaches the secret box, which is the server's only.
vi.mock('server-only', () => ({}));

import { CLASSIFY_BATCH, CLASSIFY_BUDGET_MS, classifyHumanWork, humanWorkClassifier } from './classify-jev';

// The human work's kind through Jev (PRD 1217 s3): each new key of a pushed roadmap is offered once to
// the `hitl-category` decision of the roadmap's workspace. On counts Jev's answer among the four; Shadow
// logs it and the rule kind stays; Off asks nothing; an error or an answer outside the four keeps the
// rule kind. The database is a stub of the two service-role functions.

const ROADMAP = '00000000-0000-4000-8000-00000000a0a0';
const ACME = '00000000-0000-4000-8000-000000000ace';

type Row = { key: string; kind: string; kind_by: 'rule' | 'jev'; state: 'open' | 'done'; offered: boolean; text: string; act: string | null; url: string | null };

function rowOf(key: string, kind = 'development', more: Partial<Row> = {}): Row {
  return { key, kind, kind_by: 'rule', state: 'open', offered: false, text: `work ${key}`, act: null, url: null, ...more };
}

/** The two functions as the migration writes them, over rows in memory. */
function fakeDb(rows: Row[], { workspace = ACME, fail = null }: { workspace?: string | null; fail?: string | null } = {}) {
  const calls: Array<[string, Record<string, unknown>]> = [];
  const db = {
    rpc(fn: string, args: Record<string, unknown>) {
      calls.push([fn, args]);
      if (fail === fn) return Promise.resolve({ data: null, error: { message: 'the database is down' } });
      if (fn === 'roadmap_human_work_claim') {
        if (!workspace) return Promise.resolve({ data: { workspace: null, entries: [] }, error: null });
        const picked = rows.filter((r) => r.state === 'open' && !r.offered).slice(0, Number(args.p_limit));
        for (const r of picked) r.offered = true;
        return Promise.resolve({ data: { workspace, entries: picked.map((r) => ({
          key: r.key, prd: 1213, prdTitle: 'Stateless think endpoint', repo: 'ai-domain', source: r.key.split(':')[0], text: r.text, act: r.act, url: r.url, ruleKind: r.kind,
        })) }, error: null });
      }
      if (fn === 'roadmap_human_work_set_kind') {
        const row = rows.find((r) => r.key === args.p_key && r.kind_by === 'rule' && r.offered);
        if (row) Object.assign(row, { kind: args.p_kind, kind_by: 'jev' });
        return Promise.resolve({ data: Boolean(row), error: null });
      }
      throw new Error(`no ${fn}`);
    },
  };
  return { db, calls };
}

/** Jev, as the resolver reaches it: the decision's mode, a key, its answers in turn, and the log. */
function fakeJev(mode: JevDecisionSettings['mode'], answers: Array<JevOutcome | Error> = []) {
  const asked: unknown[] = [];
  const logged: JevCall[] = [];
  const jev: JevDecideDeps = {
    settings: (_workspace, decision) => Promise.resolve({ decision, mode, threshold: 0.5, floor: 0.4 }),
    key: () => Promise.resolve({ kind: 'key', key: 'ts-key' }),
    ask: (_key, state) => {
      asked.push(state);
      const next = answers.shift() ?? { kind: 'answered', answer: 'business', confidence: 0.9, model: 'jev-1.13.0', probabilities: null, ms: 20 };
      return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
    },
    log: (_workspace, call) => { logged.push(call); return Promise.resolve(); },
  };
  return { jev, asked, logged };
}

const said = (answer: string, confidence = 0.9): JevOutcome => ({ kind: 'answered', answer, confidence, model: 'jev-1.13.0', probabilities: null, ms: 20 });
const kinds = (rows: Row[]) => rows.map((r) => [r.key, r.kind, r.kind_by]);

afterEach(() => { vi.restoreAllMocks(); });

describe('classifyHumanWork', () => {
  it('On: Jev\'s answer among the four is the kind, chosen by Jev', async () => {
    const rows = [rowOf('outbox:1213/s2-01', 'development', { text: 'No token for the queue', act: 'Add CREW_TOKEN.', url: 'https://github.com/acme/ai-domain/pull/10' })];
    const { db } = fakeDb(rows);
    const { jev, asked, logged } = fakeJev('on', [said('dev-ops')]);
    expect(await classifyHumanWork(humanWorkClassifier(db, jev), ROADMAP)).toEqual({ offered: 1, byJev: 1 });
    expect(kinds(rows)).toEqual([['outbox:1213/s2-01', 'dev-ops', 'jev']]);
    expect(asked[0]).toContain('Work: No token for the queue');
    expect(asked[0]).toContain('PRD: Stateless think endpoint');
    expect(logged[0]).toMatchObject({ decision: 'hitl-category', oldAnswer: 'development', counted: 'dev-ops', decidedBy: 'jev', ref: 'https://github.com/acme/ai-domain/pull/10' });
  });

  it('Shadow: Jev is asked and logged, and the rule kind stays', async () => {
    const rows = [rowOf('park:1213')];
    const { db, calls } = fakeDb(rows);
    const { jev, logged } = fakeJev('shadow', [said('delivery-ops')]);
    expect(await classifyHumanWork(humanWorkClassifier(db, jev), ROADMAP)).toEqual({ offered: 1, byJev: 0 });
    expect(kinds(rows)).toEqual([['park:1213', 'development', 'rule']]);
    expect(logged[0]).toMatchObject({ jevAnswer: 'delivery-ops', counted: 'development', decidedBy: 'old', ref: 'park:1213' });
    expect(calls.map(([fn]) => fn)).not.toContain('roadmap_human_work_set_kind');
  });

  it('Off: Jev is never asked, every new key is offered once and keeps its rule kind', async () => {
    const rows = Array.from({ length: CLASSIFY_BATCH + 3 }, (_, i) => rowOf(`question:Q${i}`, 'business'));
    const { db } = fakeDb(rows);
    const { jev, asked, logged } = fakeJev('off');
    expect(await classifyHumanWork(humanWorkClassifier(db, jev), ROADMAP)).toEqual({ offered: CLASSIFY_BATCH + 3, byJev: 0 });
    expect(asked).toEqual([]);
    expect(logged).toEqual([]);
    expect(rows.every((r) => r.offered && r.kind_by === 'rule')).toBe(true);
  });

  it('an answer outside the four, a Jev error, an answer under the floor: the rule kind stays', async () => {
    const rows = [rowOf('park:1'), rowOf('park:2'), rowOf('park:3')];
    const { db } = fakeDb(rows);
    const { jev } = fakeJev('on', [said('legal'), new Error('socket hang up'), said('business', 0.1)]);
    expect(await classifyHumanWork(humanWorkClassifier(db, jev), ROADMAP)).toEqual({ offered: 3, byJev: 0 });
    expect(kinds(rows).map(([, , by]) => by)).toEqual(['rule', 'rule', 'rule']);
  });

  it('a key already offered is never offered again, whatever the mode is now', async () => {
    const rows = [rowOf('park:1', 'development', { offered: true }), rowOf('park:2')];
    const { db } = fakeDb(rows);
    const { jev, asked } = fakeJev('on', [said('business'), said('business')]);
    await classifyHumanWork(humanWorkClassifier(db, jev), ROADMAP);
    await classifyHumanWork(humanWorkClassifier(db, jev), ROADMAP);
    expect(asked).toHaveLength(1);
    expect(kinds(rows)).toEqual([['park:1', 'development', 'rule'], ['park:2', 'business', 'jev']]);
  });

  it('asks in batches, and leaves the keys past its time budget for the next push', async () => {
    const rows = Array.from({ length: CLASSIFY_BATCH * 2 }, (_, i) => rowOf(`park:${i + 1}`));
    const { db } = fakeDb(rows);
    const { jev } = fakeJev('on');
    let clock = 0;
    const classifier = { ...humanWorkClassifier(db, jev), now: () => { clock += CLASSIFY_BUDGET_MS; return clock; } };
    expect(await classifyHumanWork(classifier, ROADMAP)).toEqual({ offered: CLASSIFY_BATCH, byJev: CLASSIFY_BATCH });
    expect(rows.filter((r) => !r.offered)).toHaveLength(CLASSIFY_BATCH);
  });

  it('nothing new, or a roadmap gone: nothing is asked', async () => {
    const { jev, asked } = fakeJev('on');
    expect(await classifyHumanWork(humanWorkClassifier(fakeDb([]).db, jev), ROADMAP)).toEqual({ offered: 0, byJev: 0 });
    expect(await classifyHumanWork(humanWorkClassifier(fakeDb([rowOf('park:1')], { workspace: null }).db, jev), ROADMAP)).toEqual({ offered: 0, byJev: 0 });
    expect(asked).toEqual([]);
  });

  it('never throws: a database that fails, or answers what it should not, is logged and nothing more', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { jev } = fakeJev('on');
    expect(await classifyHumanWork(humanWorkClassifier(fakeDb([rowOf('park:1')], { fail: 'roadmap_human_work_claim' }).db, jev), ROADMAP)).toEqual({ offered: 0, byJev: 0 });
    const odd = { rpc: () => Promise.resolve({ data: { workspace: ACME, entries: [{ key: 'park:1' }] }, error: null }) };
    expect(await classifyHumanWork(humanWorkClassifier(odd, jev), ROADMAP)).toEqual({ offered: 0, byJev: 0 });
    expect(error).toHaveBeenCalledTimes(2);
    expect(String(error.mock.calls[0]?.[0])).toContain('the database is down');
  });

  it('a kind Jev chose that cannot be stored keeps the rule kind, and the other keys go on', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const rows = [rowOf('park:1'), rowOf('park:2')];
    const { db } = fakeDb(rows, { fail: 'roadmap_human_work_set_kind' });
    const { jev } = fakeJev('on');
    expect(await classifyHumanWork(humanWorkClassifier(db, jev), ROADMAP)).toEqual({ offered: 2, byJev: 0 });
    expect(error).toHaveBeenCalled();
  });
});

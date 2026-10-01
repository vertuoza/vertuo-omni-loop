import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { JevOutcome } from '../client';
import type { JevDecideDeps } from '../resolve';
import type { JevCall, JevDecisionSettings, JevMode } from '../store';
import { JUDGE_SIGNATURE_HEADER, judgeRoute, placedWorkspace, type JudgeRouteDeps } from './judge-route';

// `POST /api/constituents/judge` (PRD 871 s4): the App's canon gate asks the workspace's
// `constituent-break` decision, signed with an HMAC over the body under CONSTITUENT_JUDGE_SECRET. A fake
// world of one workspace, Acme, tracking acme/widgets; Jev as the client reports it.

const ACME = '00000000-0000-4000-8000-00000000ac01';
const SECRET = 'judge-secret';

const STATE = {
  spec: "The gallery loads its rows with fetch('/api/v1/projects').",
  statement: 'The component workshop, shown with fixtures.',
  never: [{ id: 'never#1', text: 'calls real Vertuoza data or real Vertuoza APIs' }],
  verdict: { broken: true, findings: [{ quote: "fetch('/api/v1/projects')", constituents: ['never#1'], why: 'a real API' }] },
};
const CALL = { repo: 'acme/widgets', state: STATE, old: 'false', ref: 'acme/widgets#12' };

function world({ mode = 'off', noul = 0.9, jev = true, secret = SECRET, outcome, lookup }: {
  mode?: JevMode; noul?: number; jev?: boolean; secret?: string | undefined; outcome?: JevOutcome; lookup?: () => Promise<string | null>;
} = {}) {
  const asked: unknown[] = [];
  const logged: JevCall[] = [];
  const lines: string[] = [];
  const deps: JevDecideDeps = {
    settings: async (_w, decision): Promise<JevDecisionSettings> => ({ decision, mode, threshold: 0.5, floor: 0.4 }),
    key: async () => ({ kind: 'key', key: 'ts-key' }),
    ask: async (_key, state, question) => {
      asked.push({ state, question });
      return outcome ?? { kind: 'answered', model: 'jev-1.13.0', answer: noul, confidence: Math.abs(2 * noul - 1), probabilities: null, ms: 80 };
    },
    log: async (_w, call) => {
      logged.push(call);
    },
  };
  const route: JudgeRouteDeps = {
    secret,
    workspaceOf: lookup ?? (async (repo) => (repo === 'acme/widgets' ? ACME : null)),
    jev: jev ? deps : null,
    log: (line) => lines.push(line),
  };
  return { route, asked, logged, lines };
}

const sign = (body: string, secret = SECRET) => `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

async function send(w: ReturnType<typeof world>, body: unknown = CALL, { signature }: { signature?: string | null } = {}) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  const sig = signature === undefined ? sign(text) : signature;
  const request = new Request('https://galaxy.test/api/constituents/judge', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(sig ? { [JUDGE_SIGNATURE_HEADER]: sig } : {}) },
    body: text,
  });
  const response = await judgeRoute(request, w.route);
  return { status: response.status, body: await response.json() };
}

describe('POST /api/constituents/judge', () => {
  it('refuses a call without a signature, or signed with another secret, and asks nothing', async () => {
    const w = world({ mode: 'on' });
    expect(await send(w, CALL, { signature: null })).toMatchObject({ status: 401 });
    expect(await send(w, CALL, { signature: sign(JSON.stringify(CALL), 'other') })).toMatchObject({ status: 401 });
    expect(await send(w, CALL, { signature: 'sha256=00' })).toMatchObject({ status: 401 });
    expect(w.asked).toEqual([]);
    expect(w.logged).toEqual([]);
  });

  it('refuses every call where CONSTITUENT_JUDGE_SECRET is not set', async () => {
    const w = world({ mode: 'on', secret: '' });
    expect(await send(w)).toMatchObject({ status: 401 });
    expect(w.lines.join('\n')).toMatch(/CONSTITUENT_JUDGE_SECRET/);
    expect(w.asked).toEqual([]);
  });

  it('refuses a signed body that is not a judge call, saying which field', async () => {
    const w = world({ mode: 'on' });
    expect(await send(w, 'not json')).toMatchObject({ status: 400 });
    expect(await send(w, { ...CALL, repo: 'widgets' })).toMatchObject({ status: 400, body: { error: expect.stringMatching(/repo/) } });
    expect(await send(w, { ...CALL, state: { spec: 'x' } })).toMatchObject({ status: 400, body: { error: expect.stringMatching(/state/) } });
    expect(await send(w, { ...CALL, old: 'red' })).toMatchObject({ status: 400, body: { error: expect.stringMatching(/old/) } });
    expect(await send(w, { ...CALL, ref: 7 })).toMatchObject({ status: 400, body: { error: expect.stringMatching(/ref/) } });
    expect(await send(w, { ...CALL, state: { ...STATE, spec: 'x'.repeat(200_000) } })).toMatchObject({ status: 413 });
    expect(w.asked).toEqual([]);
  });

  it('Off: answers today’s verdict without calling Jev or logging', async () => {
    const w = world({ mode: 'off' });
    expect(await send(w)).toEqual({ status: 200, body: { answer: 'false', confidence: null, decidedBy: 'old' } });
    expect(w.asked).toEqual([]);
    expect(w.logged).toEqual([]);
  });

  it('Shadow: answers today’s verdict and logs Jev’s beside it', async () => {
    const w = world({ mode: 'shadow', noul: 0.9 });
    expect(await send(w)).toEqual({ status: 200, body: { answer: 'false', confidence: null, decidedBy: 'old' } });
    expect(w.asked).toHaveLength(1);
    expect(w.logged).toEqual([expect.objectContaining({
      decision: 'constituent-break', mode: 'shadow', jevAnswer: 'true', oldAnswer: 'false', counted: 'false', decidedBy: 'old', ref: 'acme/widgets#12',
    })]);
  });

  it('On: answers Jev’s verdict at or above the floor, today’s under it', async () => {
    const above = world({ mode: 'on', noul: 0.9 });
    const sent = await send(above);
    expect(sent.status).toBe(200);
    expect(sent.body).toEqual({ answer: 'true', confidence: expect.closeTo(0.8, 5), decidedBy: 'jev' });
    expect(String((above.asked[0] as { state: string }).state)).toContain('never#1');

    const under = world({ mode: 'on', noul: 0.6 });
    expect(await send(under)).toEqual({ status: 200, body: { answer: 'false', confidence: null, decidedBy: 'old' } });
    expect(under.logged).toEqual([expect.objectContaining({ outcome: 'under-floor', decidedBy: 'old' })]);
  });

  it('On: answers today’s verdict when Jev fails, and logs the failure', async () => {
    const w = world({ mode: 'on', outcome: { kind: 'failed', reason: 'timeout', status: null, message: 'Jev timed out.', ms: 5000 } });
    expect(await send(w)).toEqual({ status: 200, body: { answer: 'false', confidence: null, decidedBy: 'old' } });
    expect(w.logged).toEqual([expect.objectContaining({ outcome: 'failed', reason: 'Jev timed out.' })]);
  });

  it('answers today’s verdict when no workspace tracks the repository, or without the service role', async () => {
    const stray = world({ mode: 'on' });
    expect(await send(stray, { ...CALL, repo: 'other/thing' })).toEqual({ status: 200, body: { answer: 'false', confidence: null, decidedBy: 'old' } });
    expect(stray.asked).toEqual([]);
    const bare = world({ mode: 'on', jev: false });
    expect(await send(bare)).toEqual({ status: 200, body: { answer: 'false', confidence: null, decidedBy: 'old' } });
  });

  it('answers 500 when the workspace cannot be looked up', async () => {
    const w = world({ mode: 'on', lookup: async () => { throw new Error('db down'); } });
    expect(await send(w)).toMatchObject({ status: 500 });
    expect(w.lines.join('\n')).toMatch(/db down/);
  });
});

describe('placedWorkspace', () => {
  const row = (workspace_id: string, added_at: string, github_org: string | null, slug: string) => ({ workspace_id, added_at, workspaces: { github_org, slug } });

  it('picks the workspace as constituents_for_repo_app() does: the owner’s org first, then the earliest, then the slug', () => {
    expect(placedWorkspace('acme/widgets', [])).toBeNull();
    expect(placedWorkspace('acme/widgets', [row('b', '2026-01-01', 'other', 'b'), row('a', '2026-02-01', 'ACME', 'a')])).toBe('a');
    expect(placedWorkspace('acme/widgets', [row('b', '2026-02-01', null, 'b'), row('a', '2026-01-01', null, 'z')])).toBe('a');
    expect(placedWorkspace('acme/widgets', [row('b', '2026-01-01', null, 'b'), row('a', '2026-01-01', null, 'a')])).toBe('a');
  });
});

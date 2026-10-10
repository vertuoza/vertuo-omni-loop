import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { JevOutcome } from '../client';
import type { JevDecideDeps } from '../resolve';
import type { JevCall, JevDecisionSettings, JevMode } from '../store';
import { JUDGE_SIGNATURE_HEADER, type JudgeRouteDeps } from './judge-route';
import { LAW_JUDGE_SECRET_VAR, lawJudgeRoute } from './law-judge-route';

vi.mock('server-only', () => ({}));

// `POST /api/laws/judge` (PRD 1342 s3): the App's harvest asks the workspace's `law-worth` decision,
// signed with an HMAC over the body under LAW_JUDGE_SECRET, as the constituent judge is under its own.
// A fake world of one workspace, Acme, tracking acme/widgets; Jev as the client reports it.

const ACME = '00000000-0000-4000-8000-00000000ac01';
const SECRET = 'law-secret';

const STATE = {
  statement: 'A sub-PR is never merged into the default branch.',
  why: 'A person merges into main.',
  principle: 'principle#3: A person owns what reaches main.',
  domain: 'delivery',
  prdTitle: 'Laws are born with their test',
};
const CALL = { repo: 'Acme/Widgets', state: STATE, old: 'false', ref: 'acme/widgets#1342' };

const near = (n: number): unknown => expect.closeTo(n, 5);
const matching = (pattern: RegExp): unknown => expect.stringMatching(pattern);

function world({ mode = 'off', noul = 0.9, jev = true, secret = SECRET, outcome, lookup }: {
  mode?: JevMode; noul?: number; jev?: boolean; secret?: string | undefined; outcome?: JevOutcome; lookup?: () => Promise<string | null>;
} = {}) {
  const asked: { state: unknown }[] = [];
  const logged: JevCall[] = [];
  const lines: string[] = [];
  const deps: JevDecideDeps = {
    settings: (_w, decision): Promise<JevDecisionSettings> => Promise.resolve({ decision, mode, threshold: 0.5, floor: 0.4 }),
    key: () => Promise.resolve({ kind: 'key', key: 'ts-key' }),
    ask: (_key, state) => {
      asked.push({ state });
      return Promise.resolve(outcome ?? { kind: 'answered', model: 'jev-1.13.0', answer: noul, confidence: Math.abs(2 * noul - 1), probabilities: null, ms: 80 });
    },
    log: (_w, call) => {
      logged.push(call);
      return Promise.resolve();
    },
  };
  const route: JudgeRouteDeps = {
    secret,
    workspaceOf: lookup ?? ((repo) => Promise.resolve(repo === 'acme/widgets' ? ACME : null)),
    jev: jev ? deps : null,
    log: (line) => lines.push(line),
  };
  return { route, asked, logged, lines };
}

const sign = (body: string, secret = SECRET) => `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

async function send(w: ReturnType<typeof world>, body: unknown = CALL, { signature }: { signature?: string | null } = {}) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  const sig = signature === undefined ? sign(text) : signature;
  const request = new Request('https://galaxy.test/api/laws/judge', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(sig ? { [JUDGE_SIGNATURE_HEADER]: sig } : {}) },
    body: text,
  });
  const response = await lawJudgeRoute(request, w.route);
  return { status: response.status, body: (await response.json()) as unknown };
}

describe('POST /api/laws/judge', () => {
  it('refuses a call without a signature, or signed with another secret, and asks nothing', async () => {
    const w = world({ mode: 'on' });
    expect(await send(w, CALL, { signature: null })).toMatchObject({ status: 401 });
    expect(await send(w, CALL, { signature: sign(JSON.stringify(CALL), 'constituent-secret') })).toMatchObject({ status: 401 });
    expect(w.asked).toEqual([]);
    expect(w.logged).toEqual([]);
  });

  it('refuses every call where LAW_JUDGE_SECRET is not set, naming it in the log', async () => {
    expect(LAW_JUDGE_SECRET_VAR).toBe('LAW_JUDGE_SECRET');
    const w = world({ mode: 'on', secret: '' });
    expect(await send(w)).toMatchObject({ status: 401, body: { error: matching(/law judge/) } });
    expect(w.lines.join('\n')).toMatch(/law judge: LAW_JUDGE_SECRET is not set/);
    expect(w.asked).toEqual([]);
  });

  it('refuses a signed body that is not a law-worth call, saying which field, and one past its cap', async () => {
    const w = world({ mode: 'on' });
    expect(await send(w, 'not json')).toMatchObject({ status: 400 });
    expect(await send(w, { ...CALL, repo: 'widgets' })).toMatchObject({ status: 400, body: { error: matching(/repo/) } });
    expect(await send(w, { ...CALL, state: { why: 'no statement' } })).toMatchObject({ status: 400, body: { error: matching(/state.*law-worth/) } });
    expect(await send(w, { ...CALL, old: 'maybe' })).toMatchObject({ status: 400, body: { error: matching(/old/) } });
    expect(await send(w, { ...CALL, state: { ...STATE, why: 'x'.repeat(70_000) } })).toMatchObject({ status: 413 });
    expect(w.asked).toEqual([]);
  });

  it('Off: answers the classifier’s answer without calling Jev', async () => {
    const w = world({ mode: 'off' });
    expect(await send(w)).toEqual({ status: 200, body: { answer: 'false', confidence: null, decidedBy: 'old' } });
    expect(w.asked).toEqual([]);
    expect(w.logged).toEqual([]);
  });

  it('Shadow: answers the classifier’s and logs Jev’s beside it, for the workspace tracking the repository', async () => {
    const w = world({ mode: 'shadow', noul: 0.9 });
    expect(await send(w)).toEqual({ status: 200, body: { answer: 'false', confidence: null, decidedBy: 'old' } });
    expect(w.logged).toEqual([expect.objectContaining({ decision: 'law-worth', mode: 'shadow', jevAnswer: 'true', oldAnswer: 'false', ref: 'acme/widgets#1342' })]);
  });

  it('On: answers Jev’s at or above the floor, the classifier’s under it or when Jev fails', async () => {
    const above = world({ mode: 'on', noul: 0.9 });
    expect(await send(above)).toEqual({ status: 200, body: { answer: 'true', confidence: near(0.8), decidedBy: 'jev' } });
    expect(String(above.asked[0]?.state)).toContain('Statement: A sub-PR is never merged');

    const under = world({ mode: 'on', noul: 0.6 });
    expect(await send(under)).toEqual({ status: 200, body: { answer: 'false', confidence: null, decidedBy: 'old' } });

    const down = world({ mode: 'on', outcome: { kind: 'failed', reason: 'timeout', status: null, message: 'Jev timed out.', ms: 5000 } });
    expect(await send(down, { ...CALL, old: 'true' })).toEqual({ status: 200, body: { answer: 'true', confidence: null, decidedBy: 'old' } });
  });

  it('answers the classifier’s with no workspace tracking the repository or no service role; 500 when the lookup fails', async () => {
    expect(await send(world({ mode: 'on' }), { ...CALL, repo: 'other/thing' })).toMatchObject({ status: 200, body: { decidedBy: 'old' } });
    expect(await send(world({ mode: 'on', jev: false }))).toMatchObject({ status: 200, body: { decidedBy: 'old' } });
    const broken = world({ mode: 'on', lookup: () => Promise.reject(new Error('db down')) });
    expect(await send(broken)).toMatchObject({ status: 500 });
    expect(broken.lines.join('\n')).toMatch(/law judge: .*db down/);
  });
});

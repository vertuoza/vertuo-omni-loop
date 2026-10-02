import { describe, expect, it } from 'vitest';
import type { JevOutcome } from '../client';
import type { JevDecideDeps } from '../resolve';
import type { JevCall, JevDecisionSettings, JevMode } from '../store';
import { decideRoute, placedFrom, type DecideRouteDeps } from './decide-route';
import { sure } from '../../arcade/sure';

// `POST /api/decide/<decision>` (PRD 812 s3): a Claude session asks the workspace's Jev decision, with
// the terminal's sign-in. A fake world of one workspace, Acme (GitHub org acme), whose Ada is a member;
// repo_workspace() is played as the migration writes it, and Jev as the client reports it.

const ACME = '00000000-0000-4000-8000-00000000ac01';
const ADA = { id: '00000000-0000-4000-8000-0000000000a1', email: 'ada@acme.test' };
const INSTALL = 'https://github.com/apps/omni-loop-invader/installations/new';

const STATE = {
  decision: 'Keep the sessions in Postgres rather than Redis.',
  options: ['A: Postgres', 'B: Redis'],
  slice: 's3: sessions',
  paths: ['supabase/migrations/'],
};

function world({ mode = 'off', noul = 0.82, database = true, jev = true, outcome }: {
  mode?: JevMode; noul?: number; database?: boolean; jev?: boolean; outcome?: JevOutcome;
} = {}) {
  const asked: unknown[] = [];
  const logged: JevCall[] = [];
  const placed: Array<{ userId: string; repo: string }> = [];
  const connect = (_token: string) => ({
    auth: {
      getUser: (jwt: string) =>
        Promise.resolve(jwt === 'ada-token' ? { data: { user: ADA }, error: null } : { data: { user: null }, error: { status: 401, message: 'bad jwt' } }),
    },
  });
  const deps: JevDecideDeps = {
    settings: (_w, decision): Promise<JevDecisionSettings> => Promise.resolve({ decision, mode, threshold: 0.5, floor: 0.4 }),
    key: () => Promise.resolve({ kind: 'key', key: 'ts-key' }),
    ask: (_key, state, question) => {
      asked.push({ state, question });
      return Promise.resolve(outcome ?? { kind: 'answered', model: 'jev-1.13.0', answer: noul, confidence: Math.abs(2 * noul - 1), probabilities: null, ms: 90 });
    },
    log: (_w, call) => {
      logged.push(call);
      return Promise.resolve();
    },
  };
  const route: DecideRouteDeps = {
    connect: database ? connect : null,
    place: (userId, repo) => {
      placed.push({ userId, repo });
      if (repo.toLowerCase().startsWith('acme/')) return Promise.resolve({ workspace: ACME, reason: null });
      return Promise.resolve({ workspace: null, reason: `no workspace owns ${repo} yet — install the Omni App` });
    },
    jev: jev ? deps : null,
    installLink: INSTALL,
  };
  return { route, asked, logged, placed };
}

const request = (body: unknown, token: string | null = 'ada-token') =>
  new Request('https://galaxy.test/api/decide/outbox-risk', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

const CALL = { repo: 'acme/widgets', state: STATE, old: 'false', ref: 'item 812-s3-03' };

async function send(w: ReturnType<typeof world>, body: unknown = CALL, { decision = 'outbox-risk', token }: { decision?: string; token?: string | null } = {}) {
  const response = await decideRoute(request(body, token === undefined ? 'ada-token' : token), decision, w.route);
  return { status: response.status, body: await response.json() };
}

describe('POST /api/decide/<decision>', () => {
  it('refuses a call without a sign-in, or with one no longer valid', async () => {
    const w = world({ mode: 'on' });
    expect(await send(w, CALL, { token: null })).toMatchObject({ status: 401 });
    expect(await send(w, CALL, { token: 'stale' })).toMatchObject({ status: 401 });
    expect(w.asked).toEqual([]);
  });

  it('refuses with 503 where this deployment has no database', async () => {
    expect(await send(world({ database: false }))).toMatchObject({ status: 503 });
  });

  it('refuses a repository no workspace owns, with the database\'s reason and the install link', async () => {
    const w = world({ mode: 'on' });
    const run = await send(w, { ...CALL, repo: 'other/thing' });
    expect(run).toEqual({ status: 403, body: { error: `no workspace owns other/thing yet — install the Omni App: ${INSTALL}` } });
    expect(w.placed).toEqual([{ userId: ADA.id, repo: 'other/thing' }]);
    expect(w.asked).toEqual([]);
  });

  it('refuses an unknown decision, and one made in Galaxy only, with 404', async () => {
    const w = world({ mode: 'on' });
    expect(await send(w, CALL, { decision: 'nope' })).toMatchObject({ status: 404, body: { error: expect.stringContaining('nope') } });
    expect(await send(w, CALL, { decision: 'question-category' })).toMatchObject({ status: 404 });
    expect(await send(w, CALL, { decision: '__proto__' })).toMatchObject({ status: 404 });
    expect(w.asked).toEqual([]);
  });

  it('refuses a malformed body, state, old answer, repository or ref with 400', async () => {
    const w = world({ mode: 'on' });
    expect(await send(w, 'not json')).toMatchObject({ status: 400 });
    expect(await send(w, [1])).toMatchObject({ status: 400 });
    expect(await send(w, { ...CALL, state: { decision: '' } })).toMatchObject({ status: 400, body: { error: expect.stringMatching(/state/) } });
    expect(await send(w, { ...CALL, state: 'text' })).toMatchObject({ status: 400 });
    expect(await send(w, { ...CALL, old: 'maybe' })).toMatchObject({ status: 400, body: { error: expect.stringMatching(/old/) } });
    expect(await send(w, { ...CALL, old: undefined })).toMatchObject({ status: 400 });
    expect(await send(w, { ...CALL, repo: 'widgets' })).toMatchObject({ status: 400 });
    expect(await send(w, { ...CALL, ref: 7 })).toMatchObject({ status: 400 });
    expect(w.asked).toEqual([]);
  });

  it('refuses a body past its cap with 413', async () => {
    const w = world({ mode: 'on' });
    expect(await send(w, { ...CALL, pad: 'x'.repeat(70 * 1024) })).toMatchObject({ status: 413 });
  });

  it('answers Off with today\'s answer, without calling Jev or logging', async () => {
    const w = world({ mode: 'off' });
    expect(await send(w)).toEqual({ status: 200, body: { answer: null, confidence: null, decidedBy: 'old' } });
    expect(w.asked).toEqual([]);
    expect(w.logged).toEqual([]);
  });

  it('answers as Off where this deployment cannot reach Jev (no service role)', async () => {
    const w = world({ mode: 'on', jev: false });
    expect(await send(w)).toEqual({ status: 200, body: { answer: null, confidence: null, decidedBy: 'old' } });
  });

  it('answers Shadow with today\'s answer, and logs Jev\'s beside the agent\'s', async () => {
    const w = world({ mode: 'shadow', noul: 0.82 });
    expect(await send(w)).toEqual({ status: 200, body: { answer: null, confidence: null, decidedBy: 'old' } });
    expect(w.asked).toHaveLength(1);
    expect(w.logged).toEqual([expect.objectContaining({
      decision: 'outbox-risk', mode: 'shadow', outcome: 'answered', jevAnswer: 'true', oldAnswer: 'false', counted: 'false',
      decidedBy: 'old', ref: 'item 812-s3-03',
    })]);
  });

  it('answers On with Jev\'s answer and its confidence, sending the state the entry builds', async () => {
    const w = world({ mode: 'on', noul: 0.91 });
    const run = await send(w);
    expect(run.status).toBe(200);
    expect(run.body).toEqual({ answer: 'true', confidence: expect.closeTo(0.82, 5), decidedBy: 'jev' });
    expect(w.asked).toEqual([{ state: expect.stringContaining('Decision: Keep the sessions in Postgres'), question: expect.objectContaining({ type: 'noul' }) }]);
    expect(w.logged).toEqual([expect.objectContaining({ mode: 'on', counted: 'true', decidedBy: 'jev', oldAnswer: 'false' })]);
  });

  it('answers On with Jev\'s lower answer too (decision 4)', async () => {
    const w = world({ mode: 'on', noul: 0.1 });
    expect((await send(w, { ...CALL, old: 'true' })).body).toEqual({ answer: 'false', confidence: expect.closeTo(0.8, 5), decidedBy: 'jev' });
  });

  it('answers On with today\'s answer when Jev fails or is unsure', async () => {
    const failed = world({ mode: 'on', outcome: { kind: 'failed', reason: 'timeout', status: null, message: 'late', ms: 5000 } });
    expect((await send(failed)).body).toEqual({ answer: null, confidence: null, decidedBy: 'old' });
    const unsure = world({ mode: 'on', noul: 0.55 });
    expect((await send(unsure)).body).toEqual({ answer: null, confidence: null, decidedBy: 'old' });
    expect(unsure.logged).toEqual([expect.objectContaining({ outcome: 'under-floor' })]);
  });

  it('takes a call without a ref', async () => {
    const w = world({ mode: 'shadow' });
    const { ref: _ref, ...noRef } = CALL;
    expect((await send(w, noRef)).status).toBe(200);
    expect(sure(w.logged[0], 'w.logged[0]').ref).toBeNull();
  });
});

describe('what repo_workspace() returned', () => {
  it('is the workspace, from a row or a one-row list', () => {
    expect(placedFrom({ workspace_id: 'w1', refusal: null })).toEqual({ workspace: 'w1', reason: null });
    expect(placedFrom([{ workspace_id: 'w1' }])).toEqual({ workspace: 'w1', reason: null });
  });

  it('is the refusal, or no reason, when no workspace owns the repository', () => {
    expect(placedFrom([{ workspace_id: null, refusal: 'Install the App first.' }])).toEqual({ workspace: null, reason: 'Install the App first.' });
    expect(placedFrom([])).toEqual({ workspace: null, reason: null });
    expect(placedFrom(null)).toEqual({ workspace: null, reason: null });
  });
});

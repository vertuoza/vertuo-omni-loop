import { generateKeyPairSync } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseIssue, parsePr } from 'omni-loop/kit/lib/ids.ts';
import { FAKE_WORKSPACE, fakeSupabase } from '../dossier/store.fake';
import type { ConceptFacts, FixIssue } from '../dossier/github/fix';
import { UNREAD } from '../dossier/github/summary';
import type { ConceptFactsStore } from '../fixes/facts/store';
import { CONCEPT_1269 } from './list.fixture';
import { keepIssue, markDone, type Caller, type DoneDeps } from './done';
import { doneComment, issueSetter } from './done-github';

vi.mock('server-only', () => ({}));

// Mark done and Reopen (PRD 2213, s3): the route as a function of a Request, the caller read through their
// own stubbed session (row-level security as the migration keeps it), GitHub a fake that records each call.

const ADA = { id: '00000000-0000-4000-8000-0000000000a1', email: 'ada@example.com' };
const BOB = { id: '00000000-0000-4000-8000-0000000000b1', email: 'bob@example.com' };
const OTHER = '00000000-0000-4000-8000-00000000aced';
const CARL = { id: '00000000-0000-4000-8000-0000000000c1', email: 'carl@example.com', workspaces: [OTHER] };

const MERGED: ConceptFacts = {
  issue: UNREAD, pull: { number: parsePr(1270), url: 'https://github.com/acme/widgets/pull/1270', state: 'merged', mergedAt: '2026-10-07T09:00:00Z', mergedBy: null },
};
const issueAfter = (state: 'open' | 'closed'): FixIssue => ({
  number: parseIssue(1269), url: 'https://github.com/acme/widgets/issues/1269', state, author: 'ada', createdAt: '2026-10-01T09:00:00Z', risk: null, regression: false,
});

let fake: ReturnType<typeof fakeSupabase>;
let concept = '';
let setIssue: ReturnType<typeof vi.fn<DoneDeps['setIssue']>>;
let keep: ReturnType<typeof vi.fn<DoneDeps['keep']>>;

const as = (token: string | null, login: string | null = 'bob-gh'): DoneDeps => ({
  session: () => Promise.resolve(token === null ? null : ({ db: fake.client(token) as unknown as Caller['db'], login } satisfies Caller)),
  setIssue,
  keep,
});
const post = (deps: DoneDeps, body: unknown) =>
  markDone(new Request('http://x/api/concepts/done', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }), deps);

beforeEach(async () => {
  fake = fakeSupabase({ ada: ADA, bob: BOB, carl: CARL }, { [FAKE_WORKSPACE]: 'acme', [OTHER]: 'other' });
  const pushed = await fake.client('ada').rpc('dossier_push', {
    p_repo: 'acme/widgets', p_draft: null, p_prd: 1269, p_kind: 'concept', p_title: 'Products', p_artifacts: [{ kind: 'concept-record', content: CONCEPT_1269 }],
  });
  concept = (pushed.data as { id: string }).id;
  setIssue = vi.fn<DoneDeps['setIssue']>((_repo, _issue, done) => Promise.resolve(issueAfter(done ? 'closed' : 'open')));
  keep = vi.fn<DoneDeps['keep']>(() => Promise.resolve());
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); });

describe('POST /api/concepts/done', () => {
  it('closes a concept\'s issue for a member, as them, then stores the issue', async () => {
    const answer = await post(as('bob'), { concept, done: true });
    expect(answer.status).toBe(200);
    expect(await answer.json()).toEqual({ concept, issue: { number: 1269, state: 'closed' } });
    expect(setIssue).toHaveBeenCalledWith('acme/widgets', 1269, true, 'bob-gh');
    expect(keep).toHaveBeenCalledWith(expect.objectContaining({ id: concept }), issueAfter('closed'));
  });

  it('reopens it with done: false', async () => {
    const answer = await post(as('bob'), { concept, done: false });
    expect(answer.status).toBe(200);
    expect(setIssue).toHaveBeenCalledWith('acme/widgets', 1269, false, 'bob-gh');
    expect(keep).toHaveBeenCalledWith(expect.anything(), issueAfter('open'));
  });

  it('refuses a signed-out caller with 401 and touches nothing', async () => {
    expect((await post(as(null), { concept, done: true })).status).toBe(401);
    expect(setIssue).not.toHaveBeenCalled();
    expect(keep).not.toHaveBeenCalled();
  });

  it('refuses a caller who is not a member of the concept\'s workspace with 403, the issue unchanged', async () => {
    const answer = await post(as('carl'), { concept, done: true });
    expect(answer.status).toBe(403);
    expect(setIssue).not.toHaveBeenCalled();
    expect(keep).not.toHaveBeenCalled();
  });

  it('refuses a dossier that is not a concept the same way', async () => {
    const prd = ((await fake.client('ada').rpc('dossier_push', {
      p_repo: 'acme/widgets', p_draft: null, p_prd: 7, p_title: 'Team inbox', p_artifacts: [{ kind: 'spec', content: '# Team inbox\n' }],
    })).data as { id: string }).id;
    expect((await post(as('bob'), { concept: prd, done: true })).status).toBe(403);
    expect(setIssue).not.toHaveBeenCalled();
  });

  it('closes or reopens the issue of a concept still in review for a member: the page\'s button decides where it shows (BR-PRODUCT-121)', async () => {
    // The concept was only pushed: no merged concept PR is stored for it, so it reads as in review or unknown.
    const answer = await post(as('bob'), { concept, done: true });
    expect(answer.status).toBe(200);
    expect(await answer.json()).toEqual({ concept, issue: { number: 1269, state: 'closed' } });
    expect(setIssue).toHaveBeenCalledWith('acme/widgets', 1269, true, 'bob-gh');
    expect((await post(as('bob'), { concept, done: false })).status).toBe(200);
    expect(setIssue).toHaveBeenLastCalledWith('acme/widgets', 1269, false, 'bob-gh');
  });

  it('asks a caller with no GitHub login to sign in with it, changing nothing', async () => {
    expect((await post(as('bob', null), { concept, done: true })).status).toBe(403);
    expect(setIssue).not.toHaveBeenCalled();
  });

  it('answers an error and stores nothing when GitHub fails', async () => {
    setIssue.mockRejectedValueOnce(new Error('GitHub answered 500'));
    const answer = await post(as('bob'), { concept, done: true });
    expect(answer.status).toBe(502);
    expect(((await answer.json()) as { error: string }).error).toContain('Nothing changed');
    expect(keep).not.toHaveBeenCalled();
  });

  it('refuses a body out of shape with 400', async () => {
    for (const body of ['nope', { concept: 'x', done: true }, { concept, done: 'yes' }, { concept, done: true, more: 1 }]) {
      expect((await post(as('bob'), body)).status).toBe(400);
    }
  });

  it('answers 503 where the deployment has no database', async () => {
    expect((await post({ ...as('bob'), session: null }, { concept, done: true })).status).toBe(503);
  });
});

describe('what is stored after GitHub answered', () => {
  it('writes the new issue and keeps the stored concept PR', async () => {
    const written: unknown[] = [];
    const store: ConceptFactsStore = {
      readFacts: () => Promise.resolve(new Map([[concept, MERGED]])),
      writeFacts: (rows) => { written.push(...rows); return Promise.resolve(); },
    };
    await keepIssue(store)({ id: concept, workspace_id: 'w' }, issueAfter('closed'));
    expect(written).toEqual([{ dossier_id: concept, workspace_id: 'w', facts: { issue: issueAfter('closed'), pull: MERGED.pull } }]);
  });
});

describe('the issue, closed or reopened as the App', () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const CREDS = { appId: '42', privateKey: privateKey.export({ type: 'pkcs1', format: 'pem' }).toString() };
  type Call = { method: string; url: string; body: unknown; authorization: string | null };

  function github({ installed = true, update = 200, comment = 201 } = {}) {
    const calls: Call[] = [];
    const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    const fetch = (url: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers);
      calls.push({ method: init.method ?? 'GET', url, body: typeof init.body === 'string' ? JSON.parse(init.body) as unknown : null, authorization: headers.get('authorization') });
      if (url.endsWith('/installation')) return Promise.resolve(installed ? json(200, { id: 7, account: { login: 'acme', type: 'Organization' } }) : json(404, {}));
      if (url.endsWith('/access_tokens')) return Promise.resolve(json(201, { token: 'inst-token', expires_at: '2026-10-09T11:00:00Z' }));
      if (url.endsWith('/comments')) return Promise.resolve(json(comment, {}));
      return Promise.resolve(json(update, update === 200
        ? { number: 1269, html_url: 'https://github.com/acme/widgets/issues/1269', state: (calls.at(-1)?.body as { state: string }).state, created_at: '2026-10-01T09:00:00Z', user: { login: 'ada' } }
        : { message: 'nope' }));
    };
    return { calls, set: issueSetter({ creds: CREDS, fetch, store: null, clock: () => Date.parse('2026-10-09T10:00:00Z') }) };
  }
  const issueCalls = (calls: Call[]) => calls.filter((c) => c.url.includes('/issues/'));

  it('closes as completed, then comments who marked it, with the installation token', async () => {
    const g = github();
    const issue = await g.set('acme/widgets', parseIssue(1269), true, 'bob-gh');
    expect(issue).toMatchObject({ number: 1269, state: 'closed', author: 'ada' });
    expect(issueCalls(g.calls)).toEqual([
      { method: 'PATCH', url: 'https://api.github.com/repos/acme/widgets/issues/1269', body: { state: 'closed', state_reason: 'completed' }, authorization: 'Bearer inst-token' },
      { method: 'POST', url: 'https://api.github.com/repos/acme/widgets/issues/1269/comments', body: { body: 'Marked done on the Omni page by @bob-gh.' }, authorization: 'Bearer inst-token' },
    ]);
  });

  it('reopens with its own comment', async () => {
    const g = github();
    expect((await g.set('acme/widgets', parseIssue(1269), false, 'bob-gh')).state).toBe('open');
    expect(issueCalls(g.calls).map((c) => c.body)).toEqual([{ state: 'open', state_reason: 'reopened' }, { body: 'Reopened on the Omni page by @bob-gh.' }]);
    expect(doneComment(false, 'bob-gh')).toBe('Reopened on the Omni page by @bob-gh.');
  });

  it('throws, commenting nothing, where the App is not installed or GitHub refuses the update', async () => {
    const away = github({ installed: false });
    await expect(away.set('acme/widgets', parseIssue(1269), true, 'bob-gh')).rejects.toThrow('not installed');
    const refused = github({ update: 403 });
    await expect(refused.set('acme/widgets', parseIssue(1269), true, 'bob-gh')).rejects.toThrow('403');
    expect(issueCalls(refused.calls)).toHaveLength(1);
  });

  it('keeps the new state when only the comment fails', async () => {
    const g = github({ comment: 500 });
    expect((await g.set('acme/widgets', parseIssue(1269), true, 'bob-gh')).state).toBe('closed');
  });
});

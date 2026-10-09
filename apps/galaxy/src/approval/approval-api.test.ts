import { describe, expect, it } from 'vitest';
import { parseApprovalReply } from 'vertuo-omni-plan/kit/lib/approval/approval.ts';
import { approveDossier, answerApproval, type ApprovalDeps } from './approval-api';

// The approval route (PRD 1299 s2), with a stubbed Supabase client and a stubbed labeller:
//
//   GET  /api/dossiers/approval?repo=&prd=   the approval in force, in the shape the kit reads
//                                            (settled item s4-02-approval-route-shape)
//   POST /api/dossiers/approval {dossier}    a member approves; the PRD's issue gets its label
//
// and each refusal, in plain words.

const ADA = { id: '00000000-0000-4000-8000-0000000000a1', email: 'ada@acme.test' };
const DOSSIER = '11111111-1111-4111-8111-111111111111';
const AT = '2026-10-09T10:00:00.123456+00:00';
const FILES = [
  { kind: 'spec', path: 'spec.md', sha256: 'a'.repeat(64), versionId: '22222222-2222-4222-8222-222222222222', content: 'the spec' },
  { kind: 'plan', path: 'plan.md', sha256: 'b'.repeat(64), versionId: '33333333-3333-4333-8333-333333333333', content: 'the plan' },
];
const APPROVED = { dossier: DOSSIER, approval: { approver: { login: 'bob-gh', member: true }, approvedAt: AT, files: FILES } };

type Answer = { data: unknown; error: { code?: string; message?: string } | null };

type World = { database?: boolean; session?: boolean; answers?: Record<string, Answer>; label?: () => Promise<void> };

function world({ database = true, session = true, answers = {}, label = () => Promise.resolve() }: World = {}) {
  const calls: Array<{ fn: string; args: unknown; as: string }> = [];
  const labelled: Array<[string, number]> = [];
  const rpcAs = (as: string) => (fn: string, args: unknown) => {
    calls.push({ fn, args, as });
    const answer = answers[fn];
    if (answer) return Promise.resolve(answer);
    if (fn === 'dossier_approval') return Promise.resolve({ data: APPROVED, error: null });
    return Promise.resolve({ data: { id: 'a1', repo: 'acme/widgets', prd: 1299 }, error: null });
  };
  const client = (token: string) => ({
    auth: {
      getUser: (jwt: string) => Promise.resolve(jwt === 'ada-token'
        ? { data: { user: ADA }, error: null }
        : { data: { user: null }, error: { status: 401, message: 'bad jwt' } }),
    },
    rpc: rpcAs(`token:${token}`),
  });
  const deps: ApprovalDeps = {
    connect: database ? (client as unknown as NonNullable<ApprovalDeps['connect']>) : null,
    session: () => Promise.resolve(session ? ({ rpc: rpcAs('session') } as unknown as Awaited<ReturnType<ApprovalDeps['session']>>) : null),
    label: (repo, prd) => { labelled.push([repo, prd]); return label(); },
    installLink: 'https://github.com/apps/omni/installations/new',
  };
  const get = async (query: string, token: string | null = 'ada-token') => {
    const response = await answerApproval(new Request(`https://omni.example/api/dossiers/approval${query}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    }), deps);
    return { status: response.status, body: (await response.json()) as unknown, cache: response.headers.get('cache-control') };
  };
  const post = async (body: unknown, headers: Record<string, string> = {}) => {
    const response = await approveDossier(new Request('https://omni.example/api/dossiers/approval', {
      method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body),
    }), deps);
    return { status: response.status, body: (await response.json()) as unknown };
  };
  return { calls, labelled, get, post };
}

const IN_FORCE = {
  url: `https://omni.example/prd/${DOSSIER}`,
  approval: { approver: { login: 'bob-gh', member: true }, approvedAt: '2026-10-09T10:00:00.123Z', files: FILES },
};

describe('GET /api/dossiers/approval', () => {
  it('answers the approval in force with the dossier link, in the shape the kit reads, never cached', async () => {
    const w = world();
    const answer = await w.get('?repo=Acme/Widgets&prd=1299');
    expect(answer).toEqual({ status: 200, body: IN_FORCE, cache: 'no-store' });
    expect(parseApprovalReply(answer.body)).toEqual(IN_FORCE);
    expect(w.calls).toEqual([{ fn: 'dossier_approval', args: { p_repo: 'acme/widgets', p_prd: 1299 }, as: 'token:ada-token' }]);
  });

  it('answers approval null for a PRD nobody approved yet', async () => {
    const w = world({ answers: { dossier_approval: { data: { dossier: DOSSIER, approval: null }, error: null } } });
    const answer = await w.get('?repo=acme/widgets&prd=1299');
    expect(answer.body).toEqual({ url: `https://omni.example/prd/${DOSSIER}`, approval: null });
    expect(parseApprovalReply(answer.body)).not.toBeNull();
  });

  it('keeps a file the database sent without its text, without one', async () => {
    const files = [{ kind: 'spec', path: 'spec.md', sha256: 'a'.repeat(64), versionId: FILES[0]?.versionId, content: null }];
    const w = world({ answers: { dossier_approval: { data: { dossier: DOSSIER, approval: { ...APPROVED.approval, files } }, error: null } } });
    const body = (await w.get('?repo=acme/widgets&prd=1299')).body;
    expect(body).toMatchObject({ approval: { files: [{ kind: 'spec', path: 'spec.md' }] } });
    expect(JSON.stringify(body)).not.toContain('content');
    expect(parseApprovalReply(body)).not.toBeNull();
  });

  it('answers 404 for a PRD with no dossier the caller reads', async () => {
    const w = world({ answers: { dossier_approval: { data: null, error: null } } });
    expect(await w.get('?repo=acme/widgets&prd=7')).toMatchObject({ status: 404, body: { error: 'No dossier for PRD #7 of acme/widgets.' } });
  });

  it('refuses a malformed repository or PRD, with no database call', async () => {
    const w = world();
    expect(await w.get('?repo=widgets&prd=1')).toMatchObject({ status: 400, body: { error: '`repo` must be the repository as owner/name.' } });
    expect(await w.get('?prd=1')).toMatchObject({ status: 400 });
    expect(await w.get('?repo=acme/widgets&prd=0')).toMatchObject({ status: 400, body: { error: "`prd` is the PRD's number." } });
    expect(await w.get('?repo=acme/widgets&prd=1.5')).toMatchObject({ status: 400 });
    expect(await w.get('?repo=acme/widgets')).toMatchObject({ status: 400 });
    expect(w.calls).toEqual([]);
  });

  it('refuses a caller with no valid sign-in', async () => {
    const w = world();
    expect(await w.get('?repo=acme/widgets&prd=1', null)).toMatchObject({ status: 401 });
    expect(await w.get('?repo=acme/widgets&prd=1', 'stale')).toMatchObject({ status: 401 });
    expect(w.calls).toEqual([]);
  });

  it('answers 503 where there is no database', async () => {
    expect(await world({ database: false }).get('?repo=acme/widgets&prd=1')).toMatchObject({
      status: 503, body: { error: 'Approvals are not available here: this deployment has no database.' },
    });
  });

  it("answers the database's refusal as 403, and a failure or an answer out of shape as 500", async () => {
    const refused = world({ answers: { dossier_approval: { data: null, error: { code: '42501', message: 'Sign in first.' } } } });
    expect(await refused.get('?repo=acme/widgets&prd=1')).toMatchObject({ status: 403, body: { error: 'Sign in first.' } });
    const failed = world({ answers: { dossier_approval: { data: null, error: { code: 'XX000', message: 'boom' } } } });
    expect(await failed.get('?repo=acme/widgets&prd=1')).toMatchObject({ status: 500, body: { error: 'The approval could not be read. Try again.' } });
    const odd = world({ answers: { dossier_approval: { data: { dossier: DOSSIER, approval: { approver: 'bob' } }, error: null } } });
    expect(await odd.get('?repo=acme/widgets&prd=1')).toMatchObject({ status: 500 });
  });
});

describe('POST /api/dossiers/approval', () => {
  it('approves as the signed-in person on the page, labels the issue and answers the approval in force', async () => {
    const w = world();
    expect(await w.post({ dossier: DOSSIER })).toEqual({ status: 201, body: IN_FORCE });
    expect(w.calls).toEqual([
      { fn: 'dossier_approve', args: { p_dossier: DOSSIER }, as: 'session' },
      { fn: 'dossier_approval', args: { p_repo: 'acme/widgets', p_prd: 1299 }, as: 'session' },
    ]);
    expect(w.labelled).toEqual([['acme/widgets', 1299]]);
  });

  it('approves as a terminal sign-in when the call carries a bearer token', async () => {
    const w = world();
    expect((await w.post({ dossier: DOSSIER }, { authorization: 'Bearer ada-token' })).status).toBe(201);
    expect(w.calls.map((c) => c.as)).toEqual(['token:ada-token', 'token:ada-token']);
    expect((await w.post({ dossier: DOSSIER }, { authorization: 'Bearer stale' })).status).toBe(401);
  });

  it('keeps the approval when the label cannot be added: the label is for display', async () => {
    const w = world({ label: () => Promise.reject(new Error('GitHub answered 502')) });
    expect((await w.post({ dossier: DOSSIER })).status).toBe(201);
    expect(w.labelled).toEqual([['acme/widgets', 1299]]);
  });

  it('refuses nobody signed in, and a body that names no dossier, with no database call', async () => {
    expect(await world({ session: false }).post({ dossier: DOSSIER })).toMatchObject({
      status: 401, body: { error: 'Sign in first to approve a PRD.' },
    });
    const w = world();
    expect(await w.post({ dossier: 'nope' })).toMatchObject({ status: 400, body: { error: '`dossier` is the id of the PRD\'s dossier.' } });
    expect(await w.post({})).toMatchObject({ status: 400 });
    expect(await w.post('not json')).toMatchObject({ status: 400, body: { error: 'The body must be a JSON object.' } });
    expect(await w.post([DOSSIER])).toMatchObject({ status: 400 });
    expect(w.calls).toEqual([]);
    expect(w.labelled).toEqual([]);
  });

  it("answers each refusal of the database in plain words, and labels nothing", async () => {
    const as = (code: string, message: string) => world({ answers: { dossier_approve: { data: null, error: { code, message } } } });
    const member = as('42501', 'Only a member of the workspace that owns acme/widgets approves its PRDs.');
    expect(await member.post({ dossier: DOSSIER })).toEqual({
      status: 403, body: { error: 'Only a member of the workspace that owns acme/widgets approves its PRDs.' },
    });
    expect(await as('P0002', 'No such dossier.').post({ dossier: DOSSIER })).toEqual({ status: 404, body: { error: 'No such dossier.' } });
    const born = as('22023', 'PRD #7 was born in the repository: its phase-0 pull request approves it.');
    expect(await born.post({ dossier: DOSSIER })).toEqual({
      status: 400, body: { error: 'PRD #7 was born in the repository: its phase-0 pull request approves it.' },
    });
    expect(await as('22023', 'PRD #7 has no plan yet: push it first.').post({ dossier: DOSSIER })).toMatchObject({ status: 400 });
    const failed = as('XX000', 'boom');
    expect(await failed.post({ dossier: DOSSIER })).toEqual({ status: 500, body: { error: 'The approval could not be written. Try again.' } });
    expect([member, born, failed].flatMap((w) => w.labelled)).toEqual([]);
  });

  it('answers 500 when the approval is written but its answer is out of shape', async () => {
    const w = world({ answers: { dossier_approve: { data: { id: 'a1' }, error: null } } });
    expect(await w.post({ dossier: DOSSIER })).toMatchObject({ status: 500 });
  });

  it('answers 503 where there is no database', async () => {
    expect((await world({ database: false }).post({ dossier: DOSSIER })).status).toBe(503);
  });
});

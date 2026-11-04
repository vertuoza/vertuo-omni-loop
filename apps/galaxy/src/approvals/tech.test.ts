import { describe, expect, it } from 'vitest';
import { TechMembersSchema, TechRequestedSchema } from 'omni-loop/kit/lib/approval/tech.ts';
import { parsePrd } from 'omni-loop/kit/lib/ids.ts';
import type { Channels } from '../notify/notify';
import type { ApprovalsRepository, ReachRepository } from './approvals.repository';
import { askApproversAfterTech, type AskDeps } from './approvals.service';
import { requestTechApproval, techMembers, type TechRouteDeps } from './tech.controller';
import { techRepository, type TechRepository } from './tech.repository';

// A Tech Approval requested (PRD 2608 s3), against fake repositories and channels:
//
//   GET  /api/dossiers/approval/tech?repo=&prd=   the workspace's members who can be named
//   POST /api/dossiers/approval/tech {repo, prd, login} (or {dossier, login})   requests it
//
// Who may request is the database's (supabase/checks/tech_approval.sql); here, what the route makes of its
// answer: the shape the kit reads, the named person reached by the channels they have on with the page and
// /omni:tech-review <n>, and each refusal in the database's own words.

const DOSSIER = '11111111-1111-4111-8111-111111111111';
const REQUEST = '22222222-2222-4222-8222-222222222222';
const WORKSPACE = '44444444-4444-4444-8444-444444444444';
const IRISA = '00000000-0000-4000-8000-0000000000a4';
const ADA = { id: '00000000-0000-4000-8000-0000000000a2', email: 'ada@acme.test' };

const REQUESTED = {
  id: REQUEST, dossier: DOSSIER, repo: 'acme/widgets', prd: parsePrd(2608), title: 'Tech Approval', kind: 'asked' as const, approvalKind: 'tech' as const,
  askedAt: '2026-11-04T10:00:00.000Z', author: 'ada-gh', asked: [{ user: IRISA, login: 'irisa-gh', name: 'Irisa' }],
};

const RECIPIENTS = [{ user: IRISA, email: 'irisa@acme.test', devices: [{ id: '33333333-3333-4333-8333-333333333331', endpoint: 'https://push.example/irisa', p256dh: 'k', auth: 'a' }] }];

type World = {
  database?: boolean;
  session?: boolean;
  service?: boolean;
  requested?: Awaited<ReturnType<TechRepository['request']>>;
  dossier?: Awaited<ReturnType<TechRepository['dossier']>>;
  workspace?: Awaited<ReturnType<TechRepository['workspace']>>;
  roster?: Awaited<ReturnType<TechRepository['roster']>>;
  recipients?: Awaited<ReturnType<ReachRepository['recipients']>>;
};

function world({
  database = true, session = true, service = true,
  requested = { ok: true, value: REQUESTED },
  dossier = { ok: true, value: { dossier: DOSSIER } },
  workspace = { ok: true, value: [{ workspace_id: WORKSPACE }] },
  roster = { ok: true, value: [{ user_id: ADA.id, name: 'Ada', github_login: 'ada-gh' }, { user_id: IRISA, name: null, github_login: 'irisa-gh' }, { user_id: REQUEST, name: 'No GitHub', github_login: null }] },
  recipients = { ok: true, value: RECIPIENTS },
}: World = {}) {
  const asked: Array<{ dossier: string; login: string; as: string }> = [];
  const found: unknown[] = [];
  const read: string[] = [];
  const pushes: string[] = [];
  const emails: Array<{ to: string; subject: string; text: string; html: string }> = [];
  const logs: string[] = [];
  const repository = (as: string): TechRepository => ({
    dossier: (repo, prd) => { found.push({ repo, prd }); return Promise.resolve(dossier); },
    workspace: (id) => { found.push({ id }); return Promise.resolve(workspace); },
    roster: () => Promise.resolve(roster),
    request: (id, login) => { asked.push({ dossier: id, login, as }); return Promise.resolve(requested); },
  });
  const reach: ReachRepository = { recipients: (id) => { read.push(id); return Promise.resolve(recipients); }, forget: () => Promise.resolve() };
  const deps: TechRouteDeps = {
    connect: database
      ? (token) => ({
          auth: {
            getUser: (jwt: string) => Promise.resolve(jwt === 'ada-token'
              ? { data: { user: ADA }, error: null }
              : { data: { user: null }, error: { status: 401, message: 'bad jwt' } }),
          },
          tech: repository(`token:${token}`),
        })
      : null,
    session: () => Promise.resolve(session ? repository('session') : null),
    reach: service ? reach : null,
    channels: (_contact, forget): Channels => ({
      push: (_device, payload) => { pushes.push(payload); return Promise.resolve('sent'); },
      email: (email) => { emails.push(email); return Promise.resolve(true); },
      forget,
    }),
    log: (line) => { logs.push(line); },
  };
  const post = async (body: unknown, token: string | null = 'ada-token') => {
    const response = await requestTechApproval(new Request('https://omni.example/api/dossiers/approval/tech', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }), deps);
    return { status: response.status, body: (await response.json()) as unknown };
  };
  const get = async (query: string, token: string | null = 'ada-token') => {
    const response = await techMembers(new Request(`https://omni.example/api/dossiers/approval/tech${query}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    }), deps);
    return { status: response.status, body: (await response.json()) as unknown };
  };
  return { asked, found, read, pushes, emails, logs, post, get };
}

const URL_ = `https://omni.example/prd/${DOSSIER}`;

describe('POST /api/dossiers/approval/tech', () => {
  it('requests it as the caller, from the repository and the number, and answers in the shape the kit reads', async () => {
    const w = world();
    const answer = await w.post({ repo: 'Acme/Widgets', prd: 2608, login: 'irisa-gh' });
    expect(answer).toEqual({ status: 200, body: { login: 'irisa-gh', state: 'asked', url: URL_ } });
    expect(TechRequestedSchema.parse(answer.body)).toEqual(answer.body);
    expect(w.found).toEqual([{ repo: 'acme/widgets', prd: 2608 }]);
    expect(w.asked).toEqual([{ dossier: DOSSIER, login: 'irisa-gh', as: 'token:ada-token' }]);
  });

  it("requests it by the dossier, as the page's own session", async () => {
    const w = world();
    expect((await w.post({ dossier: DOSSIER, login: 'irisa-gh' }, null)).status).toBe(200);
    expect(w.found).toEqual([]);
    expect(w.asked).toEqual([{ dossier: DOSSIER, login: 'irisa-gh', as: 'session' }]);
  });

  it('reaches the named person by the channels they have on, naming the page and /omni:tech-review <n>', async () => {
    const w = world();
    await w.post({ repo: 'acme/widgets', prd: 2608, login: 'irisa-gh' });
    expect(w.read).toEqual([REQUEST]);
    expect(w.pushes.map((p): unknown => JSON.parse(p))).toEqual([{
      title: 'PRD 2608 waits for your tech approval',
      body: 'Tech Approval\n/omni:tech-review 2608',
      url: `/prd/${DOSSIER}`,
    }]);
    expect(w.emails.map((e) => [e.to, e.subject])).toEqual([['irisa@acme.test', 'PRD 2608 waits for your tech approval: Tech Approval']]);
    for (const part of [w.emails[0]?.text, w.emails[0]?.html]) {
      expect(part).toContain('/omni:tech-review 2608');
      expect(part).toContain(URL_);
    }
    expect(w.logs).toEqual([]);
  });

  it('keeps the request when nobody can be reached, said in the log', async () => {
    const keyless = world({ service: false });
    expect((await keyless.post({ repo: 'acme/widgets', prd: 2608, login: 'irisa-gh' })).status).toBe(200);
    expect(keyless.logs).toEqual(['approvals: PRD #2608 of acme/widgets is asked, but nobody is reached: SUPABASE_SERVICE_ROLE_KEY is not set']);
    const unread = world({ recipients: { ok: false, refusal: { code: 'shape', message: 'out of shape' } } });
    expect((await unread.post({ repo: 'acme/widgets', prd: 2608, login: 'irisa-gh' })).status).toBe(200);
    expect(unread.logs).toEqual(['approvals: who PRD #2608 of acme/widgets reaches could not be read: out of shape']);
  });

  it("answers the database's refusals in its own words, reaching nobody", async () => {
    const cases: Array<[string, string, number, string]> = [
      ['42501', 'Only the author of PRD #2608 requests its Tech Approval.', 403, 'Only the author of PRD #2608 requests its Tech Approval.'],
      ['22023', 'The author of PRD #2608 never gives its Tech Approval: name another member.', 400, 'The author of PRD #2608 never gives its Tech Approval: name another member.'],
      ['P0002', 'No such dossier.', 404, 'No such dossier.'],
      ['shape', 'dossier_request_tech_approval() answered out of shape', 500, 'The Tech Approval could not be requested. Try again.'],
    ];
    for (const [code, message, status, error] of cases) {
      const w = world({ requested: { ok: false, refusal: { code, message } } });
      expect(await w.post({ repo: 'acme/widgets', prd: 2608, login: 'irisa-gh' })).toEqual({ status, body: { error } });
      expect(w.pushes).toEqual([]);
    }
  });

  it('answers 404 for a PRD the caller does not read, and 400 for a malformed body, asking nothing', async () => {
    const none = world({ dossier: { ok: true, value: null } });
    expect(await none.post({ repo: 'acme/widgets', prd: 2608, login: 'irisa-gh' })).toEqual({ status: 404, body: { error: 'No PRD #2608 of acme/widgets you can read.' } });
    expect(none.asked).toEqual([]);
    for (const body of ['not json', [], { repo: 'acme/widgets', prd: 2608 }, { repo: 'acme', prd: 2608, login: 'a' }, { dossier: 'nope', login: 'a' }, { repo: 'acme/widgets', prd: 0, login: 'a' }, { dossier: DOSSIER, login: '' }]) {
      const w = world();
      expect((await w.post(body)).status).toBe(400);
      expect(w.asked).toEqual([]);
    }
  });

  it('answers 401 signed out and 503 without a database', async () => {
    expect((await world().post({ dossier: DOSSIER, login: 'a' }, 'stale')).status).toBe(401);
    expect((await world({ session: false }).post({ dossier: DOSSIER, login: 'a' }, null)).status).toBe(401);
    expect((await world({ database: false }).post({ dossier: DOSSIER, login: 'a' })).status).toBe(503);
  });
});

describe('GET /api/dossiers/approval/tech', () => {
  it("lists the workspace's members who have a login, in the shape the kit reads", async () => {
    const w = world();
    const answer = await w.get('?repo=Acme/Widgets&prd=2608');
    expect(answer).toEqual({ status: 200, body: { members: [{ login: 'ada-gh', name: 'Ada' }, { login: 'irisa-gh', name: null }] } });
    expect(TechMembersSchema.parse(answer.body)).toEqual(answer.body);
    expect(w.found).toEqual([{ repo: 'acme/widgets', prd: 2608 }, { id: DOSSIER }]);
  });

  it('lists them by the dossier too, for the page', async () => {
    const w = world();
    expect((await w.get(`?dossier=${DOSSIER}`, null)).status).toBe(200);
    expect(w.found).toEqual([{ id: DOSSIER }]);
  });

  it('refuses a malformed query, a PRD the caller does not read, and a failed read', async () => {
    expect((await world().get('?repo=acme&prd=2608')).status).toBe(400);
    expect((await world().get('?repo=acme/widgets&prd=zero')).status).toBe(400);
    expect((await world({ dossier: { ok: true, value: null } }).get('?repo=acme/widgets&prd=2608')).status).toBe(404);
    expect((await world({ workspace: { ok: true, value: [] } }).get(`?dossier=${DOSSIER}`)).status).toBe(404);
    expect(await world({ roster: { ok: false, refusal: { code: 'XX000', message: 'boom' } } }).get('?repo=acme/widgets&prd=2608')).toEqual({
      status: 500, body: { error: 'The members could not be read. Try again.' },
    });
  });
});

describe('askApproversAfterTech', () => {
  const REQUESTED_PRODUCT = {
    id: REQUEST, dossier: DOSSIER, repo: 'acme/widgets', prd: parsePrd(2608), title: 'Tech Approval', kind: 're-asked' as const, askedAt: '2026-11-04T10:00:00.000Z',
    product: 'Mobile', author: 'ada-gh', nobodyElse: false, asked: [{ user: IRISA, login: 'irisa-gh', name: null }], files: [], spec: null,
  };

  function asking(request: ApprovalsRepository['request']) {
    const logs: string[] = [];
    const emails: string[] = [];
    const deps: AskDeps = {
      approvals: { request, waiting: () => Promise.resolve({ ok: true, value: [] }) },
      reach: { recipients: () => Promise.resolve({ ok: true, value: RECIPIENTS }), forget: () => Promise.resolve() },
      channels: (_contact, forget): Channels => ({ push: () => Promise.resolve('sent'), email: (email) => { emails.push(email.subject); return Promise.resolve(true); }, forget }),
      log: (line) => { logs.push(line); },
    };
    return { deps, logs, emails };
  }

  it('asks the product approvers and reaches them, as any request does', async () => {
    const asked: unknown[] = [];
    const w = asking((repo, prd) => { asked.push([repo, prd]); return Promise.resolve({ ok: true, value: REQUESTED_PRODUCT }); });
    await askApproversAfterTech(w.deps, 'acme/widgets', parsePrd(2608), 'https://omni.example');
    expect(asked).toEqual([['acme/widgets', 2608]]);
    expect(w.emails).toEqual(['PRD 2608 waits for your approval: Tech Approval']);
    expect(w.logs).toEqual([]);
  });

  it('logs a refusal or a failure, and never throws: the tech approval is the record', async () => {
    const refused = asking(() => Promise.resolve({ ok: false, refusal: { code: 'XX000', message: 'boom' } }));
    await askApproversAfterTech(refused.deps, 'acme/widgets', parsePrd(2608), 'https://omni.example');
    expect(refused.logs).toEqual(["approvals: PRD #2608 of acme/widgets's tech approval is given, but its approvers are not asked: boom"]);
    const failed = asking(() => Promise.reject(new Error('reset')));
    await expect(askApproversAfterTech(failed.deps, 'acme/widgets', parsePrd(2608), 'https://omni.example')).resolves.toBeUndefined();
    expect(failed.logs).toEqual(["approvals: PRD #2608 of acme/widgets's tech approval is given, but its approvers are not asked: reset"]);
  });
});

describe('techRepository', () => {
  it('calls the database as it names it, and parses what it answers', async () => {
    const calls: unknown[][] = [];
    const answers: Record<string, unknown> = {
      dossier_approval: { dossier: DOSSIER, approval: null },
      dossier_request_tech_approval: REQUESTED,
      workspace_roster: [{ user_id: IRISA, name: null, github_login: 'irisa-gh', avatar_url: null, fleet: null, hero: null }],
    };
    const chain = (table: string) => {
      const q: Record<string, unknown> = { then: (ok: (v: unknown) => unknown) => Promise.resolve({ data: [{ workspace_id: WORKSPACE }], error: null }).then(ok) };
      for (const verb of ['select', 'eq', 'limit']) q[verb] = (...args: unknown[]) => { calls.push([table, verb, ...args]); return q; };
      return q;
    };
    const db = {
      from: chain,
      rpc: (fn: string, args: unknown) => { calls.push([fn, args]); return Promise.resolve({ data: answers[fn], error: null }); },
    } as unknown as Parameters<typeof techRepository>[0];
    const repo = techRepository(db);
    expect(await repo.request(DOSSIER, 'irisa-gh')).toEqual({ ok: true, value: REQUESTED });
    expect(await repo.roster(WORKSPACE)).toEqual({ ok: true, value: [{ user_id: IRISA, name: null, github_login: 'irisa-gh' }] });
    expect(await repo.dossier('acme/widgets', parsePrd(2608))).toEqual({ ok: true, value: { dossier: DOSSIER } });
    expect(await repo.workspace(DOSSIER)).toEqual({ ok: true, value: [{ workspace_id: WORKSPACE }] });
    expect(calls).toContainEqual(['dossier_request_tech_approval', { p_dossier: DOSSIER, p_login: 'irisa-gh' }]);
    expect(calls).toContainEqual(['workspace_roster', { workspace: WORKSPACE }]);
    expect(calls).toContainEqual(['dossier_approval', { p_repo: 'acme/widgets', p_prd: 2608 }]);
    expect(calls).toContainEqual(['dossiers', 'eq', 'id', DOSSIER]);
  });
});

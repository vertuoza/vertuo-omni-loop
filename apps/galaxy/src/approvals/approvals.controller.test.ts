import { describe, expect, it } from 'vitest';
import { AskingSchema } from 'vertuo-omni-plan/kit/lib/approval/stream.ts';
import { parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { emailSender, type EmailLib } from '../notify/email';
import type { Channels } from '../notify/notify';
import { pushSender, type WebPushLib } from '../notify/push';
import { approvalsWaiting, requestApproval, type RequestDeps } from './approvals.controller';
import type { Answer, ApprovalsRepository, ReachRepository, Requested } from './approvals.repository';

// The approvals' edge and rules (PRD 1322 s2), against fake repositories and fake web-push and Resend:
//
//   POST /api/dossiers/approval/request {repo, prd}   asks the approvers, answers the kit's shape
//                                                     (settled item s4-01-approval-stream-contract)
//   GET  /api/waiting/approvals                        the bell's approval requests
//
// Who is asked is the database's (supabase/checks/approval_requests.sql); here, what the route makes of
// its answer: the reply, each asked person reached by their channels, a gone device forgotten, a
// missing key or service role skipped in the log, and each refusal in plain words.

const DOSSIER = '11111111-1111-4111-8111-111111111111';
const REQUEST = '22222222-2222-4222-8222-222222222222';
const IRISA = '00000000-0000-4000-8000-0000000000a4';
const PAUL = '00000000-0000-4000-8000-0000000000a5';
const ADA = { id: '00000000-0000-4000-8000-0000000000a2', email: 'ada@acme.test' };
const SPEC = [
  '---', 'prd: 7', 'phase0: server', '---', '', '# The approval handshake', '',
  '## Problem', '', 'Nobody is told a PRD waits. The agent stops and the run ends.', '',
  '## Solution', '', '### 1. Who approves', '', 'Each product lists its **approvers**, and each one is asked.', '',
  '## Decisions', '', '- Web Push plus email.',
].join('\n');

const REQUESTED: Requested = {
  id: REQUEST, dossier: DOSSIER, repo: 'acme/mobile', prd: parsePrd(7), title: 'The approval handshake', kind: 'asked',
  askedAt: '2026-10-09T10:00:00.000Z', product: 'Mobile', author: 'ada-gh', nobodyElse: false,
  asked: [{ user: IRISA, login: 'irisa-gh', name: 'IRISA' }, { user: PAUL, login: 'paul-gh', name: null }],
  files: [{ kind: 'spec', sha256: 'a'.repeat(64) }, { kind: 'plan', sha256: 'b'.repeat(64) }, { kind: 'before-after', sha256: 'c'.repeat(64) }],
  spec: SPEC,
};

const RECIPIENTS = [
  { user: IRISA, email: 'irisa@acme.test', devices: [{ id: '33333333-3333-4333-8333-333333333331', endpoint: 'https://push.example/irisa', p256dh: 'k', auth: 'a' }] },
  { user: PAUL, email: null, devices: [{ id: '33333333-3333-4333-8333-333333333332', endpoint: 'https://push.example/paul', p256dh: 'k', auth: 'a' }] },
];

type World = {
  database?: boolean;
  service?: boolean;
  keys?: { push: boolean; email: boolean };
  requested?: Answer<Requested>;
  recipients?: Answer<typeof RECIPIENTS>;
  gone?: string[];
};

function world({ database = true, service = true, keys = { push: true, email: true }, requested = { ok: true, value: REQUESTED }, recipients = { ok: true, value: RECIPIENTS }, gone = [] }: World = {}) {
  const asked: Array<{ repo: string; prd: number; as: string }> = [];
  const read: string[] = [];
  const forgotten: string[] = [];
  const pushes: Array<{ endpoint: string; payload: string; subject: string }> = [];
  const emails: Array<{ to: string; subject: string; text: string; html: string }> = [];
  const logs: string[] = [];
  const approvals = (as: string): ApprovalsRepository => ({
    request: (repo, prd) => { asked.push({ repo, prd, as }); return Promise.resolve(requested); },
    waiting: () => Promise.resolve({ ok: true, value: [] }),
  });
  const reach: ReachRepository = {
    recipients: (request) => { read.push(request); return Promise.resolve(recipients); },
    forget: (device) => { forgotten.push(device); return Promise.resolve(); },
  };
  const webpush: WebPushLib = {
    sendNotification(subscription, payload, options) {
      pushes.push({ endpoint: subscription.endpoint, payload, subject: options.vapidDetails.subject });
      return gone.includes(subscription.endpoint)
        ? Promise.reject(Object.assign(new Error('gone'), { statusCode: 410 }))
        : Promise.resolve({ statusCode: 201 });
    },
  };
  const resend: EmailLib = { emails: { send(payload) { emails.push(payload); return Promise.resolve({ error: null }); } } };
  const log = (line: string) => { logs.push(line); };
  const deps: RequestDeps = {
    connect: database
      ? (token) => ({
          auth: {
            getUser: (jwt: string) => Promise.resolve(jwt === 'ada-token'
              ? { data: { user: ADA }, error: null }
              : { data: { user: null }, error: { status: 401, message: 'bad jwt' } }),
          },
          approvals: approvals(`token:${token}`),
        })
      : null,
    reach: service ? reach : null,
    channels: (contact, forget): Channels => ({
      push: keys.push ? pushSender({ publicKey: 'BPub', privateKey: 'priv' }, contact, webpush, log) : null,
      email: keys.email ? emailSender('Omni Loop <approvals@omni.example>', resend, log) : null,
      forget,
    }),
    log,
  };
  const post = async (body: unknown, token: string | null = 'ada-token') => {
    const response = await requestApproval(new Request('https://omni.example/api/dossiers/approval/request', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }), deps);
    return { status: response.status, body: (await response.json()) as unknown, cache: response.headers.get('cache-control') };
  };
  return { asked, read, forgotten, pushes, emails, logs, post };
}

const PAYLOAD = {
  title: 'PRD 7 waits for your approval',
  body: 'The approval handshake\nNobody is told a PRD waits. → Each product lists its approvers, and each one is asked.',
  url: `/prd/${DOSSIER}`,
};

const REPLY = { asked: [{ login: 'irisa-gh', name: 'IRISA' }, { login: 'paul-gh', name: null }], nobodyElse: false, author: 'ada-gh', product: 'Mobile' };

describe('POST /api/dossiers/approval/request', () => {
  it('asks as the caller and answers who was asked, in the shape the kit reads, never cached', async () => {
    const w = world();
    const answer = await w.post({ repo: 'Acme/Mobile', prd: 7 });
    expect(answer).toEqual({ status: 200, body: REPLY, cache: 'no-store' });
    expect(AskingSchema.parse(answer.body)).toEqual(REPLY);
    expect(w.asked).toEqual([{ repo: 'acme/mobile', prd: 7, as: 'token:ada-token' }]);
    expect(w.read).toEqual([REQUEST]);
  });

  it('pushes each asked device and emails each address turned on, naming the PRD and opening its page', async () => {
    const w = world();
    await w.post({ repo: 'acme/mobile', prd: 7 });
    expect(w.pushes.map((p) => p.endpoint).sort()).toEqual(['https://push.example/irisa', 'https://push.example/paul']);
    expect(w.pushes.map((p) => p.subject)).toEqual(['https://omni.example', 'https://omni.example']);
    expect(w.pushes.map((p): unknown => JSON.parse(p.payload))).toEqual([PAYLOAD, PAYLOAD]);
    expect(w.emails.map(({ to, subject }) => ({ to, subject }))).toEqual([
      { to: 'irisa@acme.test', subject: 'PRD 7 waits for your approval: The approval handshake' },
    ]);
    const text = w.emails.map((e) => e.text).join('');
    const html = w.emails.map((e) => e.html).join('');
    expect(text).toContain('Problem\n\nNobody is told a PRD waits. The agent stops and the run ends.');
    expect(html).toContain('<h2>Problem</h2>');
    expect(text).toContain('Solution\n\n### 1. Who approves');
    expect(text).not.toContain('Web Push plus email');
    expect(text).toContain('acme/mobile · spec aaaaaaa · plan bbbbbbb · before-after ccccccc');
    expect(text).toContain(`Open it to approve: https://omni.example/prd/${DOSSIER}`);
    expect(html).toContain('<strong>approvers</strong>');
    expect(html).toContain(`<a href="https://omni.example/prd/${DOSSIER}">`);
    expect(w.logs).toEqual([]);
  });

  it('forgets a device its push service answers 410, and still answers who was asked', async () => {
    const w = world({ gone: ['https://push.example/paul'] });
    expect((await w.post({ repo: 'acme/mobile', prd: 7 })).status).toBe(200);
    expect(w.forgotten).toEqual(['33333333-3333-4333-8333-333333333332']);
  });

  it('skips a channel without keys with one log line, and the other still goes out', async () => {
    const w = world({ keys: { push: false, email: true } });
    expect((await w.post({ repo: 'acme/mobile', prd: 7 })).body).toEqual(REPLY);
    expect(w.pushes).toEqual([]);
    expect(w.emails).toHaveLength(1);
    expect(w.logs).toEqual(['notify: phone alerts skipped for 2 devices: VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are not set']);
  });

  it('records the request and reaches nobody without the service role, said in the log', async () => {
    const w = world({ service: false });
    expect((await w.post({ repo: 'acme/mobile', prd: 7 })).body).toEqual(REPLY);
    expect(w.pushes).toEqual([]);
    expect(w.emails).toEqual([]);
    expect(w.logs).toEqual(['approvals: PRD #7 of acme/mobile is asked, but nobody is reached: SUPABASE_SERVICE_ROLE_KEY is not set']);
  });

  it('still answers when who to reach cannot be read', async () => {
    const w = world({ recipients: { ok: false, refusal: { code: 'shape', message: 'approval_recipients() answered out of shape' } } });
    expect((await w.post({ repo: 'acme/mobile', prd: 7 })).status).toBe(200);
    expect(w.logs).toEqual(['approvals: who PRD #7 of acme/mobile reaches could not be read: approval_recipients() answered out of shape']);
  });

  it('answers nobodyElse with the author when the product has no other approver', async () => {
    const alone: Requested = { ...REQUESTED, nobodyElse: true, product: null, asked: [{ user: ADA.id, login: 'ada-gh', name: null }], spec: null };
    const w = world({ requested: { ok: true, value: alone } });
    const answer = await w.post({ repo: 'acme/loose', prd: 7 });
    expect(answer.body).toEqual({ asked: [{ login: 'ada-gh', name: null }], nobodyElse: true, author: 'ada-gh', product: null });
    expect(w.pushes.map((p): unknown => JSON.parse(p.payload))).toContainEqual({
      ...PAYLOAD, body: 'The approval handshake',
    });
  });

  it('answers 401 to a missing or refused sign-in, and asks nothing', async () => {
    for (const token of [null, 'stale-token']) {
      const w = world();
      const answer = await w.post({ repo: 'acme/mobile', prd: 7 }, token);
      expect(answer.status).toBe(401);
      expect(w.asked).toEqual([]);
    }
  });

  it('answers 400 to a malformed body', async () => {
    for (const body of ['not json', [], { repo: 'acme', prd: 7 }, { repo: 'acme/mobile', prd: 0 }, { repo: 'acme/mobile' }, `{"repo":"acme/mobile","prd":7,"x":"${'y'.repeat(5000)}"}`]) {
      const w = world();
      const answer = await w.post(body);
      expect(answer.status).toBe(400);
      expect(answer.body).toEqual({ error: 'The body must be a JSON object: {"repo": "owner/name", "prd": <number>}.' });
      expect(w.asked).toEqual([]);
    }
  });

  it("answers the database's refusals in plain words, and a 500 for anything else", async () => {
    const cases: Array<[string, string, number, string]> = [
      ['42501', 'Only a member of the workspace that owns acme/mobile asks.', 403, 'Only a member of the workspace that owns acme/mobile asks.'],
      ['P0002', 'No dossier for PRD #7 of acme/mobile.', 404, 'No dossier for PRD #7 of acme/mobile.'],
      ['22023', 'PRD #7 was born in the repository.', 400, 'PRD #7 was born in the repository.'],
      ['shape', 'approval_request() answered out of shape', 500, 'The approvers could not be asked. Try again.'],
    ];
    for (const [code, message, status, error] of cases) {
      const w = world({ requested: { ok: false, refusal: { code, message } } });
      expect(await w.post({ repo: 'acme/mobile', prd: 7 })).toEqual({ status, body: { error }, cache: 'no-store' });
      expect(w.pushes).toEqual([]);
    }
  });

  it('answers 503 where no database is configured', async () => {
    expect((await world({ database: false }).post({ repo: 'acme/mobile', prd: 7 })).status).toBe(503);
  });
});

describe('GET /api/waiting/approvals', () => {
  const approvals = (answer: Awaited<ReturnType<ApprovalsRepository['waiting']>>): ApprovalsRepository => ({
    request: () => Promise.reject(new Error('not asked here')),
    waiting: () => Promise.resolve(answer),
  });

  it("lists the requests waiting on the person, each with its PRD's dossier", async () => {
    const row = { id: REQUEST, dossier: DOSSIER, repo: 'acme/mobile', prd: parsePrd(7), title: 'The approval handshake', askedAt: '2026-10-09T10:00:00.000Z' };
    const response = await approvalsWaiting({ session: () => Promise.resolve(approvals({ ok: true, value: [row] })) });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      items: [{ id: REQUEST, dossierId: DOSSIER, prd: 7, title: 'The approval handshake', repo: 'acme/mobile', askedAt: Date.parse('2026-10-09T10:00:00.000Z') }],
    });
  });

  it('answers 401 signed out, 503 without a database, 500 when the read fails', async () => {
    expect((await approvalsWaiting({ session: () => Promise.resolve(null) })).status).toBe(401);
    expect((await approvalsWaiting({ session: null })).status).toBe(503);
    const failed = await approvalsWaiting({ session: () => Promise.resolve(approvals({ ok: false, refusal: { code: 'XX000', message: 'boom' } })) });
    expect(failed.status).toBe(500);
    expect(await failed.json()).toEqual({ error: 'The approval requests could not be read. Try again.' });
  });
});

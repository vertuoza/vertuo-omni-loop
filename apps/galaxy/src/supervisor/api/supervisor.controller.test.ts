import { describe, expect, it } from 'vitest';
import type { TokenCheck } from '../../ask/auth';
import { appErrorWriter, type AppErrorRow } from '../../server-event/app-errors';
import type { Message, Recipient } from '../../notify/notify';
import {
  supervisorFindings, supervisorForget, supervisorLines, supervisorMemory, supervisorMessages, supervisorNext, supervisorRaise, supervisorRemember,
  supervisorSay, supervisorSeat, supervisorSeatPost, supervisorSeatSet, supervisorSnapshot, type SupervisorDeps,
} from './supervisor.controller';
import { SUPERVISOR_NEXT_HOLD_MS } from './supervisor.contract';
import type { SupervisorActs } from './supervisor.repository';
import { supervisorService, DISMISSED_SAME } from './supervisor.service';
import { ACME, ATLAS, EVE, EVE_BOX, EVE_JOB, fakeStore, GLOBEX, JOB, MO, OLGA, signalRow, SPARE, T0, world, type World } from './supervisor.fake';

// The Supervisor's routes (PRD omni-loop-34 s3), with the real service on the fake store: the seat is the owner of the
// runner that holds its workspace's seat, by the kit's sign-in, and reads and writes that workspace only; a person reads
// a workspace they are a member of; an owner's acts are the database's to check; a high finding alerts each owner once;
// a failure is 500, recorded masked in app_errors.

const TOKENS: Record<string, string> = { 'olga-token': OLGA, 'mo-token': MO, 'eve-token': EVE };

const connect = (): TokenCheck => ({
  auth: {
    getUser: (jwt: string) => {
      const user = TOKENS[jwt];
      return Promise.resolve(user ? { data: { user: { id: user, email: null } }, error: null } : { data: { user: null }, error: { status: 401 } });
    },
  },
});

type Sent = { recipients: readonly Recipient[]; message: Message };

/** A fake clock: `sleep` moves time on. */
function fakeClock(start = T0) {
  let at = new Date(start).getTime();
  return { now: () => new Date(at), sleep: (ms: number) => { at += ms; return Promise.resolve(); }, advance: (ms: number) => { at += ms; } };
}

const refusedActs: SupervisorActs = {
  place: () => Promise.resolve({ ok: false, refusal: 'forbidden', error: 'Only an owner of the workspace acts on its Supervisor.' }),
  set: () => Promise.resolve({ ok: false, refusal: 'forbidden', error: 'Only an owner of the workspace acts on its Supervisor.' }),
  say: () => Promise.resolve({ ok: false, refusal: 'forbidden', error: 'Only an owner of the workspace acts on its Supervisor.' }),
  deleteNote: () => Promise.resolve({ ok: false, refusal: 'forbidden', error: 'Only an owner of the workspace acts on its Supervisor.' }),
  clear: () => Promise.resolve({ ok: false, refusal: 'forbidden', error: 'Only an owner of the workspace acts on its Supervisor.' }),
};

function setup({ w = world(), viewer = OLGA, acts = refusedActs, fail = { error: null } }: { w?: World; viewer?: string | null; acts?: SupervisorActs; fail?: { error: Error | null } } = {}) {
  const clock = fakeClock();
  const sent: Sent[] = [];
  const errors: AppErrorRow[] = [];
  const logs: string[] = [];
  const deps: SupervisorDeps = {
    connect,
    session: () => Promise.resolve(viewer),
    service: supervisorService({ store: fakeStore(w, () => clock.now().toISOString(), fail), clock, alert: (recipients, message) => { sent.push({ recipients, message }); return Promise.resolve(); } }),
    acts: () => Promise.resolve(acts),
    log: (line) => { logs.push(line); },
    failed: appErrorWriter({ write: (row) => { errors.push(row); return Promise.resolve(); } }, (line) => { logs.push(line); }),
  };
  return { deps, w, sent, errors, logs, clock };
}

const seatGet = (path: string, token = 'olga-token') => new Request(`https://omni.example.test${path}`, { headers: { authorization: `Bearer ${token}` } });
const seatPost = (path: string, body: unknown, token = 'olga-token') =>
  new Request(`https://omni.example.test${path}`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
const page = (path: string, init: RequestInit = {}) => new Request(`https://omni.example.test${path}`, init);
const json = async (response: Response): Promise<Record<string, unknown>> => (await response.json()) as Record<string, unknown>;

const RAISE = { kind: 'stuck', severity: 'high', title: 'A job went silent', explanation: 'The runner beats but the job writes nothing.' };

describe('who the seat is', () => {
  it('answers 401 to no sign-in, and nothing else runs', async () => {
    const { deps } = setup();
    const response = await supervisorSnapshot(seatGet(`/api/supervisor/snapshot?runner=${ATLAS}`, 'nobody'), deps);
    expect(response.status).toBe(401);
  });

  it('refuses a runner that holds no seat, and another person\'s runner', async () => {
    const { deps } = setup();
    expect((await supervisorSnapshot(seatGet(`/api/supervisor/snapshot?runner=${SPARE}`), deps)).status).toBe(403);
    expect((await supervisorSnapshot(seatGet(`/api/supervisor/snapshot?runner=${EVE_BOX}`), deps)).status).toBe(403);
    expect((await supervisorSnapshot(seatGet('/api/supervisor/snapshot'), deps)).status).toBe(400);
  });

  it('refuses a runner key of another workspace on every route', async () => {
    const { deps } = setup();
    const at = `runner=${ATLAS}`;
    const answers = await Promise.all([
      supervisorNext(seatGet(`/api/supervisor/next?${at}`, 'eve-token'), deps),
      supervisorSnapshot(seatGet(`/api/supervisor/snapshot?${at}`, 'eve-token'), deps),
      supervisorLines(seatGet(`/api/supervisor/lines?${at}&job=${JOB}`, 'eve-token'), deps),
      supervisorFindings(seatGet(`/api/supervisor/findings?${at}`, 'eve-token'), deps),
      supervisorRaise(seatPost(`/api/supervisor/findings?${at}`, RAISE, 'eve-token'), deps),
      supervisorMemory(seatGet(`/api/supervisor/memory?${at}`, 'eve-token'), deps),
      supervisorRemember(seatPost(`/api/supervisor/memory?${at}`, { scope: 'short', line: 'x', cites: [JOB] }, 'eve-token'), deps),
      supervisorMessages(seatGet(`/api/supervisor/messages?${at}`, 'eve-token'), deps),
      supervisorSay(seatPost(`/api/supervisor/messages?${at}`, { body: 'hello' }, 'eve-token'), deps),
      supervisorSeat(seatGet(`/api/supervisor/seat?${at}`, 'eve-token'), deps),
      supervisorSeatPost(seatPost(`/api/supervisor/seat?${at}`, { tokens: 1 }, 'eve-token'), deps),
    ]);
    expect(answers.map((r) => r.status)).toEqual(Array.from({ length: 11 }, () => 403));
  });

  it('reads an id of another workspace as none', async () => {
    const { deps } = setup();
    const response = await supervisorLines(seatGet(`/api/supervisor/lines?runner=${ATLAS}&job=${EVE_JOB}`), deps);
    expect(response.status).toBe(404);
  });

  it('keeps the seat\'s routes from a person\'s session', async () => {
    const { deps } = setup();
    expect((await supervisorSnapshot(page(`/api/supervisor/snapshot?runner=${ATLAS}`), deps)).status).toBe(403);
    expect((await supervisorRaise(page(`/api/supervisor/findings?runner=${ATLAS}`, { method: 'POST', body: JSON.stringify(RAISE) }), deps)).status).toBe(403);
  });
});

describe('next', () => {
  it('answers at once on a new signal, and counts as the seat\'s look', async () => {
    const w = world({ signals: [signalRow({ opened_at: '2026-11-25T10:00:05.000Z' })] });
    const { deps, clock } = setup({ w });
    const response = await supervisorNext(seatGet(`/api/supervisor/next?runner=${ATLAS}&since=${T0}`), deps);
    expect(response.status).toBe(200);
    expect(await json(response)).toMatchObject({ wake: { signals: 1, messages: 0, presses: 0 }, seat: { runner: ATLAS, thinking: true } });
    expect(clock.now().toISOString()).toBe(T0);
    expect(w.seats[0]).toMatchObject({ last_look_at: T0, missed_looks: 0 });
  });

  it('answers at once on an owner\'s message or a pressed suggestion', async () => {
    const w = world({
      messages: [{ id: 'm1', workspace_id: ACME, finding_id: null, kind: 'owner', author_login: 'olga', body: 'why?', reply_to: null, remembered: null, created_at: '2026-11-25T10:00:01.000Z' }],
    });
    const { deps } = setup({ w });
    expect(await json(await supervisorNext(seatGet(`/api/supervisor/next?runner=${ATLAS}&since=${T0}`), deps))).toMatchObject({ wake: { messages: 1 } });
  });

  it('holds 40 s and answers 204 when nothing came, and never wakes on another workspace', async () => {
    const w = world({ signals: [signalRow({ workspace_id: GLOBEX, opened_at: '2026-11-25T10:00:05.000Z' })] });
    const { deps, clock } = setup({ w });
    const response = await supervisorNext(seatGet(`/api/supervisor/next?runner=${ATLAS}&since=${T0}`), deps);
    expect(response.status).toBe(204);
    const held = clock.now().getTime() - new Date(T0).getTime();
    expect(held).toBeLessThanOrEqual(SUPERVISOR_NEXT_HOLD_MS);
    expect(held).toBeGreaterThanOrEqual(SUPERVISOR_NEXT_HOLD_MS - 2_000);
  });

  it('refuses a `since` out of shape', async () => {
    const { deps } = setup();
    expect((await supervisorNext(seatGet(`/api/supervisor/next?runner=${ATLAS}&since=yesterday`), deps)).status).toBe(400);
  });
});

describe('raising a finding', () => {
  it('writes the check that fired with its figures first, from its signal', async () => {
    const signal = signalRow();
    const w = world({ signals: [signal] });
    const { deps } = setup({ w });
    const response = await supervisorRaise(seatPost(`/api/supervisor/findings?runner=${ATLAS}`, {
      ...RAISE, signals: [signal.id], suggestions: [{ action: 'stop-resume-job', label: 'Stop and resume the job', target: { job: JOB } }],
    }), deps);
    expect(response.status).toBe(200);
    const body = await json(response);
    expect(body).toMatchObject({
      raised: true,
      finding: { checkLine: 'Silent job: no line for 52 min, 3× the 2.5 min usual', figures: { minutes: 52 }, fingerprint: `stuck:silent:${JOB}`, raisedBy: 'supervisor', lookedAt: T0 },
    });
    expect((body.finding as { proposals: unknown[] }).proposals).toEqual([expect.objectContaining({ kind: 'suggestion', action: 'stop-resume-job' })]);
    expect(w.signals[0]?.finding_id).toBe((body.finding as { id: string }).id);
  });

  it('raises a finding with no check behind it with no check line', async () => {
    const { deps } = setup();
    expect(await json(await supervisorRaise(seatPost(`/api/supervisor/findings?runner=${ATLAS}`, { ...RAISE, severity: 'medium' }), deps)))
      .toMatchObject({ raised: true, finding: { checkLine: null } });
  });

  it('adds a second signal of the fingerprint to the open finding, and gives a finding the check wrote alone its first look', async () => {
    const first = signalRow();
    const w = world({ signals: [first] });
    w.findings.push({
      id: 'f-check', workspace_id: ACME, fingerprint: first.fingerprint, kind: 'stuck', severity: 'medium', title: 'Silent job', check_line: first.check_line,
      figures: {}, evidence: [], evidence_key: 'k1', explanation: null, raised_by: 'check', looked_at: null, state: 'open', notified_at: null, created_at: T0, closed_at: null,
    });
    const { deps } = setup({ w });
    const body = await json(await supervisorRaise(seatPost(`/api/supervisor/findings?runner=${ATLAS}`, { ...RAISE, severity: 'medium', signals: [first.id] }), deps));
    expect(body).toMatchObject({ raised: false, finding: { id: 'f-check', explanation: RAISE.explanation, lookedAt: T0 } });
    expect(w.findings).toHaveLength(1);
  });

  it('never raises again a fingerprint an owner dismissed with the same evidence', async () => {
    const signal = signalRow();
    const w = world({ signals: [signal] });
    w.findings.push({
      id: 'f-gone', workspace_id: ACME, fingerprint: signal.fingerprint, kind: 'stuck', severity: 'high', title: 'Silent job', check_line: signal.check_line,
      figures: {}, evidence: [], evidence_key: 'k1', explanation: 'x', raised_by: 'supervisor', looked_at: T0, state: 'dismissed', notified_at: T0, created_at: T0, closed_at: T0,
    });
    const { deps, sent } = setup({ w });
    const response = await supervisorRaise(seatPost(`/api/supervisor/findings?runner=${ATLAS}`, { ...RAISE, signals: [signal.id] }), deps);
    expect(response.status).toBe(409);
    expect(await json(response)).toEqual({ error: DISMISSED_SAME });
    expect(sent).toEqual([]);
  });

  it('refuses a signal of another workspace, and a body out of shape', async () => {
    const theirs = signalRow({ workspace_id: GLOBEX });
    const { deps } = setup({ w: world({ signals: [theirs] }) });
    expect((await supervisorRaise(seatPost(`/api/supervisor/findings?runner=${ATLAS}`, { ...RAISE, signals: [theirs.id] }), deps)).status).toBe(400);
    expect((await supervisorRaise(seatPost(`/api/supervisor/findings?runner=${ATLAS}`, { ...RAISE, suggestions: [{ action: 'merge', label: 'Merge it', target: {} }] }), deps)).status).toBe(400);
    expect((await supervisorRaise(seatPost(`/api/supervisor/findings?runner=${ATLAS}`, { ...RAISE, title: 'two\nlines' }), deps)).status).toBe(400);
  });

  it('masks the secrets in its evidence and explanation', async () => {
    const { deps, w } = setup();
    const token = `ghp_${'a'.repeat(36)}`;
    await supervisorRaise(seatPost(`/api/supervisor/findings?runner=${ATLAS}`, { ...RAISE, explanation: `it printed ${token}`, evidence: [{ line: `token=${token}` }] }), deps);
    expect(JSON.stringify(w.findings)).not.toContain(token);
  });
});

describe('alerts', () => {
  it('sends one push and one email to each owner for a high finding, once', async () => {
    const signal = signalRow();
    const { deps, sent } = setup({ w: world({ signals: [signal] }) });
    const first = await json(await supervisorRaise(seatPost(`/api/supervisor/findings?runner=${ATLAS}`, { ...RAISE, signals: [signal.id] }), deps));
    expect(first.notified).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.recipients).toEqual([expect.objectContaining({ user: OLGA, email: 'olga@example.test' })]);
    expect(JSON.parse(sent[0]?.message.push ?? '{}')).toMatchObject({ title: 'Supervisor · A job went silent', body: 'Silent job: no line for 52 min, 3× the 2.5 min usual' });
    expect(sent[0]?.message.email.text).toContain('Sent by the Supervisor, an agent.');
    const again = await json(await supervisorRaise(seatPost(`/api/supervisor/findings?runner=${ATLAS}`, { ...RAISE, signals: [signal.id] }), deps));
    expect(again).toMatchObject({ raised: false, notified: false });
    expect(sent).toHaveLength(1);
  });

  it('sends none for a medium finding', async () => {
    const { deps, sent } = setup();
    await supervisorRaise(seatPost(`/api/supervisor/findings?runner=${ATLAS}`, { ...RAISE, severity: 'medium' }), deps);
    expect(sent).toEqual([]);
  });
});

describe('a person reads', () => {
  it('reads the findings of a workspace they are a member of', async () => {
    const { deps } = setup({ viewer: MO });
    await supervisorRaise(seatPost(`/api/supervisor/findings?runner=${ATLAS}`, RAISE), deps);
    const body = await json(await supervisorFindings(page(`/api/supervisor/findings?workspace=${ACME}`), deps));
    expect(body.findings).toHaveLength(1);
    expect(await json(await supervisorFindings(page(`/api/supervisor/findings?workspace=${ACME}&state=done`), deps))).toEqual({ findings: [] });
  });

  it('refuses a workspace they are not a member of, and no sign-in', async () => {
    expect((await supervisorFindings(page(`/api/supervisor/findings?workspace=${GLOBEX}`), setup({ viewer: MO }).deps)).status).toBe(403);
    expect((await supervisorMemory(page(`/api/supervisor/memory?workspace=${ACME}`), setup({ viewer: null }).deps)).status).toBe(401);
    expect((await supervisorSeat(page('/api/supervisor/seat'), setup().deps)).status).toBe(400);
  });

  it('reads the seat, its tokens of the day and whether it thinks', async () => {
    const { deps } = setup();
    expect(await json(await supervisorSeat(page(`/api/supervisor/seat?workspace=${ACME}`), deps))).toMatchObject({ seat: { runner: ATLAS, dailyTokens: 5_000_000, tokensToday: 0, thinking: true } });
  });
});

describe('memory and threads', () => {
  it('lets the seat write a note and read it back', async () => {
    const { deps } = setup();
    const written = await supervisorRemember(seatPost(`/api/supervisor/memory?runner=${ATLAS}`, { scope: 'long', line: 'The yolo step usually takes 2.5 min.', cites: [JOB] }), deps);
    expect(written.status).toBe(200);
    expect(await json(await supervisorMemory(seatGet(`/api/supervisor/memory?runner=${ATLAS}&scope=long`), deps))).toMatchObject({ notes: [{ scope: 'long', line: 'The yolo step usually takes 2.5 min.' }] });
    expect((await supervisorRemember(seatPost(`/api/supervisor/memory?runner=${ATLAS}`, { scope: 'long', line: 'no cites', cites: [] }), deps)).status).toBe(400);
  });

  it('answers in a thread as the Supervisor, and refuses a finding of another workspace', async () => {
    const { deps } = setup();
    const answer = await json(await supervisorSay(seatPost(`/api/supervisor/messages?runner=${ATLAS}`, { body: 'It is waiting on a runner.', remembered: 'atlas-01 runs the long jobs.' }), deps));
    expect(answer).toMatchObject({ message: { kind: 'supervisor', by: null, finding: null, remembered: 'atlas-01 runs the long jobs.' } });
    expect((await supervisorSay(seatPost(`/api/supervisor/messages?runner=${ATLAS}`, { body: 'x', finding: EVE_JOB }), deps)).status).toBe(404);
    expect(await json(await supervisorMessages(page(`/api/supervisor/messages?workspace=${ACME}`), deps))).toMatchObject({ messages: [{ body: 'It is waiting on a runner.' }] });
  });

  it('passes an owner\'s act to the database, and answers its refusal of a member with 403', async () => {
    const { deps } = setup({ viewer: MO });
    expect((await supervisorForget(page(`/api/supervisor/memory?workspace=${ACME}&scope=all`, { method: 'DELETE' }), deps)).status).toBe(403);
    expect((await supervisorSay(page('/api/supervisor/messages', { method: 'POST', body: JSON.stringify({ workspace: ACME, text: 'hi' }) }), deps)).status).toBe(403);
    expect((await supervisorSeatSet(page('/api/supervisor/seat', { method: 'PATCH', body: JSON.stringify({ workspace: ACME, paused: true }) }), deps)).status).toBe(403);
    expect((await supervisorSeatPost(page('/api/supervisor/seat', { method: 'POST', body: JSON.stringify({ workspace: ACME, runner: SPARE }) }), deps)).status).toBe(403);
  });

  it('answers an owner\'s clear with how many notes went', async () => {
    const calls: unknown[] = [];
    const acts: SupervisorActs = { ...refusedActs, clear: (workspace, scope) => { calls.push([workspace, scope]); return Promise.resolve({ ok: true, value: 9 }); } };
    const { deps } = setup({ acts });
    expect(await json(await supervisorForget(page(`/api/supervisor/memory?workspace=${ACME}&scope=all`, { method: 'DELETE' }), deps))).toEqual({ cleared: 9 });
    expect(calls).toEqual([[ACME, 'all']]);
    expect((await supervisorForget(page(`/api/supervisor/memory?workspace=${ACME}&scope=everything`, { method: 'DELETE' }), deps)).status).toBe(400);
  });
});

describe('the seat\'s tokens', () => {
  it('counts them by day, and stops thinking past the daily limit', async () => {
    const w: World = world();
    w.seats[0] = { ...(w.seats[0] as World['seats'][number]), daily_tokens: 1000, tokens_day: '2026-11-25', tokens_used: 900 };
    const { deps } = setup({ w });
    expect(await json(await supervisorSeatPost(seatPost(`/api/supervisor/seat?runner=${ATLAS}`, { tokens: 150 }), deps))).toMatchObject({ seat: { tokensToday: 1050, thinking: false } });
    w.seats[0] = { ...w.seats[0], tokens_day: '2026-11-24' };
    expect(await json(await supervisorSeatPost(seatPost(`/api/supervisor/seat?runner=${ATLAS}`, { tokens: 10 }), deps))).toMatchObject({ seat: { tokensToday: 10, thinking: true } });
  });
});

describe('a job\'s lines', () => {
  it('answers them masked', async () => {
    const secret = `sk-${'b'.repeat(30)}`;
    const w = world({ lines: [{ job: JOB, seq: 1, text: `calling with ${secret}`, at: T0 }, { job: JOB, seq: 2, text: 'done', at: T0 }] });
    const { deps } = setup({ w });
    const body = await json(await supervisorLines(seatGet(`/api/supervisor/lines?runner=${ATLAS}&job=${JOB}&after=0`), deps));
    expect(body).toEqual({ lines: [{ seq: 1, text: 'calling with [masked]', at: T0 }, { seq: 2, text: 'done', at: T0 }] });
  });
});

describe('the App\'s errors', () => {
  it('AC-9: a galaxy route answering 500 writes one app_errors row with the route and status, the token masked', async () => {
    const token = `ghp_${'c'.repeat(36)}`;
    const { deps, errors } = setup({ fail: { error: new Error(`the database refused the key ${token}`) } });
    const response = await supervisorSnapshot(seatGet(`/api/supervisor/snapshot?runner=${ATLAS}`), deps);
    expect(response.status).toBe(500);
    expect(await json(response)).toEqual({ error: 'The Supervisor could not answer. Try again.' });
    expect(errors).toEqual([{ workspace_id: null, service: 'galaxy', route: 'GET /api/supervisor/snapshot', status: 500, message: 'the database refused the key [masked]' }]);
  });

  it('answers 503 with no service role, and writes nothing', async () => {
    const { deps, errors } = setup();
    const response = await supervisorFindings(page(`/api/supervisor/findings?workspace=${ACME}`), { ...deps, service: null });
    expect(response.status).toBe(503);
    expect(errors).toEqual([]);
  });
});

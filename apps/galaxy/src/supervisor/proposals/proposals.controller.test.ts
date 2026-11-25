import { describe, expect, it } from 'vitest';
import { appErrorWriter, type AppErrorRow } from '../../server-event/app-errors';
import type { FindingRow, ProposalRow as StoredProposal } from '../api/supervisor.repository';
import { ACME, ATLAS, fakeStore, GLOBEX, MO, OLGA, signalRow, T0, world, type World } from '../api/supervisor.fake';
import { supervisorService } from '../api/supervisor.service';
import { RESUME_QUEUED } from './proposals.contract';
import { supervisorDismiss, supervisorPress, type ProposalsDeps } from './proposals.controller';
import { fakeActs, fakeProposalsStore, type Rest } from './proposals.fake';
import { proposalsService, type Called, type Carry } from './proposals.service';

// An owner's press of a Supervisor suggestion and their Not a problem (PRD omni-loop-34 s7), with the real service on
// the fake store and the routes of today stubbed: only an owner acts, the press goes through today's routes as that
// owner, a suggestion that no longer applies is refused with its reason and its finding closes, every press ends with
// one result in the finding's thread, and a dismissal is never raised again with the same evidence. No database, no
// GitHub.

const JOB = '00000000-0000-4000-8000-0000000000e1';
const RESUME = '00000000-0000-4000-8000-0000000000e2';
const NEW_JOB = '00000000-0000-4000-8000-0000000000e3';
const MISSION = '00000000-0000-4000-8000-0000000000f1';
const FINDING = '00000000-0000-4000-8000-0000000000aa';
const FOREIGN_FINDING = '00000000-0000-4000-8000-0000000000ab';
const SUGGESTION = '00000000-0000-4000-8000-0000000000ba';
const FINGERPRINT = 'a'.repeat(64);

const LOGINS: Record<string, string> = { [OLGA]: 'olga', [MO]: 'mo' };

const finding = (change: Partial<FindingRow> = {}): FindingRow => ({
  id: FINDING, workspace_id: ACME, fingerprint: `stuck:silent:${JOB}`, kind: 'stuck', severity: 'high', title: 'PRD 7’s job silent for 52 min',
  check_line: 'Silent job: no line for 52 min, 3× the 2.5 min usual', figures: {}, evidence: [], evidence_key: 'k1', explanation: 'Alive, but not moving.',
  raised_by: 'supervisor', looked_at: T0, state: 'open', notified_at: T0, created_at: T0, closed_at: null, ...change,
});

const suggestion = (action: StoredProposal['action'], target: Record<string, unknown>, change: Partial<StoredProposal> = {}): StoredProposal => ({
  id: SUGGESTION, finding_id: FINDING, kind: 'suggestion', action, label: 'Stop and resume the job', target, reply_to: null, author_login: null,
  outcome: null, note: null, evidence_key: null, created_at: T0, ...change,
});

const runningJob = { id: JOB, workspace_id: ACME, line: '/omni:yolo 7', repo: 'acme/widgets', status: 'running', cancel_requested: false, to_runner: ATLAS, to_fleet: null, resumes: null };

type Calls = { cancelled: string[]; sent: { line: string; repo: string; target: unknown }[]; moved: string[]; woken: string[] };

function setup({ proposals = [suggestion('stop-resume-job', { job: JOB })], rest = {}, viewer = OLGA, carry = {} }: {
  proposals?: StoredProposal[]; rest?: Partial<Rest>; viewer?: string | null; carry?: Partial<Carry>;
} = {}) {
  const w: World = world({ findings: [finding(), finding({ id: FOREIGN_FINDING, workspace_id: GLOBEX })], proposals });
  const all: Rest = { jobs: [runningJob], missions: [{ id: MISSION, workspace_id: ACME }], ledger: [], ...rest };
  const calls: Calls = { cancelled: [], sent: [], moved: [], woken: [] };
  const now = () => '2026-11-25T11:00:00.000Z';
  const stubs: Carry = {
    cancelJob: (job) => { calls.cancelled.push(job); return Promise.resolve({ ok: true, value: null }); },
    sendJob: (send) => { calls.sent.push(send); return Promise.resolve({ ok: true, value: { id: NEW_JOB } }); },
    moveMission: (action, mission) => { calls.moved.push(`${action} ${mission}`); return Promise.resolve({ ok: true, value: null }); },
    wakeMission: (mission) => { calls.woken.push(mission); return Promise.resolve(true); },
    ...carry,
  };
  const errors: AppErrorRow[] = [];
  const deps: ProposalsDeps = {
    session: () => Promise.resolve(viewer),
    service: proposalsService({ store: fakeProposalsStore(w, all, now), carry: stubs, clock: { now: () => new Date(now()) } }),
    acts: () => Promise.resolve(fakeActs(w, viewer ?? '', LOGINS[viewer ?? ''] ?? 'someone', now)),
    log: () => undefined,
    failed: appErrorWriter({ write: (row) => { errors.push(row); return Promise.resolve(); } }, () => undefined),
  };
  return { w, rest: all, calls, deps, errors };
}

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`https://omni.example.test${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
const press = (body: unknown = { workspace: ACME, proposal: SUGGESTION }) => post('/api/supervisor/proposals', body);
const json = async (response: Response): Promise<Record<string, unknown>> => (await response.json()) as Record<string, unknown>;
const results = (w: World) => w.proposals.filter((p) => p.kind === 'result');
const thread = (w: World) => w.messages.filter((m) => m.finding_id === FINDING).map((m) => m.body);

describe('who presses', () => {
  it('AC-3: refuses a member\'s press and changes nothing; an owner\'s press stops and resumes the job through today\'s routes, the result in the thread', async () => {
    const member = setup({ viewer: MO });
    const refused = await supervisorPress(press(), member.deps);
    expect(refused.status).toBe(403);
    expect(member.w.proposals).toHaveLength(1);
    expect(member.calls).toEqual({ cancelled: [], sent: [], moved: [], woken: [] });
    expect(member.w.findings[0]?.state).toBe('open');

    const owner = setup();
    const response = await supervisorPress(press(), owner.deps);
    expect(response.status).toBe(200);
    expect((await json(response)).press).toMatchObject({ action: 'stop-resume-job', outcome: 'done', by: 'olga', finding: { id: FINDING, state: 'acted' } });
    expect(owner.calls.cancelled).toEqual([JOB]);
    expect(owner.calls.sent).toEqual([{ line: '/omni:yolo 7', repo: 'acme/widgets', target: { kind: 'runner', runner: ATLAS } }]);
    expect(owner.w.proposals.filter((p) => p.kind === 'press').map((p) => p.author_login)).toEqual(['olga']);
    expect(results(owner.w).map((p) => p.outcome)).toEqual(['done']);
    expect(thread(owner.w)).toEqual(['olga pressed “Stop and resume the job”. Done: Stopped job 00000000 and sent it again as job 00000000.']);
  });

  it('answers 401 signed out and refuses a bearer header: the seat proposes, owners press', async () => {
    const { deps } = setup({ viewer: null });
    expect((await supervisorPress(press(), deps)).status).toBe(401);
    const seat = setup();
    expect((await supervisorPress(post('/api/supervisor/proposals', { workspace: ACME, proposal: SUGGESTION }, { authorization: 'Bearer t' }), seat.deps)).status).toBe(403);
    expect(seat.calls.cancelled).toEqual([]);
  });

  it('refuses a body out of shape, and a suggestion of another workspace', async () => {
    const { deps } = setup();
    expect((await supervisorPress(press({ workspace: ACME }), deps)).status).toBe(400);
    expect((await supervisorPress(press({ workspace: GLOBEX, proposal: SUGGESTION }), deps)).status).toBe(403);
    const foreign = setup({ proposals: [suggestion('stop-resume-job', { job: JOB }, { finding_id: FOREIGN_FINDING })] });
    expect((await supervisorPress(press(), foreign.deps)).status).toBe(404);
  });

  it('carries a suggestion out once: a second press answers the first result', async () => {
    const { deps, calls, w } = setup();
    await supervisorPress(press(), deps);
    const again = await supervisorPress(press(), deps);
    expect(again.status).toBe(200);
    expect((await json(again)).press).toMatchObject({ outcome: 'done', by: 'olga' });
    expect(calls.cancelled).toHaveLength(1);
    expect(results(w)).toHaveLength(1);
  });
});

describe('a suggestion that no longer applies', () => {
  it('AC-4: refuses Stop and resume on a job whose automatic resume exists, and the finding closes', async () => {
    const lost = { ...runningJob, status: 'failed' };
    const { deps, calls, w } = setup({ rest: { jobs: [lost, { ...runningJob, id: RESUME, status: 'queued', resumes: JOB }] } });
    const response = await supervisorPress(press(), deps);
    expect(response.status).toBe(200);
    expect((await json(response)).press).toMatchObject({ outcome: 'refused', note: RESUME_QUEUED, finding: { state: 'resolved' } });
    expect(calls.cancelled).toEqual([]);
    expect(calls.sent).toEqual([]);
    expect(thread(w)).toEqual([`olga pressed “Stop and resume the job”. Refused: ${RESUME_QUEUED}`]);
  });

  it('refuses a job that ended, one already asked to stop, and one gone', async () => {
    for (const [jobs, words] of [
      [[{ ...runningJob, status: 'done' }], 'The job ended already'],
      [[{ ...runningJob, cancel_requested: true }], 'Someone asked this job to stop already'],
      [[], 'The job is no longer in this workspace'],
    ] as const) {
      const { deps, calls, w } = setup({ rest: { jobs: [...jobs] } });
      const body = await json(await supervisorPress(press(), deps));
      expect(body.press).toMatchObject({ outcome: 'refused', finding: { state: 'resolved' } });
      expect((body.press as { note: string }).note).toContain(words);
      expect(calls.cancelled).toEqual([]);
      expect(results(w)).toHaveLength(1);
    }
  });

  it('keeps the finding open when the App could not answer, and says what was done', async () => {
    const failing: Called<{ id: string }> = { ok: false, status: 500, error: 'The runners could not answer. Try again.' };
    const { deps, w } = setup({ carry: { sendJob: () => Promise.resolve(failing) } });
    const body = await json(await supervisorPress(press(), deps));
    expect(body.press).toMatchObject({ outcome: 'failed', finding: { state: 'open' } });
    expect(thread(w)[0]).toContain('Stopped job 00000000, but sending it again was refused: The runners could not answer.');
  });

  it('closes the finding when today\'s route refuses the move in its words', async () => {
    const { deps } = setup({
      proposals: [suggestion('pause-mission', { mission: MISSION }, { label: 'Pause the mission' })],
      carry: { moveMission: () => Promise.resolve({ ok: false, status: 409, error: 'Only a running or waiting mission pauses.' }) },
    });
    expect((await json(await supervisorPress(press(), deps))).press).toMatchObject({ outcome: 'refused', note: 'Only a running or waiting mission pauses.', finding: { state: 'resolved' } });
  });
});

describe('each action, through what the App already does', () => {
  it('pauses, resumes and wakes a mission of the workspace only', async () => {
    for (const [action, call] of [['pause-mission', `pause ${MISSION}`], ['resume-mission', `resume ${MISSION}`]] as const) {
      const { deps, calls } = setup({ proposals: [suggestion(action, { mission: MISSION })] });
      expect((await json(await supervisorPress(press(), deps))).press).toMatchObject({ outcome: 'done' });
      expect(calls.moved).toEqual([call]);
    }
    const woken = setup({ proposals: [suggestion('wake-mission', { mission: MISSION })] });
    expect((await json(await supervisorPress(press(), woken.deps))).press).toMatchObject({ outcome: 'done', note: 'Its supervisor looks at the mission now.' });
    expect(woken.calls.woken).toEqual([MISSION]);
    const foreign = setup({ proposals: [suggestion('pause-mission', { mission: MISSION })], rest: { missions: [] } });
    expect((await json(await supervisorPress(press(), foreign.deps))).press).toMatchObject({ outcome: 'refused', note: 'The mission is no longer in this workspace' });
    expect(foreign.calls.moved).toEqual([]);
  });

  it('queues a bug fix on the App\'s ledger, scrubbed and signed as the Supervisor\'s, once', async () => {
    const target = { kitVersion: '0.0.712', command: 'omni runner work --verbose', class: 'omni-loop', message: 'runner ask answers 500 for olga@example.test', fingerprint: FINGERPRINT };
    const { deps, rest } = setup({ proposals: [suggestion('open-bug-fix', target, { label: 'Open a bug fix' })] });
    expect((await json(await supervisorPress(press(), deps))).press).toMatchObject({ outcome: 'done' });
    expect(rest.ledger).toHaveLength(1);
    expect(rest.ledger[0]).toMatchObject({ kind: 'bug-report', lane: 'bug-report', subject: 'vertuoza/vertuo-omni-loop', key: `bug-report:${FINGERPRINT}:supervisor-${SUGGESTION}` });
    const report = (rest.ledger[0]?.payload as { report: { command: string; message: string } }).report;
    expect(report.command).toBe('omni runner work');
    expect(report.message).toMatch(/^Opened by the Supervisor, an agent: /);
    expect(report.message).not.toContain('olga@example.test');
  });

  it('refuses a bug report scrub() refuses, and queues nothing', async () => {
    const target = { kitVersion: 'latest', command: 'omni runner work', class: 'omni-loop', message: 'boom', fingerprint: FINGERPRINT };
    const { deps, rest } = setup({ proposals: [suggestion('open-bug-fix', target)] });
    expect((await json(await supervisorPress(press(), deps))).press).toMatchObject({ outcome: 'refused', note: 'The report was not sent: the kit version is not a version' });
    expect(rest.ledger).toEqual([]);
  });

  it('answers the steps to copy for a runner\'s merged worktrees and its kit update', async () => {
    const clean = setup({ proposals: [suggestion('clean-worktrees', { runner: ATLAS })] });
    expect((await json(await supervisorPress(press(), clean.deps))).press).toMatchObject({ outcome: 'done', steps: 'omni worktrees prune', note: 'To clean its merged worktrees, run on atlas-01: omni worktrees prune' });
    const kit = setup({ proposals: [suggestion('copy-kit-update', { runner: ATLAS })] });
    expect((await json(await supervisorPress(press(), kit.deps))).press).toMatchObject({ outcome: 'done', steps: 'omni update' });
  });

  it('refuses a link and a suggestion out of shape before anything is pressed', async () => {
    const link = setup({ proposals: [suggestion('open-terminal', { job: JOB })] });
    expect((await supervisorPress(press(), link.deps)).status).toBe(400);
    const bad = setup({ proposals: [suggestion('stop-resume-job', { job: 'not-an-id' })] });
    expect((await supervisorPress(press(), bad.deps)).status).toBe(400);
    expect(bad.w.proposals.filter((p) => p.kind === 'press')).toEqual([]);
  });

  it('answers 500, recorded, when the store fails', async () => {
    const { deps, errors } = setup({ carry: { cancelJob: () => Promise.reject(new Error('boom')) } });
    expect((await supervisorPress(press(), deps)).status).toBe(500);
    expect(errors.map((e) => e.route)).toEqual(['POST /api/supervisor/proposals']);
  });
});

describe('Not a problem', () => {
  const dismiss = (body: unknown = { workspace: ACME, finding: FINDING, reason: 'A flaky test, known.' }) => post('/api/supervisor/proposals/dismiss', body);

  it('AC-2: a finding dismissed with Not a problem raises nothing and pushes nothing when its fingerprint fires again with the same evidence', async () => {
    const { deps, w } = setup();
    const response = await supervisorDismiss(dismiss(), deps);
    expect(response.status).toBe(200);
    expect((await json(response)).dismissed).toEqual({ finding: FINDING, by: 'olga', reason: 'A flaky test, known.' });
    expect(w.findings[0]?.state).toBe('dismissed');

    const sent: unknown[] = [];
    const seatService = supervisorService({ store: fakeStore(w), clock: { now: () => new Date(T0), sleep: () => Promise.resolve() }, alert: (r) => { sent.push(r); return Promise.resolve(); } });
    const again = signalRow({ evidence_key: 'k1', fingerprint: `stuck:silent:${JOB}` });
    w.signals.push(again);
    const seat = w.seats[0];
    if (!seat) throw new Error('no seat');
    const raised = await seatService.raise({ kind: 'seat', workspace: ACME, seat }, { kind: 'stuck', severity: 'high', title: 'Silent again', signals: [again.id], evidence: [], explanation: 'Again.', suggestions: [] }, 'https://omni.example.test');
    expect(raised.ok).toBe(false);
    expect(w.findings).toHaveLength(2);
    expect(sent).toEqual([]);
  });

  it('refuses a member\'s dismissal and changes nothing', async () => {
    const { deps, w } = setup({ viewer: MO });
    expect((await supervisorDismiss(dismiss(), deps)).status).toBe(403);
    expect(w.findings[0]?.state).toBe('open');
    expect(w.proposals.filter((p) => p.kind === 'dismiss')).toEqual([]);
  });

  it('refuses a finding of another workspace, and a body out of shape', async () => {
    const { deps } = setup();
    expect((await supervisorDismiss(dismiss({ workspace: ACME, finding: FOREIGN_FINDING }), deps)).status).toBe(404);
    expect((await supervisorDismiss(dismiss({ workspace: ACME }), deps)).status).toBe(400);
  });
});

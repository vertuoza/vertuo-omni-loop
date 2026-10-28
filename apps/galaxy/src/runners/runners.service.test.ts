import { describe, expect, it } from 'vitest';
import { parseIssue, parsePrd, PrdNumberSchema } from 'omni-loop/kit/lib/ids.ts';
import type { OutboxStand } from '../dossier/page/stage';
import { canResume, canSendAgain } from './page/model';
import { ENDED_JOBS_SHOWN, STORED_OUTCOMES, type Notifier, type Ping } from './runners.contract';
import type { ContinuationsRepository, JobLineRow, JobRow, QuestionsRow, RunnerRow, SampleRow } from './runners.repository';
import { continuationsService, cutLogTail, NEXT_POLL_MS, runnersService, runnerState } from './runners.service';
import {
  API_KEY, CIA_BOX, ELSEWHERE, EVE, fakeStore, jobRow, KEY_APP, lineRows, MO, OLGA, OTHER, OTHER_KEY, PIA, QUESTION, questionsRow, runnerRow, RUNNERS, SAM, SHARED, T0, WORKSPACE,
  type AllowedSkillRow,
} from './fixtures/store.fake';

// The runners' rules (PRD 1830 s1), on realistic rows in memory and a fixed clock: which jobs a runner
// takes, when a silent runner's jobs end as `runner lost`, which reports a job accepts, and who may
// send, cancel and give a runner to a fleet.

const at = (seconds: number) => new Date(T0.getTime() + seconds * 1000);

/** The service on the fake store, with a clock that a held `next` moves forward as it sleeps. */
function world({ jobs = [], runners = RUNNERS, lines = [], samples = [], questions = [], skills = [], start = T0, onSleep, notifier }: {
  jobs?: JobRow[]; runners?: RunnerRow[]; lines?: JobLineRow[]; samples?: SampleRow[]; questions?: QuestionsRow[]; skills?: AllowedSkillRow[]; start?: Date;
  onSleep?: (jobs: JobRow[]) => void; notifier?: Notifier;
} = {}) {
  let now = start;
  const slept: number[] = [];
  const { store, state } = fakeStore({ jobs, runners, lines, samples, questions, skills, now: () => now });
  const service = runnersService(store, {
    now: () => now,
    sleep: (ms) => {
      slept.push(ms);
      now = new Date(now.getTime() + ms);
      onSleep?.(state.jobs);
      return Promise.resolve();
    },
  }, null, notifier);
  return { service, state, slept, setNow: (next: Date) => { now = next; } };
}

const value = <T>(served: { ok: true; value: T } | { ok: false; kind: string; error: string }): T => {
  if (!served.ok) throw new Error(`refused: ${served.kind} ${served.error}`);
  return served.value;
};

describe('which job a runner claims', () => {
  it('takes a job sent to it, to its fleet, or, with no fleet, to any runner', async () => {
    const toRunner = jobRow({ to_runner: CIA_BOX, queued_at: at(-30).toISOString() });
    const toFleet = jobRow({ to_fleet: 'cia', queued_at: at(-20).toISOString() });
    const toAny = jobRow({ queued_at: at(-10).toISOString() });
    const { service } = world({ jobs: [toRunner, toFleet, toAny] });
    expect(value(await service.next(OLGA, CIA_BOX))?.id).toBe(toRunner.id);
    expect(value(await service.next(OLGA, CIA_BOX))?.id).toBe(toFleet.id);
    expect(value(await service.next(OLGA, SHARED))?.id).toBe(toAny.id);
  });

  it('skips a job sent to any runner when it serves a fleet', async () => {
    const toAny = jobRow();
    const { service, state } = world({ jobs: [toAny] });
    expect(value(await service.next(OLGA, CIA_BOX))).toBeNull();
    expect(state.jobs[0]?.status).toBe('queued');
  });

  it('skips a job sent to another fleet, or to another runner', async () => {
    const { service } = world({ jobs: [jobRow({ to_fleet: 'pirates' }), jobRow({ to_runner: SHARED })] });
    expect(value(await service.next(OLGA, CIA_BOX))).toBeNull();
  });

  it('never takes a job for a repository it does not hold, even one sent to it', async () => {
    const { service } = world({ jobs: [jobRow({ to_runner: OTHER, repo: 'demo-org/app' })] });
    expect(value(await service.next(OLGA, OTHER))).toBeNull();
  });

  it('takes the oldest first, and nothing more once its slots are full', async () => {
    const older = jobRow({ queued_at: at(-60).toISOString() });
    const newer = jobRow({ queued_at: at(-5).toISOString() });
    const { service } = world({ jobs: [newer, older] });
    expect(value(await service.next(OLGA, SHARED))?.id).toBe(older.id);
    expect(value(await service.next(OLGA, SHARED))).toBeNull();
  });

  it('hands the runner the line, the repository and the sender\'s login', async () => {
    const job = jobRow({ line: '/omni:pr-care 1801', sent_by: MO });
    const { service } = world({ jobs: [job] });
    expect(value(await service.next(OLGA, SHARED))).toEqual({ id: job.id, line: '/omni:pr-care 1801', repo: 'demo-org/app', sentBy: 'mo', allowedSkills: [], sentByKey: null, github: null });
  });
});

// A repository's own skills (PRD 2313 s1): queue() reads what the repository's owner allowed and takes
// `/<name> <args>` only for one of them; a fixed skill's line is queued as before. The claim hands the
// runner the allowed skills as they stand when it claims, so one turned off while its job waited is
// absent.
describe('a repository\'s own skill (PRD 2313)', () => {
  const allowed = (skill: string, full_name = 'demo-org/app', workspace_id = WORKSPACE): AllowedSkillRow => ({ workspace_id, full_name, skill });
  const send = (line: string, repo = 'demo-org/app') => ({ line, repo, target: { kind: 'any' as const } });
  const NOT_ALLOWED = '/validate-prd is not allowed on a runner for demo-org/app: an owner allows it in Settings › Repositories.';

  it('queues /validate-prd 347 when the repository allows it', async () => {
    const w = world({ skills: [allowed('validate-prd')] });
    expect(value(await w.service.send(SAM, send('/validate-prd 347')))).toMatchObject({ status: 'queued', line: '/validate-prd 347', repo: 'demo-org/app' });
  });

  it('takes the repository however it is spelt', async () => {
    const w = world({ skills: [allowed('validate-prd')] });
    expect(value(await w.service.send(SAM, send('/validate-prd 347', 'Demo-Org/App')))).toMatchObject({ status: 'queued', repo: 'demo-org/app' });
  });

  it('refuses it, with the reason and where an owner allows it, when the repository does not, and queues nothing', async () => {
    const w = world({ skills: [allowed('audit'), allowed('validate-prd', 'demo-org/other'), allowed('validate-prd', 'demo-org/app', '00000000-0000-4000-8000-000001830002')] });
    expect(await w.service.send(SAM, send('/validate-prd 347'))).toEqual({ ok: false, kind: 'malformed', error: NOT_ALLOWED });
    expect(w.state.jobs).toEqual([]);
  });

  it('refuses it to an API key as to a person', async () => {
    const w = world();
    const key = { id: API_KEY, name: 'QA dashboard', workspace: WORKSPACE, maker: OLGA };
    expect(await w.service.sendByKey(key, { repo: 'demo-org/app', line: '/validate-prd 347' })).toEqual({ ok: false, kind: 'malformed', error: NOT_ALLOWED });
  });

  it('refuses a fixed skill\'s name with no /omni:, even allowed, and a name that is no skill\'s, before anything else', async () => {
    const w = world({ skills: [allowed('yolo')] });
    expect(await w.service.send(SAM, send('/yolo 1'))).toEqual({ ok: false, kind: 'malformed', error: '/yolo is the loop\'s own skill: send /omni:yolo.' });
    expect(await w.service.send(EVE, send('/Bad_Name 1'))).toMatchObject({ ok: false, kind: 'malformed' });
    expect(await w.service.send(EVE, send('/validate-prd 347; rm -rf ~'))).toMatchObject({ ok: false, kind: 'malformed' });
    expect(w.state.jobs).toEqual([]);
  });

  it('refuses a repository outside the workspace before it reads any allowance', async () => {
    const w = world({ skills: [allowed('validate-prd')] });
    expect(await w.service.send(EVE, send('/validate-prd 347'))).toMatchObject({ ok: false, kind: 'forbidden' });
    expect(await w.service.send(SAM, send('/validate-prd 347', 'elsewhere/app'))).toMatchObject({ ok: false, kind: 'forbidden' });
  });

  it('queues a fixed skill\'s line as before, whatever the repository allows', async () => {
    const w = world();
    expect(value(await w.service.send(SAM, send('/omni:yolo 2313')))).toMatchObject({ status: 'queued', line: '/omni:yolo 2313' });
    expect(await w.service.send(SAM, send('/omni:drive 2313'))).toMatchObject({ ok: false, kind: 'malformed' });
  });

  it('hands the runner the allowed skills as they stand when it claims the job', async () => {
    const w = world({ skills: [allowed('validate-prd'), allowed('audit'), allowed('lint', 'demo-org/other')] });
    const queued = value(await w.service.send(MO, send('/validate-prd 347')));
    expect(value(await w.service.next(OLGA, SHARED))).toEqual({ id: queued.id, line: '/validate-prd 347', repo: 'demo-org/app', sentBy: 'mo', allowedSkills: ['audit', 'validate-prd'], sentByKey: null, github: null });
  });

  it('hands none back for a skill turned off while its job waited, so the runner refuses it', async () => {
    const w = world({ skills: [allowed('validate-prd')] });
    value(await w.service.send(SAM, send('/validate-prd 347')));
    w.state.skills.length = 0;
    expect(value(await w.service.next(OLGA, SHARED))).toMatchObject({ line: '/validate-prd 347', allowedSkills: [] });
  });

  it('names its PRD to the terminal by its first argument', async () => {
    const w = world({ skills: [allowed('validate-prd')] });
    const queued = value(await w.service.send(SAM, send('/validate-prd 347')));
    expect(value(await w.service.prdJobs(SAM, 'demo-org/app', parsePrd(347))).map((job) => job.id)).toEqual([queued.id]);
  });
});

describe('the skills Send to terminal offers (PRD 2313)', () => {
  const allowed = (skill: string, full_name = 'demo-org/app'): AllowedSkillRow => ({ workspace_id: WORKSPACE, full_name, skill });

  it('reads the repository\'s allowed skills, sorted, for a member, however the repository is spelt', async () => {
    const w = world({ skills: [allowed('validate-prd'), allowed('audit'), allowed('lint', 'demo-org/other')] });
    expect(value(await w.service.allowedSkills(SAM, WORKSPACE, 'Demo-Org/App'))).toEqual(['audit', 'validate-prd']);
  });

  it('reads none to someone outside the workspace', async () => {
    const w = world({ skills: [allowed('validate-prd')] });
    expect(await w.service.allowedSkills(EVE, WORKSPACE, 'demo-org/app')).toMatchObject({ ok: false, kind: 'forbidden' });
  });
});

describe('the long poll', () => {
  it('answers a job at once, counted as a check-in', async () => {
    const { service, state, slept } = world({ jobs: [jobRow()], runners: [runnerRow({ id: SHARED, name: 'shared', last_seen_at: at(-60).toISOString() })] });
    expect(value(await service.next(OLGA, SHARED))).not.toBeNull();
    expect(slept).toEqual([]);
    expect(state.runners[0]?.last_seen_at).toBe(T0.toISOString());
  });

  it('holds up to 40 seconds, checking in each time it looks, then answers none', async () => {
    const { service, state, slept } = world();
    expect(value(await service.next(OLGA, SHARED))).toBeNull();
    expect(slept.reduce((sum, ms) => sum + ms, 0)).toBeLessThanOrEqual(40_000);
    expect(slept.length).toBe(40_000 / NEXT_POLL_MS);
    expect(Date.parse(state.runners[0]?.last_seen_at ?? '')).toBeGreaterThan(at(35).getTime());
  });

  it('answers a job queued while it holds', async () => {
    const late = jobRow();
    const w = world({ onSleep: (jobs) => { if (jobs.length === 0) jobs.push({ ...late }); } });
    expect(value(await w.service.next(OLGA, SHARED))?.id).toBe(late.id);
    expect(w.slept).toEqual([NEXT_POLL_MS]);
  });

  it('refuses a runner of someone else, and an unknown runner', async () => {
    const { service } = world();
    expect(await service.next(MO, SHARED)).toMatchObject({ ok: false, kind: 'forbidden' });
    expect(await service.next(OLGA, '00000000-0000-4000-8000-000001830fff')).toMatchObject({ ok: false, kind: 'missing' });
  });
});

describe('a lost runner', () => {
  const running = () => jobRow({ status: 'running', runner_id: CIA_BOX, claimed_at: T0.toISOString(), running_at: T0.toISOString() });

  it('keeps its jobs at 89 seconds of silence', async () => {
    const job = running();
    const w = world({ jobs: [job], start: at(89) });
    value(await w.service.board(MO, RUNNERS[0]?.workspace_id ?? ''));
    expect(w.state.jobs[0]).toMatchObject({ status: 'running', reason: null });
  });

  it('leaves its claimed and running jobs failed, runner lost, at 91 seconds', async () => {
    const job = running();
    const claimed = jobRow({ status: 'claimed', runner_id: CIA_BOX, claimed_at: T0.toISOString() });
    const w = world({ jobs: [job, claimed], start: at(91) });
    const board = value(await w.service.board(MO, RUNNERS[0]?.workspace_id ?? ''));
    expect(w.state.jobs.map((j) => [j.status, j.reason])).toEqual([['failed', 'runner lost'], ['failed', 'runner lost']]);
    expect(board.runners.find((r) => r.id === CIA_BOX)?.state).toBe('offline');
  });

  it('is marked on another runner\'s job update', async () => {
    const job = running();
    const runners = [runnerRow({ id: SHARED, name: 'shared', last_seen_at: at(60).toISOString() }), runnerRow({ id: CIA_BOX, name: 'cia-box', fleet: 'cia' })];
    const w = world({ jobs: [job, jobRow({ status: 'running', runner_id: SHARED, claimed_at: T0.toISOString() })], runners, start: at(91) });
    // The shared runner, seen 31 seconds ago, reports in: its own job stays, the silent one's ends.
    const shared = w.state.jobs[1]?.id ?? '';
    expect(value(await w.service.update(OLGA, shared, { status: 'running', logTail: 'step 2' }))).toEqual({ cancel: false });
    expect(w.state.jobs.map((j) => j.status)).toEqual(['failed', 'running']);
  });

  it('never runs a lost job again', async () => {
    const job = running();
    const w = world({ jobs: [job], start: at(91) });
    expect(value(await w.service.next(OLGA, SHARED))).toBeNull();
    expect(value(await w.service.next(OLGA, CIA_BOX))).toBeNull();
    expect(w.state.jobs[0]?.status).toBe('failed');
  });
});

describe('a runner\'s reports', () => {
  const claimed = () => jobRow({ status: 'claimed', runner_id: SHARED, claimed_at: T0.toISOString() });

  it('take a job from claimed to running to done, in order', async () => {
    const job = claimed();
    const w = world({ jobs: [job] });
    expect(value(await w.service.update(OLGA, job.id, { status: 'running', logTail: 'starting' }))).toEqual({ cancel: false });
    w.setNow(at(30));
    expect(value(await w.service.update(OLGA, job.id, { status: 'running', logTail: 'half way' }))).toEqual({ cancel: false });
    w.setNow(at(60));
    expect(value(await w.service.update(OLGA, job.id, { status: 'done', prUrl: 'https://github.com/demo-org/app/pull/12', exitCode: 0, logTail: 'opened #12' })))
      .toEqual({ cancel: false });
    expect(w.state.jobs[0]).toMatchObject({
      status: 'done', running_at: T0.toISOString(), ended_at: at(60).toISOString(), pr_url: 'https://github.com/demo-org/app/pull/12', exit_code: 0, log_tail: 'opened #12',
    });
  });

  it('take a claimed job straight to failed, with its reason', async () => {
    const job = claimed();
    const w = world({ jobs: [job] });
    value(await w.service.update(OLGA, job.id, { status: 'failed', reason: 'timeout', exitCode: 137 }));
    expect(w.state.jobs[0]).toMatchObject({ status: 'failed', reason: 'timeout', exit_code: 137, ended_at: T0.toISOString() });
  });

  it('refuse a report out of order', async () => {
    const job = jobRow({ status: 'running', runner_id: SHARED, claimed_at: T0.toISOString(), running_at: T0.toISOString() });
    const done = jobRow({ status: 'done', runner_id: SHARED, claimed_at: T0.toISOString(), ended_at: T0.toISOString() });
    const w = world({ jobs: [job, done] });
    expect(await w.service.update(OLGA, done.id, { status: 'running' })).toMatchObject({ ok: false, kind: 'conflict', error: 'This job has ended: done. Stop it.' });
    expect(w.state.jobs[1]?.status).toBe('done');
  });

  it('answer cancel while a cancel waits, until the runner reports it cancelled', async () => {
    const job = jobRow({ status: 'running', runner_id: SHARED, claimed_at: T0.toISOString(), running_at: T0.toISOString() });
    const w = world({ jobs: [job] });
    value(await w.service.cancel(MO, job.id));
    expect(value(await w.service.update(OLGA, job.id, { status: 'running' }))).toEqual({ cancel: true });
    expect(value(await w.service.update(OLGA, job.id, { status: 'cancelled', logTail: 'killed' }))).toEqual({ cancel: false });
    expect(w.state.jobs[0]).toMatchObject({ status: 'cancelled', ended_at: T0.toISOString() });
    expect(await w.service.update(OLGA, job.id, { status: 'running' })).toMatchObject({ ok: false, kind: 'conflict' });
  });

  it('refuse any report after runner lost, and the runner stops the job', async () => {
    const job = jobRow({ status: 'running', runner_id: SHARED, claimed_at: T0.toISOString(), running_at: T0.toISOString() });
    const w = world({ jobs: [job], runners: [runnerRow({ id: SHARED, name: 'shared', last_seen_at: at(-120).toISOString() })] });
    // The report checks the runner in, but its job was lost first.
    expect(await w.service.update(OLGA, job.id, { status: 'done', exitCode: 0 }))
      .toMatchObject({ ok: false, kind: 'conflict', error: 'This job has ended: failed, runner lost. Stop it.' });
  });

  it('refuse a report on a job claimed by someone else\'s runner, and on a job no runner claimed', async () => {
    const job = claimed();
    const queued = jobRow();
    const w = world({ jobs: [job, queued] });
    expect(await w.service.update(MO, job.id, { status: 'running' })).toMatchObject({ ok: false, kind: 'forbidden' });
    expect(await w.service.update(OLGA, queued.id, { status: 'running' })).toMatchObject({ ok: false, kind: 'forbidden' });
    expect(await w.service.update(OLGA, '00000000-0000-4000-8000-000001830fff', { status: 'running' })).toMatchObject({ ok: false, kind: 'missing' });
  });

  it('cut the log tail to its last 200 lines and 16 KB', async () => {
    const job = claimed();
    const w = world({ jobs: [job] });
    const log = Array.from({ length: 500 }, (_, i) => `line ${String(i)}`).join('\n');
    value(await w.service.update(OLGA, job.id, { status: 'running', logTail: log }));
    const kept = w.state.jobs[0]?.log_tail.split('\n') ?? [];
    expect(kept).toHaveLength(200);
    expect(kept[0]).toBe('line 300');
  });
});

describe('the log tail', () => {
  it('keeps a short log as it is', () => {
    expect(cutLogTail('one\ntwo')).toBe('one\ntwo');
  });

  it('keeps at most 16 KB, never splitting a character', () => {
    const cut = cutLogTail('é'.repeat(10_000));
    expect(new TextEncoder().encode(cut).length).toBeLessThanOrEqual(16 * 1024);
    expect(cut).toMatch(/^é+$/);
  });
});

describe('a runner\'s state', () => {
  const runner = runnerRow({ id: SHARED, name: 'shared', slots: 2 });
  it('is online with a free slot, busy with none, offline after 90 seconds of silence', () => {
    expect(runnerState(runner, 1, at(90))).toBe('online');
    expect(runnerState(runner, 2, at(10))).toBe('busy');
    expect(runnerState(runner, 0, at(91))).toBe('offline');
  });
});

describe('registering', () => {
  it('creates the runner in the workspace its repositories belong to, and registers it again by name', async () => {
    const w = world({ runners: [] });
    const first = value(await w.service.register(OLGA, { name: 'nimbus-agents', slots: 4, repos: ['Demo-Org/App', 'demo-org/app', 'demo-org/other'], version: '0.0.387' }));
    expect(first).toMatchObject({ name: 'nimbus-agents', fleet: null });
    expect(w.state.runners[0]).toMatchObject({ owner: OLGA, repos: ['demo-org/app', 'demo-org/other'], slots: 4 });
    w.setNow(at(300));
    const again = value(await w.service.register(OLGA, { name: 'nimbus-agents', slots: 2, repos: ['demo-org/app'], version: '0.0.388' }));
    expect(again.id).toBe(first.id);
    expect(w.state.runners).toHaveLength(1);
    expect(w.state.runners[0]).toMatchObject({ slots: 2, version: '0.0.388', last_seen_at: at(300).toISOString() });
  });

  it('ends the jobs a restarted runner held as runner lost, though it was silent for under 90 s (#2170)', async () => {
    const starting = jobRow({ status: 'claimed', runner_id: SHARED, claimed_at: T0.toISOString() });
    const running = jobRow({ status: 'running', runner_id: SHARED, claimed_at: T0.toISOString(), running_at: T0.toISOString() });
    const elsewhere = jobRow({ status: 'running', runner_id: CIA_BOX, claimed_at: T0.toISOString(), running_at: T0.toISOString() });
    const queued = jobRow();
    const w = world({ jobs: [starting, running, elsewhere, queued], start: at(10) });
    value(await w.service.register(OLGA, { name: 'shared', slots: 1, repos: ['demo-org/app'], version: '1' }));
    expect(w.state.jobs.map((j) => [j.status, j.reason])).toEqual([['failed', 'runner lost'], ['failed', 'runner lost'], ['running', null], ['queued', null]]);
    expect(value(await w.service.next(OLGA, SHARED))?.id).toBe(queued.id);
  });

  it('refuses a name another person registered, a repository outside the workspace, and two workspaces', async () => {
    const w = world();
    expect(await w.service.register(MO, { name: 'shared', slots: 1, repos: ['demo-org/app'], version: '1' })).toMatchObject({ ok: false, kind: 'forbidden' });
    expect(await w.service.register(OLGA, { name: 'x', slots: 1, repos: ['elsewhere/app'], version: '1' }))
      .toMatchObject({ ok: false, kind: 'forbidden', error: 'elsewhere/app is not in your workspace: you are not a member of the workspace that owns elsewhere/app.' });
    expect(await w.service.register(EVE, { name: 'x', slots: 1, repos: ['elsewhere/app', 'demo-org/app'], version: '1' })).toMatchObject({ ok: false, kind: 'forbidden' });
  });
});

describe('who may send where', () => {
  const send = (target: Parameters<ReturnType<typeof runnersService>['send']>[1]['target'], line = '/omni:yolo 1717', repo = 'demo-org/app') => ({ line, repo, target });

  it('lets any member send to any runner, or to a runner with no fleet', async () => {
    const w = world();
    expect(value(await w.service.send(SAM, send({ kind: 'any' })))).toMatchObject({ status: 'queued', toRunner: null, toFleet: null, sentBy: SAM });
    expect(value(await w.service.send(PIA, send({ kind: 'runner', runner: SHARED })))).toMatchObject({ toRunner: SHARED, sentByLogin: 'pia' });
  });

  it('lets a fleet\'s players and the owners send to the fleet, or to a runner in it', async () => {
    const w = world();
    expect(value(await w.service.send(MO, send({ kind: 'fleet', fleet: 'cia' })))).toMatchObject({ toFleet: 'cia' });
    expect(value(await w.service.send(MO, send({ kind: 'runner', runner: CIA_BOX })))).toMatchObject({ toRunner: CIA_BOX });
    expect(value(await w.service.send(OLGA, send({ kind: 'fleet', fleet: 'pirates' })))).toMatchObject({ toFleet: 'pirates' });
  });

  it('refuses a sender outside the fleet', async () => {
    const w = world();
    expect(await w.service.send(PIA, send({ kind: 'fleet', fleet: 'cia' }))).toMatchObject({ ok: false, kind: 'forbidden' });
    expect(await w.service.send(SAM, send({ kind: 'runner', runner: CIA_BOX })))
      .toMatchObject({ ok: false, kind: 'forbidden', error: 'cia-box serves cia: only its players and the workspace\'s owners send to it.' });
    expect(w.state.jobs).toEqual([]);
  });

  it('refuses a repository outside the workspace, an unknown fleet and another workspace\'s runner', async () => {
    const w = world();
    expect(await w.service.send(MO, send({ kind: 'any' }, '/omni:yolo 1', 'elsewhere/app'))).toMatchObject({ ok: false, kind: 'forbidden' });
    expect(await w.service.send(MO, send({ kind: 'fleet', fleet: 'ghosts' }))).toMatchObject({ ok: false, kind: 'missing' });
    expect(await w.service.send(EVE, send({ kind: 'runner', runner: SHARED }, '/omni:yolo 1', 'elsewhere/app'))).toMatchObject({ ok: false, kind: 'missing' });
  });

  it('refuses a line off the list before anything else', async () => {
    const w = world();
    expect(await w.service.send(OLGA, send({ kind: 'any' }, '/omni:drive 1717'))).toMatchObject({ ok: false, kind: 'malformed' });
    expect(await w.service.send(OLGA, send({ kind: 'any' }, '/omni:yolo 1; rm -rf ~'))).toMatchObject({ ok: false, kind: 'malformed' });
  });
});

describe('a job the Omni app sends (PRD 2338 s2)', () => {
  const appJob = () => jobRow({ line: '/omni:retro-apply --retro 2340', sent_by: null, sent_by_app: 'omni-app' });

  it('reads as sent by the Omni app, with no person, on the Runners page', async () => {
    const queued = appJob();
    const w = world({ jobs: [queued] });
    const board = value(await w.service.board(OLGA, queued.workspace_id));
    expect(board.jobs).toMatchObject([{ id: queued.id, sentBy: null, sentByLogin: null, sentByApp: 'omni-app', sentByKey: null }]);
  });

  it('reads as sent by the Omni app to the runner that claims it', async () => {
    const queued = appJob();
    const w = world({ jobs: [queued] });
    expect(value(await w.service.next(OLGA, SHARED))).toEqual({ id: queued.id, line: queued.line, repo: 'demo-org/app', sentBy: 'Omni app', allowedSkills: [], sentByKey: null, github: null });
  });

  it('lets a workspace owner cancel it, and no other member', async () => {
    const queued = appJob();
    const w = world({ jobs: [queued] });
    expect(await w.service.cancel(MO, queued.id)).toMatchObject({ ok: false, kind: 'forbidden' });
    expect(await w.service.cancel(OLGA, queued.id)).toMatchObject({ ok: true });
  });
});

describe('a job an API key sends (PRD 2022 s4)', () => {
  const key = { id: API_KEY, name: 'QA dashboard', workspace: '00000000-0000-4000-8000-000001830001', maker: OLGA };
  const fix = { repo: 'demo-org/app', line: '/omni:bug-fix Issue 548 totals' };

  it('queues it as the key\'s maker, marked as the key\'s, to any runner, a runner by its name or a fleet', async () => {
    const w = world();
    expect(value(await w.service.sendByKey(key, fix))).toMatchObject({ status: 'queued', runner: null, line: fix.line });
    expect(value(await w.service.sendByKey(key, { ...fix, runner: 'cia-box' }))).toMatchObject({ status: 'queued' });
    expect(value(await w.service.sendByKey(key, { ...fix, fleet: 'pirates' }))).toMatchObject({ status: 'queued' });
    expect(w.state.jobs.map((job) => [job.sent_by, job.sent_by_key, job.to_runner, job.to_fleet])).toEqual([
      [OLGA, API_KEY, null, null], [OLGA, API_KEY, CIA_BOX, null], [OLGA, API_KEY, null, 'pirates'],
    ]);
  });

  it('refuses a line the runners refuse, with their reason, and queues nothing', async () => {
    const w = world();
    const refused = await w.service.sendByKey(key, { ...fix, line: "/omni:bug-fix it's $(rm -rf ~)" });
    expect(refused).toMatchObject({ ok: false, kind: 'malformed' });
    expect(!refused.ok && refused.error).toContain('arguments');
    expect(w.state.jobs).toEqual([]);
  });

  it('refuses a repository of another workspace, even one its maker belongs to, and an unknown runner or fleet', async () => {
    const w = world();
    expect(await w.service.sendByKey({ ...key, workspace: '00000000-0000-4000-8000-000001830002' }, fix)).toMatchObject({ ok: false, kind: 'forbidden' });
    expect(await w.service.sendByKey(key, { ...fix, repo: 'elsewhere/app' })).toMatchObject({ ok: false, kind: 'forbidden' });
    expect(await w.service.sendByKey(key, { ...fix, runner: 'ghost' })).toMatchObject({ ok: false, kind: 'missing' });
    expect(await w.service.sendByKey(key, { ...fix, fleet: 'ghosts' })).toMatchObject({ ok: false, kind: 'missing' });
    expect(await w.service.sendByKey(key, { ...fix, fleet: 'cia', runner: 'shared' })).toMatchObject({ ok: false, kind: 'malformed' });
    expect(w.state.jobs).toEqual([]);
  });

  it('refuses a key whose maker is no member of the workspace any more', async () => {
    const w = world();
    expect(await w.service.sendByKey({ ...key, maker: EVE }, fix)).toMatchObject({ ok: false, kind: 'forbidden' });
  });

  it('reads as sent by the key, with its maker, to the runner and on the Runners page', async () => {
    const w = world();
    const queued = value(await w.service.sendByKey(key, fix));
    expect(value(await w.service.next(OLGA, SHARED))).toEqual({ id: queued.id, line: fix.line, repo: 'demo-org/app', sentBy: 'API key QA dashboard (@olga)', allowedSkills: [], sentByKey: 'QA dashboard', github: null });
    const board = value(await w.service.board(OLGA, key.workspace));
    expect(board.jobs).toMatchObject([{ id: queued.id, sentByKey: 'QA dashboard', sentByLogin: 'olga' }]);
    const person = value(await w.service.send(MO, { line: '/omni:yolo 1', repo: 'demo-org/app', target: { kind: 'any' } }));
    expect(person.sentByKey).toBeNull();
  });

  it('follows only a job a key of the workspace queued: not a person\'s, not another workspace\'s', async () => {
    const w = world();
    const queued = value(await w.service.sendByKey(key, fix));
    const person = value(await w.service.send(MO, { line: '/omni:yolo 1', repo: 'demo-org/app', target: { kind: 'any' } }));
    expect(value(await w.service.keyJob(key.workspace, queued.id))).toMatchObject({ id: queued.id, status: 'queued', runner: null, prUrl: null });
    expect(await w.service.keyJob(key.workspace, person.id)).toMatchObject({ ok: false, kind: 'missing' });
    expect(await w.service.keyJob('00000000-0000-4000-8000-000001830002', queued.id)).toMatchObject({ ok: false, kind: 'missing' });
    expect(await w.service.keyJob(key.workspace, '00000000-0000-4000-8000-00000000dead')).toMatchObject({ ok: false, kind: 'missing' });
  });

  it('shows its run: the runner\'s name, the pull request, the exit code and the times', async () => {
    const w = world();
    const queued = value(await w.service.sendByKey(key, fix));
    await w.service.next(OLGA, SHARED);
    await w.service.update(OLGA, queued.id, { status: 'done', prUrl: 'https://github.com/demo-org/app/pull/549', exitCode: 0 });
    expect(value(await w.service.keyJob(key.workspace, queued.id))).toMatchObject({
      status: 'done', runner: 'shared', prUrl: 'https://github.com/demo-org/app/pull/549', exitCode: 0, endedAt: T0.toISOString(),
    });
  });
});

describe('cancelling', () => {
  it('ends a queued job at once', async () => {
    const job = jobRow({ sent_by: MO });
    const w = world({ jobs: [job] });
    expect(value(await w.service.cancel(MO, job.id))).toMatchObject({ status: 'cancelled', cancelRequested: true, endedAt: T0.toISOString() });
  });

  it('ends a Starting job at once, though its runner, still checking in, never reports on it (#2168)', async () => {
    const job = jobRow({ status: 'claimed', sent_by: MO, runner_id: SHARED, claimed_at: T0.toISOString() });
    const asked = jobRow({ status: 'claimed', sent_by: MO, runner_id: SHARED, claimed_at: T0.toISOString(), cancel_requested: true });
    const w = world({ jobs: [job, asked] });
    expect(value(await w.service.cancel(MO, job.id))).toMatchObject({ status: 'cancelled', cancelRequested: true, endedAt: T0.toISOString() });
    expect(value(await w.service.cancel(MO, asked.id))).toMatchObject({ status: 'cancelled', endedAt: T0.toISOString() });
    expect(await w.service.update(OLGA, job.id, { status: 'running' })).toMatchObject({ ok: false, kind: 'conflict' });
  });

  it('asks the runner to stop a running job', async () => {
    const job = jobRow({ status: 'running', runner_id: SHARED, claimed_at: T0.toISOString(), running_at: T0.toISOString() });
    const w = world({ jobs: [job] });
    expect(value(await w.service.cancel(OLGA, job.id))).toMatchObject({ status: 'running', cancelRequested: true });
  });

  it('is the sender\'s or an owner\'s, and never an ended job\'s', async () => {
    const job = jobRow({ sent_by: MO });
    const done = jobRow({ status: 'done', runner_id: SHARED, claimed_at: T0.toISOString(), ended_at: T0.toISOString() });
    const w = world({ jobs: [job, done] });
    expect(await w.service.cancel(PIA, job.id)).toMatchObject({ ok: false, kind: 'forbidden' });
    expect(await w.service.cancel(EVE, job.id)).toMatchObject({ ok: false, kind: 'missing' });
    expect(await w.service.cancel(OLGA, done.id)).toMatchObject({ ok: false, kind: 'conflict' });
  });
});

describe('a runner\'s fleet', () => {
  it('is set and cleared by a workspace owner', async () => {
    const w = world();
    expect(value(await w.service.setFleet(OLGA, SHARED, 'pirates'))).toMatchObject({ fleet: 'pirates', state: 'online' });
    expect(value(await w.service.setFleet(OLGA, SHARED, null))).toMatchObject({ fleet: null });
  });

  it('is refused to a non-owner, for an unknown fleet, and to another workspace', async () => {
    const w = world();
    expect(await w.service.setFleet(MO, SHARED, 'cia')).toMatchObject({ ok: false, kind: 'forbidden', error: 'Only a workspace owner gives a runner to a fleet.' });
    expect(await w.service.setFleet(OLGA, SHARED, 'ghosts')).toMatchObject({ ok: false, kind: 'missing' });
    expect(await w.service.setFleet(EVE, SHARED, null)).toMatchObject({ ok: false, kind: 'missing' });
    expect(w.state.runners[0]?.fleet).toBeNull();
  });
});

describe('the Runners page\'s read', () => {
  it('lists the runners with their state and the jobs, active first, then the last that ended', async () => {
    const running = jobRow({ status: 'running', runner_id: SHARED, claimed_at: T0.toISOString(), running_at: T0.toISOString() });
    const done = jobRow({ status: 'done', runner_id: CIA_BOX, claimed_at: T0.toISOString(), ended_at: at(-10).toISOString(), pr_url: 'https://github.com/demo-org/app/pull/1' });
    const queued = jobRow({ queued_at: at(-5).toISOString() });
    const w = world({ jobs: [done, running, queued] });
    const board = value(await w.service.board(PIA, RUNNERS[0]?.workspace_id ?? ''));
    expect(board.runners.map((r) => [r.name, r.state, r.used])).toEqual([['cia-box', 'online', 0], ['other', 'online', 0], ['shared', 'busy', 1]]);
    expect(board.jobs.map((j) => j.id)).toEqual([running.id, queued.id, done.id]);
    expect(board.viewer).toEqual({ id: PIA, owner: false, fleet: 'pirates' });
  });

  it('is refused to anyone outside the workspace', async () => {
    const w = world();
    expect(await w.service.board(EVE, RUNNERS[0]?.workspace_id ?? '')).toMatchObject({ ok: false, kind: 'forbidden' });
  });

  // PRD 2482 s2: what the page needs to say a queued job cannot run as its key's GitHub App.
  it('carries each runner\'s githubApp, from runners.github_app', async () => {
    const w = world({ runners: [runnerRow({ id: SHARED, name: 'shared', github_app: true }), runnerRow({ id: CIA_BOX, name: 'cia-box', github_app: false })] });
    const board = value(await w.service.board(OLGA, WORKSPACE));
    expect(board.runners.map((r) => [r.name, r.githubApp])).toEqual([['cia-box', false], ['shared', true]]);
  });

  it('carries needsApp on a queued job of a key that holds an App, or that was marked, and on no other', async () => {
    const holds = jobRow({ sent_by: OLGA, sent_by_key: API_KEY });
    const marked = jobRow({ sent_by: OLGA, sent_by_key: OTHER_KEY });
    const plain = jobRow({ sent_by: OLGA });
    const w = world({ jobs: [holds, marked, plain] });
    w.state.keys.push({ id: API_KEY, app: KEY_APP, working: true });
    w.state.needsApp.add(marked.id);
    const board = value(await w.service.board(OLGA, WORKSPACE));
    expect(Object.fromEntries(board.jobs.map((j) => [j.id, j.needsApp]))).toEqual({ [holds.id]: true, [marked.id]: true, [plain.id]: undefined });
  });

  it('reads no App for a key that holds none, and none for a job that is not queued', async () => {
    const noApp = jobRow({ sent_by: OLGA, sent_by_key: API_KEY });
    const running = jobRow({ sent_by: OLGA, sent_by_key: API_KEY, status: 'running', runner_id: SHARED, claimed_at: T0.toISOString(), running_at: T0.toISOString() });
    const w = world({ jobs: [noApp, running] });
    const board = value(await w.service.board(OLGA, WORKSPACE));
    expect(board.jobs.map((j) => j.needsApp)).toEqual([undefined, undefined]);
    // One batched read of the queued key jobs, never api_key_github_app_of_job(), which carries the App's sealed key.
    expect(w.state.calls).toEqual([`jobs needing app ${noApp.id}`]);
  });
});

// PRD 2175 s2: a job's last report says which claims its runner released, and why a release failed; a
// job its runner lost takes that report after it ended, and nothing else.
describe('a job\'s released claims (PRD 2175)', () => {
  const running = () => jobRow({ status: 'running', runner_id: SHARED, claimed_at: T0.toISOString(), running_at: T0.toISOString() });
  const lost = () => jobRow({ status: 'failed', reason: 'runner lost', runner_id: SHARED, claimed_at: T0.toISOString(), ended_at: at(-60).toISOString() });

  it('stores what a last report released, and why a release failed, with its ending', async () => {
    const job = running();
    const w = world({ jobs: [job] });
    value(await w.service.update(OLGA, job.id, { status: 'done', exitCode: 0, released: [1908, 1909], releaseError: null }));
    expect(w.state.jobs[0]).toMatchObject({ status: 'done', released: [1908, 1909], release_error: null, ended_at: T0.toISOString() });
  });

  it('leaves both empty for a report that carries neither, as a runner from before PRD 2175 sends', async () => {
    const job = running();
    const w = world({ jobs: [job] });
    value(await w.service.update(OLGA, job.id, { status: 'done', exitCode: 0 }));
    expect(w.state.jobs[0]).not.toHaveProperty('released');
    expect(w.state.jobs[0]).not.toHaveProperty('release_error');
  });

  it('takes what a runner released for a lost job, on the status it ended on, and changes nothing else', async () => {
    const job = lost();
    const w = world({ jobs: [job] });
    expect(value(await w.service.update(OLGA, job.id, { status: 'failed', released: [1908], releaseError: '#1909: HTTP 502' }))).toEqual({ cancel: false });
    expect(w.state.jobs[0]).toEqual({ ...job, released: [1908], release_error: '#1909: HTTP 502' });
    value(await w.service.update(OLGA, job.id, { status: 'failed', releaseError: 'gh: not signed in' }));
    expect(w.state.jobs[0]).toMatchObject({ released: [1908], release_error: 'gh: not signed in' });
  });

  it('refuses, on an ended job, a report on another status, one that carries anything else, and one that carries nothing released', async () => {
    const job = lost();
    const w = world({ jobs: [job] });
    const ended = { ok: false, kind: 'conflict', error: 'This job has ended: failed, runner lost. Stop it.' };
    expect(await w.service.update(OLGA, job.id, { status: 'done', released: [1] })).toMatchObject(ended);
    expect(await w.service.update(OLGA, job.id, { status: 'failed', released: [1], logTail: 'more' })).toMatchObject(ended);
    expect(await w.service.update(OLGA, job.id, { status: 'failed' })).toMatchObject(ended);
    expect(w.state.jobs[0]).toEqual(job);
  });

  it('takes it only from the runner that held the job', async () => {
    const job = lost();
    const w = world({ jobs: [job] });
    expect(await w.service.update(MO, job.id, { status: 'failed', released: [1] })).toMatchObject({ ok: false, kind: 'forbidden' });
  });

  it('answers a conflict when the job changed meanwhile', async () => {
    const job = lost();
    const { store } = fakeStore({ jobs: [job] });
    const service = runnersService({ ...store, updateJob: () => Promise.resolve(null) }, { now: () => T0, sleep: () => Promise.resolve() });
    expect(await service.update(OLGA, job.id, { status: 'failed', released: [1] })).toMatchObject({ ok: false, kind: 'conflict', error: 'This job changed meanwhile. Report again.' });
  });

  it('reads the released claims with the job on the Runners page, none for a job that reported none', async () => {
    const released = jobRow({ ...lost(), released: [1908], release_error: 'HTTP 502' });
    const plain = jobRow({ status: 'done', runner_id: SHARED, claimed_at: T0.toISOString(), ended_at: at(-30).toISOString() });
    const w = world({ jobs: [released, plain] });
    const board = value(await w.service.board(PIA, RUNNERS[0]?.workspace_id ?? ''));
    expect(board.jobs.find((j) => j.id === released.id)).toMatchObject({ released: [1908], releaseError: 'HTTP 502' });
    expect(board.jobs.find((j) => j.id === plain.id)).toMatchObject({ released: null, releaseError: null });
  });
});

// PRD 2223 s1: a done job's last report may say what its yolo hand-off ended on.
describe('a job\'s outcome (PRD 2223)', () => {
  const running = () => jobRow({ status: 'running', runner_id: SHARED, claimed_at: T0.toISOString(), running_at: T0.toISOString() });

  it('stores the outcome of a done report and reads it back with the job on the Runners page', async () => {
    const job = running();
    const w = world({ jobs: [job] });
    value(await w.service.update(OLGA, job.id, { status: 'done', exitCode: 0, outcome: 'answers' }));
    expect(w.state.jobs[0]).toMatchObject({ status: 'done', outcome: 'answers' });
    const board = value(await w.service.board(PIA, RUNNERS[0]?.workspace_id ?? ''));
    expect(board.jobs.find((j) => j.id === job.id)).toMatchObject({ outcome: 'answers' });
  });

  it('stores none for a report that carries none, a failed report, or a cancelled one, and reads it as null', async () => {
    const plain = running();
    const failed = running();
    const cancelled = running();
    const w = world({ jobs: [plain, failed, cancelled] });
    value(await w.service.update(OLGA, plain.id, { status: 'done', exitCode: 0 }));
    value(await w.service.update(OLGA, failed.id, { status: 'failed', exitCode: 1, outcome: 'held' }));
    value(await w.service.update(OLGA, cancelled.id, { status: 'cancelled', outcome: 'ready' }));
    for (const job of w.state.jobs) expect(job).not.toHaveProperty('outcome');
    const board = value(await w.service.board(PIA, RUNNERS[0]?.workspace_id ?? ''));
    for (const job of board.jobs) expect(job.outcome).toBeNull();
  });
});

describe('a job\'s live lines (PRD 1904)', () => {
  const running = () => jobRow({ status: 'running', runner_id: SHARED, claimed_at: T0.toISOString(), running_at: T0.toISOString() });
  const texts = (from: number, count: number) => Array.from({ length: count }, (_, i) => `12:04:31 Bash: step ${String(from + i)}`);
  const seqs = (rows: JobLineRow[], jobId: string) => rows.filter((row) => row.job_id === jobId).map((row) => row.seq).sort((a, b) => a - b);

  it('are stored once each, when a report is sent twice', async () => {
    const job = running();
    const w = world({ jobs: [job] });
    const report = { status: 'running', logTail: 'tail', from: 1, lines: texts(1, 3) } as const;
    value(await w.service.update(OLGA, job.id, report));
    value(await w.service.update(OLGA, job.id, report));
    expect(w.state.lines.map((row) => [row.seq, row.text, row.workspace_id])).toEqual([
      [1, '12:04:31 Bash: step 1', job.workspace_id], [2, '12:04:31 Bash: step 2', job.workspace_id], [3, '12:04:31 Bash: step 3', job.workspace_id],
    ]);
    expect(w.state.jobs[0]?.log_tail).toBe('tail');
  });

  it('are kept to the job\'s last 20,000', async () => {
    const job = running();
    const w = world({ jobs: [job], lines: lineRows(job, 1, 19_999) });
    value(await w.service.update(OLGA, job.id, { status: 'running', from: 20_000, lines: texts(20_000, 2) }));
    const kept = seqs(w.state.lines, job.id);
    expect(kept).toHaveLength(20_000);
    expect([kept[0], kept.at(-1)]).toEqual([2, 20_001]);
  });

  it('leave another job\'s lines alone when trimmed', async () => {
    const job = running();
    const other = jobRow({ status: 'running', runner_id: CIA_BOX, claimed_at: T0.toISOString(), running_at: T0.toISOString() });
    const w = world({ jobs: [job, other], lines: [...lineRows(job, 1, 20_000), ...lineRows(other, 1, 3)] });
    value(await w.service.update(OLGA, job.id, { status: 'running', from: 20_001, lines: texts(20_001, 1) }));
    expect(seqs(w.state.lines, other.id)).toEqual([1, 2, 3]);
  });

  it('are added by no report that carries only its log tail', async () => {
    const job = running();
    const w = world({ jobs: [job] });
    value(await w.service.update(OLGA, job.id, { status: 'running', logTail: 'an old runner' }));
    expect(w.state.lines).toEqual([]);
    expect(w.state.jobs[0]?.log_tail).toBe('an old runner');
  });

  it('are stored even on the report that ends the job', async () => {
    const job = running();
    const w = world({ jobs: [job] });
    value(await w.service.update(OLGA, job.id, { status: 'done', exitCode: 0, from: 1, lines: ['12:30:00 Done: ok · 12 turns · $1.20 · 30m'] }));
    expect(seqs(w.state.lines, job.id)).toEqual([1]);
  });

  it('are refused, with the report, on a job that has ended', async () => {
    const done = jobRow({ status: 'done', runner_id: SHARED, claimed_at: T0.toISOString(), ended_at: T0.toISOString() });
    const w = world({ jobs: [done] });
    expect(await w.service.update(OLGA, done.id, { status: 'done', from: 1, lines: ['late'] })).toMatchObject({ ok: false, kind: 'conflict' });
    expect(w.state.lines).toEqual([]);
  });

  it('of ended jobs beyond the workspace\'s 50 most recent are deleted when a job ends', async () => {
    const ended = Array.from({ length: 51 }, (_, i) => jobRow({
      status: 'done', runner_id: CIA_BOX, claimed_at: T0.toISOString(), ended_at: at(-1000 + i).toISOString(),
    }));
    const elsewhere = jobRow({ workspace_id: '00000000-0000-4000-8000-000001830002', status: 'done', ended_at: at(-5000).toISOString() });
    const job = running();
    const w = world({ jobs: [...ended, elsewhere, job], lines: [...ended.flatMap((row) => lineRows(row, 1, 2)), ...lineRows(elsewhere, 1, 2), ...lineRows(job, 1, 2)] });
    value(await w.service.update(OLGA, job.id, { status: 'done', exitCode: 0 }));
    // The job that just ended is the newest; the two oldest of the 51 before it fall out of the 50.
    const holding = new Set(w.state.lines.map((row) => row.job_id));
    expect(holding.has(job.id)).toBe(true);
    expect([ended[0]?.id, ended[1]?.id].map((id) => holding.has(id ?? ''))).toEqual([false, false]);
    expect(ended.slice(2).every((row) => holding.has(row.id))).toBe(true);
    expect(holding.has(elsewhere.id)).toBe(true);
  });

  it('of an ended job are kept while it is among the 50 most recent, and a running job keeps its own', async () => {
    const done = jobRow({ status: 'done', runner_id: CIA_BOX, claimed_at: T0.toISOString(), ended_at: at(-10).toISOString() });
    const job = running();
    const still = jobRow({ status: 'running', runner_id: CIA_BOX, claimed_at: T0.toISOString(), running_at: T0.toISOString() });
    const w = world({ jobs: [done, job, still], lines: [...lineRows(done, 1, 2), ...lineRows(job, 1, 2), ...lineRows(still, 1, 2)] });
    value(await w.service.update(OLGA, job.id, { status: 'failed', exitCode: 1 }));
    expect(new Set(w.state.lines.map((row) => row.job_id))).toEqual(new Set([done.id, job.id, still.id]));
  });

  it('are applied for retention when a queued job is cancelled too', async () => {
    const ended = Array.from({ length: 50 }, (_, i) => jobRow({ status: 'done', runner_id: CIA_BOX, claimed_at: T0.toISOString(), ended_at: at(-1000 + i).toISOString() }));
    const queued = jobRow({ sent_by: MO });
    const w = world({ jobs: [...ended, queued], lines: ended.flatMap((row) => lineRows(row, 1, 1)) });
    value(await w.service.cancel(MO, queued.id));
    expect(w.state.lines.some((row) => row.job_id === ended[0]?.id)).toBe(false);
    expect(w.state.lines).toHaveLength(49);
  });
});

describe('reading a job\'s live lines (PRD 1904)', () => {
  const running = () => jobRow({ status: 'running', runner_id: SHARED, claimed_at: T0.toISOString(), running_at: T0.toISOString(), log_tail: 'tail' });

  it('answers the lines after `after`, in order, with the first the job holds', async () => {
    const job = running();
    const w = world({ jobs: [job], lines: lineRows(job, 3, 5).reverse() });
    expect(value(await w.service.lines(PIA, job.id, 4))).toEqual({
      status: 'running', lines: [{ seq: 5, text: 'line 5' }, { seq: 6, text: 'line 6' }, { seq: 7, text: 'line 7' }], more: false, first: 3, logTail: null,
    });
    expect(value(await w.service.lines(PIA, job.id, 7))).toMatchObject({ lines: [], more: false, first: 3 });
  });

  it('answers at most 5,000 lines, and more when more follow', async () => {
    const job = running();
    const w = world({ jobs: [job], lines: lineRows(job, 1, 5_001) });
    const page = value(await w.service.lines(MO, job.id, 0));
    expect([page.lines.length, page.lines[0]?.seq, page.lines.at(-1)?.seq, page.more]).toEqual([5_000, 1, 5_000, true]);
    expect(value(await w.service.lines(MO, job.id, 5_000))).toMatchObject({ lines: [{ seq: 5_001 }], more: false });
  });

  it('answers the log tail only when the job holds no line', async () => {
    const job = running();
    const empty = jobRow({ status: 'done', runner_id: SHARED, claimed_at: T0.toISOString(), ended_at: T0.toISOString() });
    const w = world({ jobs: [job, empty] });
    expect(value(await w.service.lines(MO, job.id, 0))).toEqual({ status: 'running', lines: [], more: false, first: null, logTail: 'tail' });
    expect(value(await w.service.lines(MO, empty.id, 0))).toEqual({ status: 'done', lines: [], more: false, first: null, logTail: null });
  });

  it('is refused, as missing, outside the workspace and for an unknown job', async () => {
    const job = running();
    const w = world({ jobs: [job], lines: lineRows(job, 1, 2) });
    expect(await w.service.lines(EVE, job.id, 0)).toMatchObject({ ok: false, kind: 'missing', error: 'No such job.' });
    expect(await w.service.lines(MO, '00000000-0000-4000-8000-000001830fff', 0)).toMatchObject({ ok: false, kind: 'missing' });
  });
});

// A runner's health (PRD 2102 s1): its owner's report becomes its last health with the server's time and
// counts as a check-in, adds one sample, and drops the runner's samples older than an hour; the Runners
// page reads each runner's last health and its hour of samples, oldest first.
describe('a runner\'s health (PRD 2102)', () => {
  const GB = 1024 ** 3;
  const REPORT = { cpu: 63.5, load1: 7.9, cores: 8, memUsed: 13 * GB, memTotal: 16 * GB, diskFree: 39 * GB, diskTotal: 233 * GB };

  /** A sample of `runner` taken `seconds` from T0. */
  const sampleAt = (runner: string, seconds: number, cpu = 10): SampleRow => ({
    runner_id: runner, workspace_id: RUNNERS[0]?.workspace_id ?? '', at: at(seconds).toISOString(), cpu, mem_used: GB, mem_total: 16 * GB, disk_free: 40 * GB, tokens_5h: null,
  });

  it('stores the report with the server\'s time as the runner\'s last health, and counts it as a check-in', async () => {
    const w = world({ runners: [runnerRow({ id: SHARED, name: 'shared', last_seen_at: at(-60).toISOString() })] });
    expect(value(await w.service.health(OLGA, SHARED, REPORT))).toEqual({ at: T0.toISOString() });
    expect(w.state.runners[0]).toMatchObject({ health: { ...REPORT, at: T0.toISOString() }, last_seen_at: T0.toISOString() });
  });

  it('keeps why a runner is paused and its limits', async () => {
    const w = world();
    const paused = { ...REPORT, paused: 'memory 91%', limits: { maxMemory: 85, minDiskGb: 10, maxLoad: 1.5 } };
    value(await w.service.health(OLGA, SHARED, paused));
    expect(w.state.runners.find((r) => r.id === SHARED)?.health).toEqual({ ...paused, at: T0.toISOString() });
  });

  it('adds one sample of the report\'s figures, in the runner\'s workspace', async () => {
    const w = world();
    value(await w.service.health(OLGA, SHARED, { ...REPORT, cpu: null }));
    expect(w.state.samples).toEqual([{
      runner_id: SHARED, workspace_id: RUNNERS[0]?.workspace_id, at: T0.toISOString(), cpu: null, mem_used: 13 * GB, mem_total: 16 * GB, disk_free: 39 * GB, tokens_5h: null,
    }]);
  });

  it('deletes that runner\'s samples older than an hour, and no other runner\'s', async () => {
    const w = world({ samples: [sampleAt(SHARED, -3601), sampleAt(SHARED, -3600), sampleAt(SHARED, -15), sampleAt(CIA_BOX, -7200)] });
    value(await w.service.health(OLGA, SHARED, REPORT));
    expect(w.state.samples.map((row) => [row.runner_id, row.at])).toEqual([
      [SHARED, at(-3600).toISOString()], [SHARED, at(-15).toISOString()], [CIA_BOX, at(-7200).toISOString()], [SHARED, T0.toISOString()],
    ]);
  });

  it('refuses a runner someone else registered, and one that does not exist, writing nothing', async () => {
    const w = world();
    expect(await w.service.health(MO, SHARED, REPORT)).toMatchObject({ ok: false, kind: 'forbidden' });
    expect(await w.service.health(OLGA, '00000000-0000-4000-8000-000001830fff', REPORT)).toMatchObject({ ok: false, kind: 'missing' });
    expect(w.state.samples).toEqual([]);
    expect(w.state.runners.every((r) => r.health === null)).toBe(true);
  });

  it('gives the Runners page each runner\'s last health, or null, and its samples of the last hour, oldest first', async () => {
    const health = { ...REPORT, at: at(-15).toISOString() };
    const w = world({
      runners: [runnerRow({ id: SHARED, name: 'shared', health }), runnerRow({ id: CIA_BOX, name: 'cia-box', fleet: 'cia' })],
      samples: [sampleAt(SHARED, -15, 63.5), sampleAt(SHARED, -4000), sampleAt(SHARED, -30, 40), sampleAt(OTHER, -15)],
    });
    const board = value(await w.service.board(MO, RUNNERS[0]?.workspace_id ?? ''));
    const shared = board.runners.find((r) => r.id === SHARED);
    expect(shared?.health).toEqual(health);
    expect(shared?.samples?.map((s) => [s.at, s.cpu])).toEqual([[at(-30).toISOString(), 40], [at(-15).toISOString(), 63.5]]);
    expect(shared?.samples?.[0]).toEqual({ at: at(-30).toISOString(), cpu: 40, memUsed: GB, memTotal: 16 * GB, diskFree: 40 * GB, tokens5h: null });
    expect(board.runners.find((r) => r.id === CIA_BOX)).toMatchObject({ health: null, samples: [] });
  });
});

// The tokens (PRD 2102 s4): a job's report stores the counts its runner sent, and a health report's
// machine tokens of the last 5 hours are kept in the sample as one sum.
describe('a runner\'s tokens (PRD 2102 s4)', () => {
  const GB = 1024 ** 3;
  const COUNTS = { input: 81_234, output: 402_118, cacheRead: 9_120_443, cacheWrite: 611_002 };
  const SUM = 81_234 + 402_118 + 9_120_443 + 611_002;
  const HEALTH = { cpu: 1, load1: 1, cores: 8, memUsed: GB, memTotal: 16 * GB, diskFree: 40 * GB, diskTotal: 80 * GB };

  it('stores the tokens a job report carries, and shows them with the job', async () => {
    const job = jobRow({ status: 'claimed', runner_id: SHARED, claimed_at: T0.toISOString() });
    const w = world({ jobs: [job] });
    value(await w.service.update(OLGA, job.id, { status: 'running', tokens: COUNTS }));
    expect(w.state.jobs[0]?.tokens).toEqual(COUNTS);
    const board = value(await w.service.board(MO, RUNNERS[0]?.workspace_id ?? ''));
    expect(board.jobs.find((j) => j.id === job.id)?.tokens).toEqual(COUNTS);
  });

  it('keeps the last tokens a report carried when a later one carries none, and replaces them with a newer count', async () => {
    const job = jobRow({ status: 'claimed', runner_id: SHARED, claimed_at: T0.toISOString() });
    const w = world({ jobs: [job] });
    value(await w.service.update(OLGA, job.id, { status: 'running', tokens: COUNTS }));
    value(await w.service.update(OLGA, job.id, { status: 'running', logTail: 'working' }));
    expect(w.state.jobs[0]?.tokens).toEqual(COUNTS);
    value(await w.service.update(OLGA, job.id, { status: 'done', tokens: { ...COUNTS, output: 500_000 } }));
    expect(w.state.jobs[0]?.tokens).toEqual({ ...COUNTS, output: 500_000 });
  });

  it('shows a job whose runner never reported tokens with none', async () => {
    const job = jobRow({ status: 'claimed', runner_id: SHARED, claimed_at: T0.toISOString() });
    const w = world({ jobs: [job] });
    value(await w.service.update(OLGA, job.id, { status: 'running' }));
    const board = value(await w.service.board(MO, RUNNERS[0]?.workspace_id ?? ''));
    expect(board.jobs.find((j) => j.id === job.id)?.tokens).toBeNull();
  });

  it('keeps the machine\'s tokens in the runner\'s last health, and the last 5 hours\' sum in the sample', async () => {
    const w = world();
    const tokens = { last5h: COUNTS, today: { ...COUNTS, input: 1 } };
    value(await w.service.health(OLGA, SHARED, { ...HEALTH, tokens }));
    expect(w.state.runners.find((r) => r.id === SHARED)?.health).toEqual({ ...HEALTH, tokens, at: T0.toISOString() });
    expect(w.state.samples[0]?.tokens_5h).toBe(SUM);
  });

  it('stores no sum for a window the runner could not read, nor for a runner that sends no tokens', async () => {
    const w = world();
    value(await w.service.health(OLGA, SHARED, { ...HEALTH, tokens: { last5h: null, today: COUNTS } }));
    w.setNow(at(15));
    value(await w.service.health(OLGA, SHARED, HEALTH));
    expect(w.state.samples.map((row) => row.tokens_5h)).toEqual([null, null]);
  });

  it('gives the page the samples\' sums of the hour, oldest first', async () => {
    const w = world();
    value(await w.service.health(OLGA, SHARED, { ...HEALTH, tokens: { last5h: COUNTS, today: COUNTS } }));
    w.setNow(at(15));
    value(await w.service.health(OLGA, SHARED, { ...HEALTH, tokens: { last5h: { ...COUNTS, input: 0 }, today: COUNTS } }));
    const board = value(await w.service.board(MO, RUNNERS[0]?.workspace_id ?? ''));
    expect(board.runners.find((r) => r.id === SHARED)?.samples?.map((s) => s.tokens5h)).toEqual([SUM, SUM - 81_234]);
  });
});

// A job continued once its answers are in (PRD 2270 s1): `/omni:yolo-fix <n>` queued to the job's runner or
// fleet, by its sender, linked to it; once only, as the unique runner_jobs.continues holds it.
describe('a continuation', () => {
  const PRD = parsePrd(1717);
  const ANSWERED: OutboxStand = { asked: 1, answered: 1, answers: [{ number: 1, letter: 'B' }] };
  const waited = (more: Partial<JobRow> = {}) =>
    jobRow({ status: 'done', outcome: 'answers', runner_id: CIA_BOX, claimed_at: T0.toISOString(), ended_at: at(600).toISOString(), ...more });

  /** The continuation's storage over the fake's jobs: the switch per repository (listed and on unless told
   * otherwise), the PRD's jobs newest first, and the unique `continues` the database holds. */
  function continuations(state: { jobs: JobRow[] }, switches: Record<string, boolean | null> = {}): ContinuationsRepository {
    return {
      fixWhenAnswered: (_workspaceId, repo) => Promise.resolve(repo in switches ? switches[repo] ?? null : true),
      prdJobs: (workspaceId, repo, prd) => Promise.resolve(state.jobs
        .filter((j) => j.workspace_id === workspaceId && j.repo === repo && j.line.includes(` ${String(prd)}`))
        .sort((a, b) => b.queued_at.localeCompare(a.queued_at))
        .map((j) => ({ ...j }))),
      insertContinuation: (job) => {
        if (state.jobs.some((j) => j.continues === job.continues)) return Promise.resolve(null);
        const row = jobRow({
          workspace_id: job.workspaceId, line: job.line, repo: job.repo, to_runner: job.toRunner, to_fleet: job.toFleet, sent_by: job.sentBy,
          sent_by_key: job.sentByKey, continues: job.continues, queued_at: at(900).toISOString(), notify_url: job.notifyUrl ?? null,
        });
        state.jobs.push(row);
        return Promise.resolve({ ...row });
      },
    };
  }

  function continuing(jobs: JobRow[], switches: Record<string, boolean | null> = {}) {
    const { store, state } = fakeStore({ jobs, now: () => at(900) });
    return { state, service: continuationsService(store, continuations(state, switches)) };
  }

  const ask = (stand: OutboxStand | null = ANSWERED) => ({ workspaceId: WORKSPACE, repo: 'Demo-Org/App', prd: PRD, stand });

  it('queues /omni:yolo-fix <n> to the runner the job was sent to, sent by its sender, linked as its continuation', async () => {
    const job = waited({ to_runner: CIA_BOX, sent_by: MO });
    const { service, state } = continuing([job]);
    const done = await service.continueAnswered(ask());
    expect(done).toMatchObject({ queued: { line: '/omni:yolo-fix 1717', repo: 'demo-org/app', toRunner: CIA_BOX, toFleet: null, sentBy: MO, sentByLogin: 'mo', status: 'queued', continues: job.id } });
    expect(state.jobs).toHaveLength(2);
  });

  it('queues it to the fleet the job was sent to, or to any runner when it went to any', async () => {
    const toFleet = continuing([waited({ to_fleet: 'cia', sent_by: MO })]);
    expect(await toFleet.service.continueAnswered(ask())).toMatchObject({ queued: { toRunner: null, toFleet: 'cia' } });
    const toAny = continuing([waited({ sent_by: SAM })]);
    expect(await toAny.service.continueAnswered(ask())).toMatchObject({ queued: { toRunner: null, toFleet: null, sentBy: SAM } });
  });

  it('keeps the API key that sent the job as its sender, and links the continuation to it (PRD 2425 s6)', async () => {
    const job = waited({ sent_by: OLGA, sent_by_key: API_KEY });
    const { service, state } = continuing([job]);
    const done = await service.continueAnswered(ask());
    expect(done).toMatchObject({ queued: { sentBy: OLGA, sentByKey: 'QA dashboard', continues: job.id } });
    expect(state.jobs.find((j) => j.continues === job.id)).toMatchObject({ sent_by: OLGA, sent_by_key: API_KEY, continues: job.id });
  });

  it('keeps the link a key\'s job is pinged at, so the thread\'s next job pings it too (PRD 2425 s8)', async () => {
    const job = waited({ sent_by: OLGA, sent_by_key: API_KEY, notify_url: 'https://hooks.example.com/omni' });
    const { service, state } = continuing([job]);
    expect(await service.continueAnswered(ask())).toMatchObject({ queued: { continues: job.id } });
    expect(state.jobs.find((j) => j.continues === job.id)).toMatchObject({ sent_by_key: API_KEY, notify_url: 'https://hooks.example.com/omni' });
  });

  it('keeps no link for a fix a person presses, which is no longer the key\'s job, and none for a job that had none', async () => {
    const link = waited({ sent_by: OLGA, sent_by_key: API_KEY, notify_url: 'https://hooks.example.com/omni' });
    const pressed = continuing([link], { 'demo-org/app': false });
    expect(await pressed.service.continueAnswered({ ...ask(), by: MO })).toMatchObject({ queued: { sentByKey: null } });
    expect(pressed.state.jobs.find((j) => j.continues === link.id)).toMatchObject({ sent_by_key: null, notify_url: null });
    const plain = continuing([waited({ sent_by: OLGA, sent_by_key: API_KEY })]);
    await plain.service.continueAnswered(ask());
    expect(plain.state.jobs[1]).toMatchObject({ sent_by_key: API_KEY, notify_url: null });
    const person = continuing([waited({ sent_by: MO })]);
    await person.service.continueAnswered(ask());
    expect(person.state.jobs[1]).toMatchObject({ sent_by_key: null, notify_url: null });
  });

  it('queues once: a second continuation of the same job is refused by the unique column, and two touches at once queue one fix', async () => {
    const job = waited({ to_fleet: 'cia' });
    const { service, state } = continuing([job]);
    const both = await Promise.all([service.continueAnswered(ask()), service.continueAnswered(ask())]);
    expect(both.filter((done) => done.queued !== null)).toHaveLength(1);
    expect(both.find((done) => done.queued === null)).toEqual({ queued: null, why: `job ${job.id} was continued already` });
    expect(state.jobs.filter((j) => j.continues === job.id)).toHaveLength(1);
    expect(await service.continueAnswered(ask())).toMatchObject({ queued: null });
    expect(state.jobs).toHaveLength(2);
  });

  it('queues nothing, and reads nothing, while an asked item waits for a counted reply', async () => {
    const { store, state } = fakeStore({ jobs: [waited()] });
    const read: string[] = [];
    const port = continuations(state);
    const service = continuationsService(store, { ...port, prdJobs: (...args) => { read.push('jobs'); return port.prdJobs(...args); } });
    expect(await service.continueAnswered(ask({ asked: 2, answered: 1, answers: [] }))).toEqual({ queued: null, why: '1 of 2 asked items answered' });
    expect(await service.continueAnswered(ask(null))).toMatchObject({ queued: null });
    expect(read).toEqual([]);
    expect(state.jobs).toHaveLength(1);
  });

  it('queues nothing with the switch off, or for a repository the workspace does not list', async () => {
    expect(await continuing([waited()], { 'demo-org/app': false }).service.continueAnswered(ask())).toEqual({ queued: null, why: 'Fix on a runner once answered is off for this repository' });
    expect(await continuing([waited()], { 'demo-org/app': null }).service.continueAnswered(ask())).toMatchObject({ queued: null });
  });

  it('queues nothing in its sender\'s name once they may no longer send there', async () => {
    // Pia plays in pirates: the runner cia-box serves cia.
    const pirate = await continuing([waited({ to_runner: CIA_BOX, sent_by: PIA })]).service.continueAnswered(ask());
    expect(pirate.queued).toBeNull();
    expect(pirate.why).toContain('serves cia');
    // Eve is no member of this workspace.
    expect(await continuing([waited({ sent_by: EVE })]).service.continueAnswered(ask())).toEqual({ queued: null, why: 'its sender is no longer a member of the workspace, or the Omni app sent it' });
    // The Omni app sent it (PRD 2338): no person to send the fix in the name of.
    expect(await continuing([waited({ sent_by: null, sent_by_app: 'omni-app' })]).service.continueAnswered(ask())).toEqual({ queued: null, why: 'its sender is no longer a member of the workspace, or the Omni app sent it' });
  });

  it('queues nothing while a job of the PRD is queued or running, or when the newest did not wait on answers', async () => {
    const running = jobRow({ line: '/omni:pr-care 1717', status: 'running', runner_id: SHARED, queued_at: at(700).toISOString() });
    expect(await continuing([waited(), running]).service.continueAnswered(ask())).toEqual({ queued: null, why: 'a job of PRD 1717 is running' });
    const held = await continuing([waited({ outcome: 'held' })]).service.continueAnswered(ask());
    expect(held.queued).toBeNull();
    expect(held.why).toContain('did not end on Waiting on answers');
  });

  it('queues the fix in the name of the person pressing Fix with answers, with the switch off, to where the job went (PRD 2270 s2)', async () => {
    const job = waited({ to_runner: CIA_BOX, sent_by: OLGA, sent_by_key: API_KEY });
    const { service, state } = continuing([job], { 'demo-org/app': false });
    expect(await service.continueAnswered({ ...ask(), by: MO })).toMatchObject({ queued: { line: '/omni:yolo-fix 1717', toRunner: CIA_BOX, sentBy: MO, sentByKey: null, continues: job.id } });
    expect(await service.continueAnswered({ ...ask(), by: MO })).toMatchObject({ queued: null });
    expect(state.jobs).toHaveLength(2);
  });

  it('refuses Fix with answers to someone who is no member of the workspace, and while an asked item waits', async () => {
    const { service, state } = continuing([waited()], { 'demo-org/app': false });
    expect(await service.continueAnswered({ ...ask(), by: EVE })).toEqual({ queued: null, why: 'you are not a member of this workspace' });
    expect(await service.continueAnswered({ ...ask({ asked: 2, answered: 1, answers: [] }), by: MO })).toMatchObject({ queued: null });
    expect(state.jobs).toHaveLength(1);
  });
});

// PRD 2251 s1: the terminal reads, with its own sign-in, the runners and a PRD's jobs of the workspace
// its repository belongs to; a person outside that workspace reads none.
describe('the terminal\'s reads (PRD 2251)', () => {
  const PRD = PrdNumberSchema.parse(2251);
  const THEIRS = '00000000-0000-4000-8000-000001830002';

  describe('the runners', () => {
    it('lists the workspace\'s runners with their state, slots used, slots, fleet and repositories', async () => {
      const running = jobRow({ status: 'running', runner_id: SHARED, claimed_at: T0.toISOString(), running_at: T0.toISOString() });
      const w = world({ jobs: [running] });
      expect(value(await w.service.runnersFor(PIA, 'demo-org/app'))).toEqual([
        { id: CIA_BOX, name: 'cia-box', fleet: 'cia', state: 'online', used: 0, slots: 4, repos: ['demo-org/app'] },
        { id: OTHER, name: 'other', fleet: null, state: 'online', used: 0, slots: 4, repos: ['demo-org/other'] },
        { id: SHARED, name: 'shared', fleet: null, state: 'busy', used: 1, slots: 1, repos: ['demo-org/app'] },
      ]);
    });

    it('reads a repository named in capitals as GitHub does', async () => {
      expect(value(await world().service.runnersFor(MO, 'Demo-Org/App'))).toHaveLength(3);
    });

    it('marks a silent runner offline, and its running job lost', async () => {
      const running = jobRow({ status: 'running', runner_id: CIA_BOX, claimed_at: T0.toISOString(), running_at: T0.toISOString() });
      const w = world({ jobs: [running], start: at(91) });
      const runners = value(await w.service.runnersFor(MO, 'demo-org/app'));
      expect(runners.map((r) => [r.name, r.state, r.used])).toEqual([['cia-box', 'offline', 0], ['other', 'offline', 0], ['shared', 'offline', 0]]);
      expect(w.state.jobs[0]).toMatchObject({ status: 'failed', reason: 'runner lost' });
    });

    it('is refused to a person outside the workspace, and for a repository no workspace of theirs holds', async () => {
      const w = world();
      expect(await w.service.runnersFor(EVE, 'demo-org/app')).toMatchObject({ ok: false, kind: 'forbidden' });
      expect(await w.service.runnersFor(MO, 'elsewhere/app')).toMatchObject({ ok: false, kind: 'forbidden' });
      expect(await w.service.runnersFor(MO, 'nobody/app')).toMatchObject({ ok: false, kind: 'forbidden' });
    });

    it('never answers another workspace\'s runners, even to its own member', async () => {
      const theirs = runnerRow({ id: '00000000-0000-4000-8000-0000018301d1', name: 'theirs', workspace_id: THEIRS, owner: EVE, repos: ['elsewhere/app'] });
      const w = world({ runners: [...RUNNERS, theirs] });
      expect(value(await w.service.runnersFor(MO, 'demo-org/app')).map((r) => r.name)).toEqual(['cia-box', 'other', 'shared']);
      expect(value(await w.service.runnersFor(EVE, 'elsewhere/app')).map((r) => r.name)).toEqual(['theirs']);
    });
  });

  describe('a PRD\'s jobs', () => {
    it('answers the PRD\'s jobs in the repository, newest first, with their runner by name', async () => {
      const older = jobRow({
        line: '/omni:yolo 2251', status: 'done', runner_id: SHARED, outcome: 'answers', pr_url: 'https://github.com/demo-org/app/pull/7', exit_code: 0,
        queued_at: at(-600).toISOString(), claimed_at: at(-599).toISOString(), ended_at: at(-60).toISOString(),
      });
      const newer = jobRow({ line: '/omni:yolo-fix 2251', status: 'running', runner_id: CIA_BOX, queued_at: at(-30).toISOString(), claimed_at: at(-29).toISOString(), running_at: at(-28).toISOString() });
      const queued = jobRow({ line: '/omni:pr-care 2251 --once', queued_at: at(-5).toISOString() });
      const w = world({ jobs: [older, newer, queued] });
      expect(value(await w.service.prdJobs(MO, 'demo-org/app', PRD))).toEqual([
        {
          id: queued.id, line: '/omni:pr-care 2251 --once', repo: 'demo-org/app', status: 'queued', runner: null, prUrl: null, exitCode: null, reason: null,
          outcome: null, queuedAt: at(-5).toISOString(), claimedAt: null, runningAt: null, endedAt: null,
        },
        {
          id: newer.id, line: '/omni:yolo-fix 2251', repo: 'demo-org/app', status: 'running', runner: 'cia-box', prUrl: null, exitCode: null, reason: null,
          outcome: null, queuedAt: at(-30).toISOString(), claimedAt: at(-29).toISOString(), runningAt: at(-28).toISOString(), endedAt: null,
        },
        {
          id: older.id, line: '/omni:yolo 2251', repo: 'demo-org/app', status: 'done', runner: 'shared', prUrl: 'https://github.com/demo-org/app/pull/7', exitCode: 0,
          reason: null, outcome: 'answers', queuedAt: at(-600).toISOString(), claimedAt: at(-599).toISOString(), runningAt: null, endedAt: at(-60).toISOString(),
        },
      ]);
    });

    it('leaves out a job whose line names another PRD, or none, and a job of another repository', async () => {
      const mine = jobRow({ line: '/omni:yolo 2251' });
      const w = world({ jobs: [
        mine, jobRow({ line: '/omni:yolo 22510' }), jobRow({ line: '/omni:yolo 225' }), jobRow({ line: '/omni:wave' }),
        jobRow({ line: '/omni:bug-fix https://github.com/demo-org/app/issues/2251' }), jobRow({ line: '/omni:yolo 2251', repo: 'demo-org/other' }),
      ] });
      expect(value(await w.service.prdJobs(MO, 'demo-org/app', PRD)).map((job) => job.id)).toEqual([mine.id]);
    });

    it('answers a job its silent runner lost as failed, runner lost', async () => {
      const running = jobRow({ line: '/omni:yolo 2251', status: 'running', runner_id: CIA_BOX, claimed_at: T0.toISOString(), running_at: T0.toISOString() });
      const w = world({ jobs: [running], start: at(91) });
      expect(value(await w.service.prdJobs(MO, 'demo-org/app', PRD))).toMatchObject([{ status: 'failed', reason: 'runner lost', runner: 'cia-box' }]);
    });

    it('answers none when the PRD has no job yet', async () => {
      expect(value(await world({ jobs: [jobRow({ line: '/omni:yolo 1717' })] }).service.prdJobs(MO, 'demo-org/app', PRD))).toEqual([]);
    });

    it('is refused to a person outside the workspace, and never reads another workspace\'s jobs', async () => {
      const theirs = jobRow({ line: '/omni:yolo 2251', workspace_id: THEIRS, repo: 'elsewhere/app', sent_by: EVE });
      const w = world({ jobs: [jobRow({ line: '/omni:yolo 2251' }), theirs] });
      expect(await w.service.prdJobs(EVE, 'demo-org/app', PRD)).toMatchObject({ ok: false, kind: 'forbidden' });
      expect(await w.service.prdJobs(MO, 'elsewhere/app', PRD)).toMatchObject({ ok: false, kind: 'forbidden' });
      expect(value(await w.service.prdJobs(EVE, 'elsewhere/app', PRD)).map((job) => job.id)).toEqual([theirs.id]);
    });
  });
});

// PRD 2255 s1: a running job asks a person on its job, ends `done` with its questions open and reads
// Need human, and the first person of the workspace to answer queues the run that resumes it.
describe('a job\'s questions (PRD 2255)', () => {
  const ASK = { issue: parseIssue(314), lead: 'The planning query fails for 31 tenants.', questions: [QUESTION] };
  const ANSWERS = { 'Which fix?': 'Guard the input' };
  const times = { claimed_at: T0.toISOString(), running_at: T0.toISOString() };
  /** A bug fix running on the shared runner, which Olga owns, sent by Olga to the fleet cia. */
  const running = (more: Partial<JobRow> = {}) => jobRow({ status: 'running', runner_id: SHARED, line: '/omni:bug-fix #314', sent_by: OLGA, to_fleet: 'cia', ...times, ...more });
  /** The same job, ended `done` with its questions open: Need human. */
  const waiting = (more: Partial<JobRow> = {}) => running({ status: 'done', outcome: 'human', ended_at: T0.toISOString(), ...more });

  describe('asking', () => {
    it('stores the questions of a running job, from the owner of its runner, and reads them back open', async () => {
      const job = running();
      const w = world({ jobs: [job] });
      const asked = value(await w.service.ask(OLGA, job.id, ASK));
      expect(w.state.questions).toEqual([questionsRow({ job_id: job.id, issue: ASK.issue, lead: ASK.lead, questions: ASK.questions })]);
      expect(asked).toEqual({
        job: job.id, issue: 314, lead: ASK.lead, questions: [QUESTION], state: 'open', answers: null, by: null, byLogin: null, byKey: null, actingFor: null, at: null, resume: null,
      });
    });

    it('is refused to anyone but the owner of the job\'s runner, for a job nobody knows, and for one that is not running', async () => {
      const [job, queued, claimed, done] = [running(), jobRow({ ...times }), running({ status: 'claimed', running_at: null }), waiting({ outcome: null })];
      const w = world({ jobs: [job, queued, claimed, done] });
      expect(await w.service.ask(MO, job.id, ASK)).toMatchObject({ ok: false, kind: 'forbidden' });
      expect(await w.service.ask(OLGA, '00000000-0000-4000-8000-0000022559f9', ASK)).toMatchObject({ ok: false, kind: 'missing' });
      for (const notRunning of [queued, claimed, done]) {
        expect(await w.service.ask(OLGA, notRunning.id, ASK)).toMatchObject({ ok: false, kind: notRunning === queued ? 'forbidden' : 'conflict' });
      }
      expect(w.state.questions).toEqual([]);
    });

    it('says in words that a job that is not running cannot ask', async () => {
      const done = waiting({ outcome: null });
      const w = world({ jobs: [done] });
      expect(await w.service.ask(OLGA, done.id, ASK)).toEqual({ ok: false, kind: 'conflict', error: 'This job is done: only a running job asks.' });
    });

    it('takes the questions of a job once: a second ask is refused and changes nothing', async () => {
      const job = running();
      const w = world({ jobs: [job] });
      value(await w.service.ask(OLGA, job.id, ASK));
      const again = await w.service.ask(OLGA, job.id, { ...ASK, lead: 'Another lead.' });
      expect(again).toEqual({ ok: false, kind: 'conflict', error: 'This job asked its questions already.' });
      expect(w.state.questions).toHaveLength(1);
      expect(w.state.questions[0]?.lead).toBe(ASK.lead);
    });
  });

  describe('ending', () => {
    it('stores the outcome human on a job reported done with its questions open, whatever outcome the report carried', async () => {
      const plain = running();
      const yolo = running();
      const w = world({ jobs: [plain, yolo], questions: [questionsRow({ job_id: plain.id }), questionsRow({ job_id: yolo.id })] });
      value(await w.service.update(OLGA, plain.id, { status: 'done', exitCode: 0 }));
      value(await w.service.update(OLGA, yolo.id, { status: 'done', exitCode: 0, outcome: 'answers' }));
      expect(w.state.jobs.map((j) => [j.status, j.outcome])).toEqual([['done', 'human'], ['done', 'human']]);
    });

    it('stores none on a failed or cancelled job that asked, and none when the questions were closed before it ended', async () => {
      const failed = running();
      const cancelled = running();
      const answeredEarly = running();
      const w = world({
        jobs: [failed, cancelled, answeredEarly],
        questions: [questionsRow({ job_id: failed.id }), questionsRow({ job_id: cancelled.id }), questionsRow({ job_id: answeredEarly.id, answers: ANSWERS, closed_by: MO, closed_at: T0.toISOString() })],
      });
      value(await w.service.update(OLGA, failed.id, { status: 'failed', exitCode: 1 }));
      value(await w.service.update(OLGA, cancelled.id, { status: 'cancelled' }));
      value(await w.service.update(OLGA, answeredEarly.id, { status: 'done', exitCode: 0 }));
      for (const job of w.state.jobs) expect(job.outcome ?? null).toBeNull();
    });

    it('keeps the outcome a job without questions reports', async () => {
      const job = running();
      const w = world({ jobs: [job] });
      value(await w.service.update(OLGA, job.id, { status: 'done', exitCode: 0, outcome: 'held' }));
      expect(w.state.jobs[0]?.outcome).toBe('held');
    });
  });

  describe('reading', () => {
    it('is open to any member of the workspace, a person or a runner\'s owner, and reads the questions open', async () => {
      const job = waiting();
      const w = world({ jobs: [job], questions: [questionsRow({ job_id: job.id })] });
      for (const reader of [MO, OLGA, SAM]) {
        expect(value(await w.service.questions(reader, job.id))).toMatchObject({ job: job.id, state: 'open', questions: [QUESTION], lead: ASK.lead, issue: 314 });
      }
    });

    it('reads a member of another workspace no question, as a job nobody knows, and says when a job asked none', async () => {
      const job = waiting();
      const quiet = running();
      const w = world({ jobs: [job, quiet], questions: [questionsRow({ job_id: job.id })] });
      expect(await w.service.questions(EVE, job.id)).toEqual({ ok: false, kind: 'missing', error: 'No such job.' });
      expect(await w.service.questions(MO, '00000000-0000-4000-8000-0000022559f9')).toMatchObject({ ok: false, kind: 'missing' });
      expect(await w.service.questions(MO, quiet.id)).toEqual({ ok: false, kind: 'missing', error: 'This job asked no question.' });
    });

    it('reads an answered row with its answers, who answered by id and login, when, and the job that resumes it', async () => {
      const job = waiting();
      const resume = '00000000-0000-4000-8000-0000022552c1';
      const w = world({ jobs: [job], questions: [questionsRow({ job_id: job.id, answers: ANSWERS, closed_by: MO, closed_at: '2026-10-13T12:05:00.000Z', resume_job: resume })] });
      expect(value(await w.service.questions(OLGA, job.id))).toMatchObject({ state: 'answered', answers: ANSWERS, by: MO, byLogin: 'mo', at: '2026-10-13T12:05:00.000Z', resume });
    });

    it('reads a dismissed row with no answers and no resume job', async () => {
      const job = waiting();
      const w = world({ jobs: [job], questions: [questionsRow({ job_id: job.id, closed_by: SAM, closed_at: '2026-10-13T12:05:00.000Z' })] });
      expect(value(await w.service.questions(OLGA, job.id))).toMatchObject({ state: 'dismissed', answers: null, by: SAM, byLogin: null, resume: null });
    });
  });

  describe('answering', () => {
    it('queues the resume line to the first job\'s repository and target, sent by the answerer, and stores the answers once', async () => {
      const job = waiting();
      const w = world({ jobs: [job], questions: [questionsRow({ job_id: job.id })] });
      const resume = value(await w.service.answer(MO, job.id, { answers: ANSWERS }));
      expect(resume).toMatchObject({ line: `/omni:bug-fix #314 --answers ${job.id}`, repo: 'demo-org/app', toRunner: null, toFleet: 'cia', sentBy: MO, sentByLogin: 'mo', status: 'queued' });
      expect(w.state.jobs.map((j) => j.id)).toEqual([job.id, resume.id]);
      expect(w.state.questions[0]).toMatchObject({ answers: ANSWERS, closed_by: MO, closed_at: T0.toISOString(), resume_job: resume.id });
    });

    it('sends the resume to the runner the first job went to', async () => {
      const job = waiting({ to_fleet: null, to_runner: CIA_BOX });
      const w = world({ jobs: [job], questions: [questionsRow({ job_id: job.id })] });
      expect(value(await w.service.answer(OLGA, job.id, { answers: ANSWERS }))).toMatchObject({ toRunner: CIA_BOX, toFleet: null });
    });

    it('keeps the skill of the first job: a mega bug fix resumes as one', async () => {
      const job = waiting({ line: '/omni:mega-bug-fix #314' });
      const w = world({ jobs: [job], questions: [questionsRow({ job_id: job.id })] });
      expect(value(await w.service.answer(MO, job.id, { answers: ANSWERS })).line).toBe(`/omni:mega-bug-fix #314 --answers ${job.id}`);
    });

    it('gives the first answer the job: a second reads who answered, and queues and stores nothing', async () => {
      const job = waiting();
      const w = world({ jobs: [job], questions: [questionsRow({ job_id: job.id })] });
      value(await w.service.answer(MO, job.id, { answers: ANSWERS }));
      const second = await w.service.answer(OLGA, job.id, { answers: { 'Which fix?': 'Design it first' } });
      expect(second).toEqual({ ok: false, kind: 'conflict', error: 'Already answered by @mo' });
      expect(w.state.jobs).toHaveLength(2);
      expect(w.state.questions[0]).toMatchObject({ answers: ANSWERS, closed_by: MO });
    });

    it('reads a dismissed row as dismissed, by whom, and queues nothing', async () => {
      const job = waiting();
      const w = world({ jobs: [job], questions: [questionsRow({ job_id: job.id })] });
      value(await w.service.dismiss(OLGA, job.id));
      expect(await w.service.answer(MO, job.id, { answers: ANSWERS })).toEqual({ ok: false, kind: 'conflict', error: 'Dismissed by @olga' });
      expect(w.state.jobs).toHaveLength(1);
    });

    it('names a person with no GitHub login as someone', async () => {
      // Sam plays in no fleet: the job went to any runner.
      const job = waiting({ to_fleet: null });
      const w = world({ jobs: [job], questions: [questionsRow({ job_id: job.id })] });
      value(await w.service.answer(SAM, job.id, { answers: ANSWERS }));
      expect(await w.service.answer(MO, job.id, { answers: ANSWERS })).toMatchObject({ error: 'Already answered by someone' });
    });

    it('needs one answer to each question and no other: nothing is queued or stored otherwise', async () => {
      const job = waiting();
      const two = { ...QUESTION, question: 'And the tests?' };
      const w = world({ jobs: [job], questions: [questionsRow({ job_id: job.id, questions: [QUESTION, two] })] });
      for (const answers of [ANSWERS, { ...ANSWERS, 'Why?': 'because' }, { 'Which fix?': 'Guard the input', 'Another?': 'yes' }]) {
        expect(await w.service.answer(MO, job.id, { answers })).toEqual({ ok: false, kind: 'malformed', error: 'Answer each question once, and only the ones asked.' });
      }
      expect(w.state.jobs).toHaveLength(1);
      expect(w.state.questions[0]?.closed_at).toBeNull();
      value(await w.service.answer(MO, job.id, { answers: { ...ANSWERS, 'And the tests?': 'Add one' } }));
    });

    it('is a job nobody knows to a member of another workspace, and one without questions', async () => {
      const job = waiting();
      const quiet = waiting();
      const w = world({ jobs: [job, quiet], questions: [questionsRow({ job_id: job.id })] });
      expect(await w.service.answer(EVE, job.id, { answers: ANSWERS })).toEqual({ ok: false, kind: 'missing', error: 'No such job.' });
      expect(await w.service.answer(MO, quiet.id, { answers: ANSWERS })).toEqual({ ok: false, kind: 'missing', error: 'This job asked no question.' });
      expect(w.state.jobs).toHaveLength(2);
    });

    it('is refused for a job that is not waiting: still running, or ended without asking for a human', async () => {
      const stillRunning = running();
      const failed = waiting({ status: 'failed', outcome: null });
      const w = world({ jobs: [stillRunning, failed], questions: [questionsRow({ job_id: stillRunning.id }), questionsRow({ job_id: failed.id })] });
      for (const job of [stillRunning, failed]) {
        expect(await w.service.answer(MO, job.id, { answers: ANSWERS })).toEqual({ ok: false, kind: 'conflict', error: 'This job is not waiting for an answer.' });
      }
      expect(w.state.jobs).toHaveLength(2);
    });

    it('checks the target as a person\'s Send does: a fleet\'s runner is for its players and the owners, and nothing is stored', async () => {
      const toPirates = waiting({ to_fleet: 'pirates' });
      const toCiaBox = waiting({ to_fleet: null, to_runner: CIA_BOX });
      const w = world({ jobs: [toPirates, toCiaBox], questions: [questionsRow({ job_id: toPirates.id }), questionsRow({ job_id: toCiaBox.id })] });
      expect(await w.service.answer(MO, toPirates.id, { answers: ANSWERS })).toEqual({ ok: false, kind: 'forbidden', error: 'Only the players of pirates and the workspace\'s owners send to its runners.' });
      expect(await w.service.answer(PIA, toCiaBox.id, { answers: ANSWERS })).toMatchObject({ ok: false, kind: 'forbidden', error: expect.stringContaining('cia-box serves cia') as string });
      expect(w.state.jobs).toHaveLength(2);
      expect(w.state.questions.every((q) => q.closed_at === null)).toBe(true);
      // The workspace's owner, and a player of the fleet, answer.
      value(await w.service.answer(OLGA, toPirates.id, { answers: ANSWERS }));
      value(await w.service.answer(MO, toCiaBox.id, { answers: ANSWERS }));
    });

    it('checks the repository as a person\'s Send does: one that left the workspace is refused, and nothing is stored', async () => {
      const job = waiting({ repo: 'elsewhere/app' });
      const w = world({ jobs: [job], questions: [questionsRow({ job_id: job.id })] });
      expect(await w.service.answer(MO, job.id, { answers: ANSWERS })).toMatchObject({ ok: false, kind: 'forbidden' });
      expect(w.state.jobs).toHaveLength(1);
      expect(w.state.questions[0]?.closed_at).toBeNull();
    });

    it('checks the resume line as a person\'s Send does: a first job that is no listed skill is refused, and nothing is stored', async () => {
      const job = waiting({ line: '/omni:nope #314' });
      const w = world({ jobs: [job], questions: [questionsRow({ job_id: job.id })] });
      expect(await w.service.answer(MO, job.id, { answers: ANSWERS })).toMatchObject({ ok: false, kind: 'malformed' });
      expect(w.state.jobs).toHaveLength(1);
    });
  });

  describe('a repository skill\'s job (PRD 2313)', () => {
    const own = () => waiting({ line: '/validate-prd 347' });

    it('is never resumed by answers: it is refused, and nothing is stored or queued', async () => {
      const job = own();
      const w = world({ jobs: [job], questions: [questionsRow({ job_id: job.id })], skills: [{ workspace_id: WORKSPACE, full_name: 'demo-org/app', skill: 'validate-prd' }] });
      expect(await w.service.answer(MO, job.id, { answers: ANSWERS })).toEqual({
        ok: false, kind: 'malformed', error: '/validate-prd is a repository\'s own skill: its questions can only be dismissed.',
      });
      expect(w.state.jobs).toHaveLength(1);
      expect(w.state.questions[0]?.closed_at).toBeNull();
    });

    it('has its questions dismissed as any job\'s', async () => {
      const job = own();
      const w = world({ jobs: [job], questions: [questionsRow({ job_id: job.id })] });
      expect(value(await w.service.dismiss(MO, job.id))).toMatchObject({ job: job.id, state: 'dismissed', by: MO });
    });
  });

  describe('dismissing', () => {
    it('closes the row with no answers and queues no job, and reads who dismissed it', async () => {
      const job = waiting();
      const w = world({ jobs: [job], questions: [questionsRow({ job_id: job.id })] });
      const closed = value(await w.service.dismiss(MO, job.id));
      expect(closed).toMatchObject({ job: job.id, state: 'dismissed', answers: null, by: MO, byLogin: 'mo', at: T0.toISOString(), resume: null });
      expect(w.state.jobs).toHaveLength(1);
    });

    it('is open to any member of the workspace, to one only once, and to no one outside it', async () => {
      const job = waiting();
      const w = world({ jobs: [job], questions: [questionsRow({ job_id: job.id })] });
      expect(await w.service.dismiss(EVE, job.id)).toEqual({ ok: false, kind: 'missing', error: 'No such job.' });
      value(await w.service.dismiss(PIA, job.id));
      expect(await w.service.dismiss(MO, job.id)).toEqual({ ok: false, kind: 'conflict', error: 'Dismissed by @pia' });
    });

    it('reads an answered row as answered, by whom', async () => {
      const job = waiting();
      const w = world({ jobs: [job], questions: [questionsRow({ job_id: job.id })] });
      value(await w.service.answer(MO, job.id, { answers: ANSWERS }));
      expect(await w.service.dismiss(OLGA, job.id)).toEqual({ ok: false, kind: 'conflict', error: 'Already answered by @mo' });
    });

    it('is refused for a job without questions and for one that is not waiting', async () => {
      const quiet = waiting();
      const failed = waiting({ status: 'failed', outcome: null });
      const w = world({ jobs: [quiet, failed], questions: [questionsRow({ job_id: failed.id })] });
      expect(await w.service.dismiss(MO, quiet.id)).toEqual({ ok: false, kind: 'missing', error: 'This job asked no question.' });
      expect(await w.service.dismiss(MO, failed.id)).toEqual({ ok: false, kind: 'conflict', error: 'This job is not waiting for an answer.' });
    });
  });

  // Two people answering at once: both pass the checks, one finds the row closed by the database, which locks it.
  describe('when the database refuses after the checks', () => {
    const racing = (refusal: 'none' | 'closed' | 'stranger' | 'mismatch') => {
      const job = waiting();
      const { store } = fakeStore({ jobs: [job], questions: [questionsRow({ job_id: job.id })], now: () => T0 });
      const refusing = { ...store, answer: () => Promise.resolve({ ok: false as const, refusal }), dismiss: () => Promise.resolve({ ok: false as const, refusal }) };
      return { job, service: runnersService(refusing, { now: () => T0, sleep: () => Promise.resolve() }) };
    };

    it.each([
      ['none', 'missing', 'This job asked no question.'],
      ['stranger', 'forbidden', 'You are not a member of this workspace.'],
      ['mismatch', 'malformed', 'Answer each question once, and only the ones asked.'],
      ['closed', 'conflict', 'This job is not waiting for an answer.'],
    ] as const)('reads %s as %s: %s', async (refusal, kind, error) => {
      const { job, service } = racing(refusal);
      expect(await service.answer(MO, job.id, { answers: ANSWERS })).toEqual({ ok: false, kind, error });
      expect(await service.dismiss(MO, job.id)).toEqual({ ok: false, kind, error });
    });

    it('names who closed the row when the other person won the race', async () => {
      const job = waiting();
      const { store } = fakeStore({ jobs: [job], questions: [questionsRow({ job_id: job.id })], now: () => T0 });
      // The row reads open to the checks, and closed by Pia when the function refuses.
      let reads = 0;
      const closing = {
        ...store,
        questionsOf: async (id: string) => {
          const row = await store.questionsOf(id);
          reads += 1;
          return row && reads > 1 ? { ...row, answers: ANSWERS, closed_by: PIA, closed_at: T0.toISOString() } : row;
        },
        answer: () => Promise.resolve({ ok: false as const, refusal: 'closed' as const }),
      };
      const service = runnersService(closing, { now: () => T0, sleep: () => Promise.resolve() });
      expect(await service.answer(MO, job.id, { answers: ANSWERS })).toEqual({ ok: false, kind: 'conflict', error: 'Already answered by @pia' });
    });
  });

  describe('on the Runners page', () => {
    it('reads a job that ended with its questions open as human, and as Done once they are answered or dismissed', async () => {
      const open = waiting();
      const answered = waiting();
      const dismissed = waiting();
      const w = world({ jobs: [open, answered, dismissed], questions: [questionsRow({ job_id: open.id }), questionsRow({ job_id: answered.id }), questionsRow({ job_id: dismissed.id })] });
      value(await w.service.answer(MO, answered.id, { answers: ANSWERS }));
      value(await w.service.dismiss(MO, dismissed.id));
      const board = value(await w.service.board(PIA, WORKSPACE));
      expect(board.jobs.filter((j) => [open.id, answered.id, dismissed.id].includes(j.id)).map((j) => [j.id, j.status, j.outcome])).toEqual([
        [open.id, 'done', 'human'], [answered.id, 'done', null], [dismissed.id, 'done', null],
      ]);
      // The queued resume job is on the board too.
      expect(board.jobs.find((j) => j.line === `/omni:bug-fix #314 --answers ${answered.id}`)).toMatchObject({ status: 'queued', outcome: null });
    });

    it('keeps a job waiting for an answer on the board whatever its age: past the last 50 ended jobs', async () => {
      const old = waiting({ ended_at: new Date(T0.getTime() - 86_400_000).toISOString() });
      const ended = Array.from({ length: ENDED_JOBS_SHOWN }, (_, i) => jobRow({ status: 'done', runner_id: SHARED, ended_at: at(-i).toISOString() }));
      const w = world({ jobs: [old, ...ended], questions: [questionsRow({ job_id: old.id })] });
      const board = value(await w.service.board(PIA, WORKSPACE));
      expect(board.jobs).toHaveLength(ENDED_JOBS_SHOWN + 1);
      expect(board.jobs.find((j) => j.id === old.id)).toMatchObject({ status: 'done', outcome: 'human' });
      // Newest ended first, the old one last among them.
      expect(board.jobs.at(-1)?.id).toBe(old.id);
    });

    it('lists a waiting job once when it is among the last 50 as well', async () => {
      const job = waiting();
      const w = world({ jobs: [job], questions: [questionsRow({ job_id: job.id })] });
      expect(value(await w.service.board(PIA, WORKSPACE)).jobs.map((j) => j.id)).toEqual([job.id]);
    });

    it('does not keep an old job on the board for questions nobody can answer: a failed job that asked, or one answered', async () => {
      const failed = waiting({ status: 'failed', outcome: null, ended_at: new Date(T0.getTime() - 86_400_000).toISOString() });
      const answered = waiting({ ended_at: new Date(T0.getTime() - 86_400_000).toISOString() });
      const ended = Array.from({ length: ENDED_JOBS_SHOWN }, (_, i) => jobRow({ status: 'done', runner_id: SHARED, ended_at: at(-i).toISOString() }));
      const w = world({
        jobs: [failed, answered, ...ended],
        questions: [questionsRow({ job_id: failed.id }), questionsRow({ job_id: answered.id, answers: ANSWERS, closed_by: MO, closed_at: T0.toISOString() })],
      });
      const board = value(await w.service.board(PIA, WORKSPACE));
      expect(board.jobs.map((j) => j.id)).not.toContain(failed.id);
      expect(board.jobs.map((j) => j.id)).not.toContain(answered.id);
    });
  });
});

// PRD 2375 s3: a done job's last report may say it stopped mid-way, with the slices merged out of all.
describe('a job stopped mid-way (PRD 2375)', () => {
  const running = () => jobRow({ status: 'running', runner_id: SHARED, claimed_at: T0.toISOString(), running_at: T0.toISOString() });

  it('stores the outcome stopped and its count with a done report', async () => {
    const job = running();
    const w = world({ jobs: [job] });
    value(await w.service.update(OLGA, job.id, { status: 'done', exitCode: 0, outcome: 'stopped', slicesMerged: 0, slicesTotal: 5 }));
    expect(w.state.jobs[0]).toMatchObject({ status: 'done', outcome: 'stopped', slices_merged: 0, slices_total: 5 });
  });

  it('stores no count for a report that carries none, and none on a failed report', async () => {
    const job = running();
    const w = world({ jobs: [job] });
    value(await w.service.update(OLGA, job.id, { status: 'done', exitCode: 0, outcome: 'stopped' }));
    expect(w.state.jobs[0]).toMatchObject({ outcome: 'stopped' });
    expect(w.state.jobs[0]).not.toHaveProperty('slices_merged');
    const other = running();
    const w2 = world({ jobs: [other] });
    value(await w2.service.update(OLGA, other.id, { status: 'failed', exitCode: 1, slicesMerged: 1, slicesTotal: 2 }));
    expect(w2.state.jobs[0]).not.toHaveProperty('slices_merged');
  });
});

// PRD 2425 s3: a bug fix's ending report carries its outcome, the pull request it proved had fixed the bug and every
// pull request it opened; the server stores them, the page and the terminal still read the new words as Done, and a
// key reads them back with the job, in the words the bug fix's log gave them.
describe('what a bug fix reports and what a key reads of its job (PRD 2425 s3)', () => {
  const PR = 'https://github.com/demo-org/app/pull/549';
  const SECOND = 'https://github.com/demo-org/other/pull/12';
  const PROVED = 'https://github.com/demo-org/app/pull/512';
  const STORED = ['pr-opened', 'already-fixed', 'needs-brainstorm', 'not-a-bug', 'stuck', 'blocked'] as const;
  /** A bug fix a key sent, running on the shared runner. */
  const running = (more: Partial<JobRow> = {}) => jobRow({
    status: 'running', runner_id: SHARED, line: '/omni:bug-fix 548 totals', sent_by: OLGA, sent_by_key: API_KEY, claimed_at: T0.toISOString(), running_at: T0.toISOString(), ...more,
  });
  /** The same job, ended `done`. */
  const ended = (more: Partial<JobRow> = {}) => running({ status: 'done', exit_code: 0, ended_at: T0.toISOString(), ...more });
  const keyJobOf = async (job: JobRow) => value(await world({ jobs: [job] }).service.keyJob(WORKSPACE, job.id));

  describe('the report', () => {
    it.each(STORED)('stores the word %s of a done report as it is', async (outcome) => {
      const job = running();
      const w = world({ jobs: [job] });
      value(await w.service.update(OLGA, job.id, { status: 'done', exitCode: 0, outcome }));
      expect(w.state.jobs[0]).toMatchObject({ status: 'done', outcome });
    });

    it('stores need-human as human, the outcome the server already sets for questions left open', async () => {
      const job = running();
      const w = world({ jobs: [job] });
      value(await w.service.update(OLGA, job.id, { status: 'done', exitCode: 0, outcome: 'need-human' }));
      expect(w.state.jobs[0]).toMatchObject({ status: 'done', outcome: 'human' });
    });

    it('stores the pull request a done bug fix proved, and every pull request it opened, in order', async () => {
      const job = running();
      const w = world({ jobs: [job] });
      value(await w.service.update(OLGA, job.id, { status: 'done', exitCode: 0, outcome: 'already-fixed', fixedBy: PROVED, prs: [PR, SECOND] }));
      expect(w.state.jobs[0]).toMatchObject({ outcome: 'already-fixed', fixed_by: PROVED, prs: [PR, SECOND] });
    });

    it('stores the pull requests of a failed report and no outcome, nor a proved pull request', async () => {
      const job = running();
      const w = world({ jobs: [job] });
      value(await w.service.update(OLGA, job.id, { status: 'failed', exitCode: 1, outcome: 'stuck', fixedBy: PROVED, prs: [PR] }));
      expect(w.state.jobs[0]).toMatchObject({ status: 'failed', prs: [PR] });
      expect(w.state.jobs[0]).not.toHaveProperty('outcome');
      expect(w.state.jobs[0]).not.toHaveProperty('fixed_by');
    });

    it('stores the follow-ups of a done report, in order, and none of a failed one (PRD 2508)', async () => {
      const followUps = [{ repos: ['demo-org/app'], summary: 'One problem the run saw.' }, { repos: ['demo-org/app', 'demo-org/plan'], summary: 'Another one.' }];
      const done = running();
      const w = world({ jobs: [done] });
      value(await w.service.update(OLGA, done.id, { status: 'done', exitCode: 0, outcome: 'pr-opened', prs: [PR], followUps }));
      expect(w.state.jobs[0]).toMatchObject({ follow_ups: followUps });
      const failed = running();
      const f = world({ jobs: [failed] });
      value(await f.service.update(OLGA, failed.id, { status: 'failed', exitCode: 1, followUps }));
      expect(f.state.jobs[0]).not.toHaveProperty('follow_ups');
    });

    it('stores none of them for a report that carries none, as before this PRD', async () => {
      const job = running();
      const w = world({ jobs: [job] });
      value(await w.service.update(OLGA, job.id, { status: 'done', exitCode: 0 }));
      for (const column of ['outcome', 'fixed_by', 'prs', 'follow_ups']) expect(w.state.jobs[0], column).not.toHaveProperty(column);
    });

    it('still reads Need human for a bug fix that ended with its questions open, whatever word it reported', async () => {
      const job = running();
      const w = world({ jobs: [job], questions: [questionsRow({ job_id: job.id })] });
      value(await w.service.update(OLGA, job.id, { status: 'done', exitCode: 0, outcome: 'stuck', prs: [PR] }));
      expect(w.state.jobs[0]).toMatchObject({ outcome: 'human', prs: [PR] });
    });
  });

  describe('the page and the terminal', () => {
    it('read the new words as none, as a bug fix\'s end reads Done today, and Need human only while its questions are open', async () => {
      const done = STORED.map((outcome) => ended({ outcome }));
      const asked = ended({ outcome: 'human' });
      const w = world({ jobs: [...done, asked], questions: [questionsRow({ job_id: asked.id })] });
      const outcomes = new Map(value(await w.service.board(PIA, WORKSPACE)).jobs.map((job) => [job.id, job.outcome]));
      expect(done.map((job) => outcomes.get(job.id))).toEqual(STORED.map(() => null));
      expect(outcomes.get(asked.id)).toBe('human');
      const terminal = value(await w.service.prdJobs(MO, 'demo-org/app', parsePrd(548)));
      expect(terminal.filter((job) => job.outcome === null)).toHaveLength(STORED.length);
      expect(terminal.filter((job) => job.outcome === 'human')).toHaveLength(1);
    });

    it('do not carry what only a key reads: the proved pull request and the pull requests stay out of the page\'s job', async () => {
      const job = ended({ outcome: 'already-fixed', fixed_by: PROVED, prs: [PR], acting_for: 'Jane D.' });
      const board = value(await world({ jobs: [job] }).service.board(PIA, WORKSPACE));
      for (const field of ['fixedBy', 'prs']) expect(Object.keys(board.jobs[0] ?? {}), field).not.toContain(field);
    });

    it('carry whom a key said it acted for, and the key that cancelled a job by its name, for the page to show', async () => {
      const acted = ended({ acting_for: 'Jane D.' });
      const cancelled = ended({ status: 'cancelled', exit_code: null, cancel_requested: true, cancelled_by_key: OTHER_KEY, cancelled_for: 'Jane D.' });
      const plain = ended();
      const board = value(await world({ jobs: [acted, cancelled, plain] }).service.board(PIA, WORKSPACE));
      const read = new Map(board.jobs.map((job) => [job.id, { actingFor: job.actingFor, cancelledByKey: job.cancelledByKey }]));
      expect(read.get(acted.id)).toEqual({ actingFor: 'Jane D.', cancelledByKey: null });
      expect(read.get(cancelled.id)).toEqual({ actingFor: null, cancelledByKey: 'Support bot' });
      expect(read.get(plain.id)).toEqual({ actingFor: null, cancelledByKey: null });
    });

    it('carry the cancelling key\'s name in the job a cancel answers, too', async () => {
      const queued = jobRow({ sent_by: OLGA, sent_by_key: API_KEY, acting_for: 'Jane D.' });
      const w = world({ jobs: [queued] });
      expect(value(await w.service.cancel(OLGA, queued.id))).toMatchObject({ status: 'cancelled', actingFor: 'Jane D.', cancelledByKey: null });
    });

    it('read a round a key closed: the key by its name, and whom it acted for, with no person', async () => {
      const job = ended({ outcome: 'human' });
      const closed = questionsRow({ job_id: job.id, closed_by_key: OTHER_KEY, closed_for: 'Jane D.', closed_at: T0.toISOString(), answers: { 'Which fix?': 'Guard the input' } });
      const w = world({ jobs: [job], questions: [closed] });
      expect(value(await w.service.questions(MO, job.id))).toMatchObject({ state: 'answered', by: null, byLogin: null, byKey: 'Support bot', actingFor: 'Jane D.' });
    });

    it('read a round a key dismissed the same way, and one a person closed or one still open with no key', async () => {
      const dismissed = ended({ outcome: 'human' });
      const byPerson = ended({ outcome: 'human' });
      const open = ended({ outcome: 'human' });
      const w = world({
        jobs: [dismissed, byPerson, open],
        questions: [
          questionsRow({ job_id: dismissed.id, closed_by_key: API_KEY, closed_at: T0.toISOString() }),
          questionsRow({ job_id: byPerson.id, closed_by: MO, closed_at: T0.toISOString(), answers: { 'Which fix?': 'Guard the input' } }),
          questionsRow({ job_id: open.id }),
        ],
      });
      expect(value(await w.service.questions(MO, dismissed.id))).toMatchObject({ state: 'dismissed', byKey: 'QA dashboard', actingFor: null });
      expect(value(await w.service.questions(MO, byPerson.id))).toMatchObject({ state: 'answered', by: MO, byKey: null, actingFor: null });
      expect(value(await w.service.questions(MO, open.id))).toMatchObject({ state: 'open', byKey: null, actingFor: null });
    });
  });

  describe('a key reading its job', () => {
    it('reads a done bug fix\'s outcome in the words of its log: need-human for the stored human', async () => {
      const words = [...STORED, 'human'] as const;
      const reads = await Promise.all(words.map(async (outcome) => (await keyJobOf(ended({ outcome }))).outcome));
      expect(reads).toEqual(['pr-opened', 'already-fixed', 'needs-brainstorm', 'not-a-bug', 'stuck', 'blocked', 'need-human']);
    });

    it('reads no outcome while the job runs, when it failed, when its runner reported none and for a yolo hand-off\'s word', async () => {
      for (const job of [running(), ended({ status: 'failed', exit_code: 1, outcome: 'stuck' }), ended(), ended({ outcome: 'answers' }), ended({ outcome: 'stopped' })]) {
        expect((await keyJobOf(job)).outcome, `${job.status} ${job.outcome ?? 'none'}`).toBeNull();
      }
    });

    it('reads the proved pull request with already-fixed only', async () => {
      expect(await keyJobOf(ended({ outcome: 'already-fixed', fixed_by: PROVED }))).toMatchObject({ outcome: 'already-fixed', fixedBy: PROVED });
      expect((await keyJobOf(ended({ outcome: 'pr-opened', fixed_by: PROVED }))).fixedBy).toBeNull();
      expect((await keyJobOf(ended({ outcome: 'already-fixed' }))).fixedBy).toBeNull();
      expect((await keyJobOf(ended({ status: 'failed', exit_code: 1, fixed_by: PROVED }))).fixedBy).toBeNull();
    });

    it('reads every pull request the job opened, in order, and none for a job that opened none', async () => {
      expect((await keyJobOf(ended({ outcome: 'pr-opened', prs: [PR, SECOND], pr_url: PR }))).prs).toEqual([PR, SECOND]);
      expect((await keyJobOf(ended({ status: 'failed', exit_code: 1, prs: [PR] }))).prs).toEqual([PR]);
      expect((await keyJobOf(ended())).prs).toEqual([]);
      expect(await keyJobOf(ended({ pr_url: PR }))).toMatchObject({ prUrl: PR, prs: [] });
    });

    it('reads the state of its questions: none, open, answered or dismissed', async () => {
      const [none, open, answered, dismissed] = [ended(), ended({ outcome: 'human' }), ended({ outcome: 'human' }), ended({ outcome: 'human' })];
      const questions = [
        questionsRow({ job_id: open.id }),
        questionsRow({ job_id: answered.id, answers: { 'Which fix?': 'Guard the input' }, closed_by: MO, closed_at: T0.toISOString() }),
        questionsRow({ job_id: dismissed.id, closed_by: MO, closed_at: T0.toISOString() }),
      ];
      const w = world({ jobs: [none, open, answered, dismissed], questions });
      const states = await Promise.all([none, open, answered, dismissed].map(async (job) => value(await w.service.keyJob(WORKSPACE, job.id)).questions));
      expect(states).toEqual([null, 'open', 'answered', 'dismissed']);
    });

    it('reads the job it carries on and the newest job that carries it on', async () => {
      const first = ended({ outcome: 'human', queued_at: at(-300).toISOString() });
      const resume = running({ continues: first.id, line: `/omni:bug-fix #314 --answers ${first.id}`, queued_at: at(-100).toISOString() });
      const w = world({ jobs: [first, resume] });
      expect(value(await w.service.keyJob(WORKSPACE, first.id))).toMatchObject({ continues: null, continuedBy: resume.id });
      expect(value(await w.service.keyJob(WORKSPACE, resume.id))).toMatchObject({ continues: first.id, continuedBy: null });
    });

    it('reads whom the app acted for, and the key that cancelled it with whom that key acted for', async () => {
      expect(await keyJobOf(ended())).toMatchObject({ actingFor: null, cancelledBy: null });
      expect(await keyJobOf(running({ acting_for: 'Jane D.' }))).toMatchObject({ actingFor: 'Jane D.', cancelledBy: null });
      const cancelled = await keyJobOf(ended({ status: 'cancelled', exit_code: null, cancelled_by_key: OTHER_KEY, cancelled_for: 'Sam' }));
      expect(cancelled).toMatchObject({ status: 'cancelled', cancelledBy: { key: 'Support bot', actingFor: 'Sam' } });
      expect((await keyJobOf(ended({ status: 'cancelled', cancelled_by_key: API_KEY }))).cancelledBy).toEqual({ key: 'QA dashboard', actingFor: null });
      // A key the workspace no longer names is still a key that cancelled it.
      expect((await keyJobOf(ended({ status: 'cancelled', cancelled_by_key: '00000000-0000-4000-8000-0000018302ff' }))).cancelledBy).toEqual({ key: 'unknown key', actingFor: null });
    });

    it('reads the follow-ups the job stored, in order, and none for a row from an older runner (PRD 2508)', async () => {
      const followUps = [{ repos: ['demo-org/app'], summary: 'One.' }, { repos: ['demo-org/a', 'demo-org/b'], summary: 'Two.' }];
      expect((await keyJobOf(ended({ outcome: 'pr-opened', follow_ups: followUps }))).followUps).toEqual(followUps);
      expect((await keyJobOf(ended({ outcome: 'pr-opened', follow_ups: [] }))).followUps).toEqual([]);
      expect((await keyJobOf(ended({ outcome: 'pr-opened' }))).followUps).toEqual([]);
      expect((await keyJobOf(running())).followUps).toEqual([]);
    });

    it('reads the log tail the Runners page keeps, or none while the job has none', async () => {
      expect((await keyJobOf(running({ log_tail: '12:04:31 Bash: pnpm test\nDone: PR 549' }))).logTail).toBe('12:04:31 Bash: pnpm test\nDone: PR 549');
      expect((await keyJobOf(running())).logTail).toBeNull();
    });

    it('reads a job just queued with nothing of the above', async () => {
      const queued = value(await world().service.sendByKey({ id: API_KEY, name: 'QA dashboard', workspace: WORKSPACE, maker: OLGA }, { repo: 'demo-org/app', line: '/omni:bug-fix 548 totals' }));
      expect(queued).toMatchObject({
        outcome: null, fixedBy: null, prs: [], followUps: [], questions: null, continues: null, continuedBy: null, actingFor: null, cancelledBy: null, logTail: null,
      });
    });

    it('still reads no job of a person, of another workspace or an unknown one', async () => {
      const person = jobRow({ sent_by_key: null });
      const keys = ended();
      const w = world({ jobs: [person, keys] });
      expect(await w.service.keyJob(WORKSPACE, person.id)).toMatchObject({ ok: false, kind: 'missing' });
      expect(await w.service.keyJob('00000000-0000-4000-8000-000001830002', keys.id)).toMatchObject({ ok: false, kind: 'missing' });
    });
  });
});

// PRD 2425 s6: a key reads the questions of a job a key of its workspace sent, answers them (the resume stays the
// key's and continues the job) or dismisses them with no job queued, and the first close wins, whoever closes: a
// key, or a person on the page. The page's answer to a key's job keeps the thread the key's, too.
describe('a key answering and dismissing its job\'s questions (PRD 2425 s6)', () => {
  const ANSWERS = { 'Which fix?': 'Guard the input' };
  const UNKNOWN_JOB = '00000000-0000-4000-8000-0000024259f9';
  /** The key that answers: not the one that sent the job. */
  const KEY = { id: OTHER_KEY, workspace: WORKSPACE, actingFor: 'Jane D.' };
  /** A bug fix the first key sent, through its maker Olga, to the fleet cia: it ended with its questions open. */
  const asked = (more: Partial<JobRow> = {}) => jobRow({
    status: 'done', exit_code: 0, outcome: 'human', runner_id: SHARED, line: '/omni:bug-fix #314', sent_by: OLGA, sent_by_key: API_KEY, to_fleet: 'cia',
    claimed_at: T0.toISOString(), running_at: T0.toISOString(), ended_at: T0.toISOString(), ...more,
  });
  const waiting = (job: JobRow = asked()) => world({ jobs: [job], questions: [questionsRow({ job_id: job.id })] });

  describe('reading the questions', () => {
    it('reads them open, with the lead and the questions, for a job a key sent', async () => {
      const job = asked();
      const read = value(await waiting(job).service.questionsByKey(WORKSPACE, job.id));
      expect(read).toMatchObject({ job: job.id, state: 'open', lead: 'The planning query fails for 31 tenants.', questions: [QUESTION], answers: null, by: null, byLogin: null, byKey: null, actingFor: null });
    });

    it('reads a round a key closed by its name and whom it acted for, and one a person closed by their login', async () => {
      const [byKey, byPerson] = [asked(), asked()];
      const w = world({
        jobs: [byKey, byPerson],
        questions: [
          questionsRow({ job_id: byKey.id, answers: ANSWERS, closed_by_key: OTHER_KEY, closed_for: 'Jane D.', closed_at: T0.toISOString() }),
          questionsRow({ job_id: byPerson.id, answers: ANSWERS, closed_by: MO, closed_at: T0.toISOString() }),
        ],
      });
      expect(value(await w.service.questionsByKey(WORKSPACE, byKey.id))).toMatchObject({ state: 'answered', answers: ANSWERS, by: null, byKey: 'Support bot', actingFor: 'Jane D.' });
      expect(value(await w.service.questionsByKey(WORKSPACE, byPerson.id))).toMatchObject({ state: 'answered', answers: ANSWERS, by: MO, byLogin: 'mo', byKey: null });
    });

    it('finds none for a job a person sent, another workspace\'s, one that does not exist, and a job that asked none', async () => {
      const person = asked({ sent_by_key: null, sent_by: MO });
      const quiet = asked();
      const w = world({ jobs: [person, quiet], questions: [questionsRow({ job_id: person.id })] });
      const missing = { ok: false, kind: 'missing', error: 'No such job.' };
      expect(await w.service.questionsByKey(WORKSPACE, person.id)).toEqual(missing);
      expect(await w.service.questionsByKey(ELSEWHERE, person.id)).toEqual(missing);
      expect(await w.service.questionsByKey(WORKSPACE, UNKNOWN_JOB)).toEqual(missing);
      expect(await w.service.questionsByKey(WORKSPACE, quiet.id)).toEqual({ ok: false, kind: 'missing', error: 'This job asked no question.' });
    });
  });

  describe('answering', () => {
    it('queues the resume as the first job\'s key and maker, to the same fleet, and answers it as the key reads a job', async () => {
      const job = asked();
      const w = waiting(job);
      const resume = value(await w.service.answerByKey(KEY, job.id, ANSWERS));
      expect(resume).toMatchObject({ line: `/omni:bug-fix #314 --answers ${job.id}`, repo: 'demo-org/app', status: 'queued', continues: job.id, continuedBy: null, actingFor: 'Jane D.', questions: null });
      expect(w.state.jobs.find((j) => j.id === resume.id)).toMatchObject({ sent_by: OLGA, sent_by_key: API_KEY, continues: job.id, to_fleet: 'cia', to_runner: null, acting_for: 'Jane D.' });
    });

    it('closes the round as the key and whom it acted for, with no person, and keeps the answers', async () => {
      const job = asked();
      const w = waiting(job);
      const resume = value(await w.service.answerByKey(KEY, job.id, ANSWERS));
      expect(w.state.questions[0]).toMatchObject({ answers: ANSWERS, closed_by: null, closed_by_key: OTHER_KEY, closed_for: 'Jane D.', closed_at: T0.toISOString(), resume_job: resume.id });
    });

    it('reads the first job as carried on by the resume, and as answered, once it did', async () => {
      const job = asked();
      const w = waiting(job);
      const resume = value(await w.service.answerByKey(KEY, job.id, ANSWERS));
      expect(value(await w.service.keyJob(WORKSPACE, job.id))).toMatchObject({ continuedBy: resume.id, questions: 'answered' });
      expect(value(await w.service.keyJob(WORKSPACE, resume.id))).toMatchObject({ continues: job.id, actingFor: 'Jane D.' });
      expect(value(await w.service.questionsByKey(WORKSPACE, job.id))).toMatchObject({ state: 'answered', byKey: 'Support bot', actingFor: 'Jane D.', resume: resume.id });
    });

    it('stores no one the key acted for when it said none', async () => {
      const job = asked();
      const w = waiting(job);
      const resume = value(await w.service.answerByKey({ ...KEY, actingFor: null }, job.id, ANSWERS));
      expect(resume.actingFor).toBeNull();
      expect(w.state.questions[0]).toMatchObject({ closed_by_key: OTHER_KEY, closed_for: null });
    });

    it('lets the key that sent the job answer it, too', async () => {
      const job = asked();
      const resume = value(await waiting(job).service.answerByKey({ ...KEY, id: API_KEY }, job.id, ANSWERS));
      expect(resume).toMatchObject({ continues: job.id, status: 'queued' });
    });

    it('answers the second close, from a key or from the page, with the key by name: the first wins', async () => {
      const [first, second] = [asked(), asked()];
      const w = world({ jobs: [first, second], questions: [questionsRow({ job_id: first.id }), questionsRow({ job_id: second.id })] });
      value(await w.service.answerByKey(KEY, first.id, ANSWERS));
      value(await w.service.answerByKey({ ...KEY, id: API_KEY }, second.id, ANSWERS));
      const refused = { ok: false, kind: 'conflict' };
      expect(await w.service.answerByKey({ ...KEY, id: API_KEY }, first.id, ANSWERS)).toEqual({ ...refused, error: 'Already answered by API key Support bot' });
      expect(await w.service.answer(MO, first.id, { answers: ANSWERS })).toEqual({ ...refused, error: 'Already answered by API key Support bot' });
      expect(await w.service.dismiss(MO, second.id)).toEqual({ ...refused, error: 'Already answered by API key QA dashboard' });
      expect(w.state.jobs).toHaveLength(4);
    });

    it('refuses a key an answer a person gave first, by their login', async () => {
      const job = asked();
      const w = waiting(job);
      value(await w.service.answer(MO, job.id, { answers: ANSWERS }));
      expect(await w.service.answerByKey(KEY, job.id, ANSWERS)).toEqual({ ok: false, kind: 'conflict', error: 'Already answered by @mo' });
      expect(await w.service.dismissByKey(KEY, job.id)).toEqual({ ok: false, kind: 'conflict', error: 'Already answered by @mo' });
    });

    it('queues no second resume for a job a continuation already carries on', async () => {
      const job = asked();
      const carried = jobRow({ sent_by: OLGA, sent_by_key: API_KEY, continues: job.id, line: '/omni:yolo-fix 314' });
      const w = world({ jobs: [job, carried], questions: [questionsRow({ job_id: job.id })] });
      expect(await w.service.answerByKey(KEY, job.id, ANSWERS)).toMatchObject({ ok: false, kind: 'conflict' });
      expect(w.state.jobs).toHaveLength(2);
    });

    it('refuses an answer to a question not asked, or a question left unanswered, and stores nothing', async () => {
      for (const answers of [{}, { 'Which fix?': 'Guard the input', 'And the tests?': 'Add one' }, { 'And the tests?': 'Add one' }]) {
        const job = asked();
        const w = waiting(job);
        expect(await w.service.answerByKey(KEY, job.id, answers)).toEqual({ ok: false, kind: 'malformed', error: 'Answer each question once, and only the ones asked.' });
        expect(w.state.jobs).toHaveLength(1);
        expect(w.state.questions[0]?.closed_at).toBeNull();
      }
    });

    it('refuses what a key learns nothing from: a person\'s job, another workspace\'s key, no such job, and a job that asked none', async () => {
      const person = asked({ sent_by_key: null, sent_by: MO });
      const quiet = asked();
      const w = world({ jobs: [person, quiet], questions: [questionsRow({ job_id: person.id })] });
      const missing = { ok: false, kind: 'missing', error: 'No such job.' };
      expect(await w.service.answerByKey(KEY, person.id, ANSWERS)).toEqual(missing);
      expect(await w.service.answerByKey({ ...KEY, workspace: ELSEWHERE }, person.id, ANSWERS)).toEqual(missing);
      expect(await w.service.answerByKey(KEY, UNKNOWN_JOB, ANSWERS)).toEqual(missing);
      expect(await w.service.answerByKey(KEY, quiet.id, ANSWERS)).toEqual({ ok: false, kind: 'missing', error: 'This job asked no question.' });
      expect(w.state.calls.filter((call) => call.startsWith('answer'))).toEqual([]);
    });

    it('refuses a job that is not waiting for an answer', async () => {
      for (const more of [{ outcome: null }, { status: 'failed' as const, outcome: null }, { outcome: 'pr-opened' as const }]) {
        const job = asked(more);
        expect(await waiting(job).service.answerByKey(KEY, job.id, ANSWERS)).toEqual({ ok: false, kind: 'conflict', error: 'This job is not waiting for an answer.' });
      }
    });

    it('refuses a repository\'s own skill, whose questions can only be dismissed, and dismisses them', async () => {
      const job = asked({ line: '/triage-bug 314' });
      const w = waiting(job);
      expect(await w.service.answerByKey(KEY, job.id, ANSWERS)).toEqual({ ok: false, kind: 'malformed', error: '/triage-bug is a repository\'s own skill: its questions can only be dismissed.' });
      expect(value(await w.service.dismissByKey(KEY, job.id))).toMatchObject({ questions: 'dismissed' });
    });

    it('queues as the first job\'s sender: one who left the workspace, or no longer plays in the fleet, is refused', async () => {
      const left = asked({ sent_by: EVE });
      const moved = asked({ sent_by: PIA });
      const [leftWorld, movedWorld] = [waiting(left), waiting(moved)];
      expect(await leftWorld.service.answerByKey(KEY, left.id, ANSWERS)).toMatchObject({ ok: false, kind: 'forbidden' });
      expect(await movedWorld.service.answerByKey(KEY, moved.id, ANSWERS)).toMatchObject({ ok: false, kind: 'forbidden', error: expect.stringContaining('cia') as string });
      expect(leftWorld.state.jobs).toHaveLength(1);
      expect(movedWorld.state.jobs).toHaveLength(1);
    });

    it('refuses a key the database does not let close this job as forbidden', async () => {
      const job = asked();
      const w = waiting(job);
      const stranger = { ...KEY, id: '00000000-0000-4000-8000-0000018302ff' };
      const refused = { ok: false, kind: 'forbidden', error: 'This API key does not act on this job.' };
      expect(await w.service.answerByKey(stranger, job.id, ANSWERS)).toEqual(refused);
      expect(await w.service.dismissByKey(stranger, job.id)).toEqual(refused);
      expect(w.state.jobs).toHaveLength(1);
    });

    it('answers a refusal of the database after the checks in words: a race for the round names who won it', async () => {
      const job = asked();
      const { store } = fakeStore({ jobs: [job], questions: [questionsRow({ job_id: job.id })], now: () => T0 });
      let reads = 0;
      const racing = {
        ...store,
        questionsOf: async (id: string) => {
          const row = await store.questionsOf(id);
          reads += 1;
          return row && reads > 1 ? { ...row, answers: ANSWERS, closed_by_key: API_KEY, closed_at: T0.toISOString() } : row;
        },
        answerByKey: () => Promise.resolve({ ok: false as const, refusal: 'closed' as const }),
      };
      const service = runnersService(racing, { now: () => T0, sleep: () => Promise.resolve() });
      expect(await service.answerByKey(KEY, job.id, ANSWERS)).toEqual({ ok: false, kind: 'conflict', error: 'Already answered by API key QA dashboard' });
    });
  });

  describe('dismissing', () => {
    it('closes the round with no answer and no job queued, as the key and whom it acted for, and answers the job as the key reads it', async () => {
      const job = asked();
      const w = waiting(job);
      const read = value(await w.service.dismissByKey(KEY, job.id));
      expect(read).toMatchObject({ id: job.id, status: 'done', outcome: 'need-human', questions: 'dismissed', continuedBy: null });
      expect(w.state.questions[0]).toMatchObject({ answers: null, closed_by: null, closed_by_key: OTHER_KEY, closed_for: 'Jane D.', closed_at: T0.toISOString(), resume_job: null });
      expect(w.state.jobs).toHaveLength(1);
    });

    it('reads the dismissal back with the key by name, and a second close, from a key or the page, is the first one\'s', async () => {
      const job = asked();
      const w = waiting(job);
      value(await w.service.dismissByKey({ ...KEY, actingFor: null }, job.id));
      expect(value(await w.service.questionsByKey(WORKSPACE, job.id))).toMatchObject({ state: 'dismissed', answers: null, byKey: 'Support bot', actingFor: null });
      const refused = { ok: false, kind: 'conflict', error: 'Dismissed by API key Support bot' };
      expect(await w.service.dismissByKey(KEY, job.id)).toEqual(refused);
      expect(await w.service.answerByKey(KEY, job.id, ANSWERS)).toEqual(refused);
      expect(await w.service.answer(MO, job.id, { answers: ANSWERS })).toEqual(refused);
      expect(await w.service.dismiss(MO, job.id)).toEqual(refused);
    });

    it('refuses a person\'s job, another workspace\'s key, a job that asked none and one not waiting, as an answer does', async () => {
      const person = asked({ sent_by_key: null, sent_by: MO });
      const quiet = asked();
      const failed = asked({ status: 'failed', outcome: null });
      const w = world({ jobs: [person, quiet, failed], questions: [questionsRow({ job_id: person.id }), questionsRow({ job_id: failed.id })] });
      expect(await w.service.dismissByKey(KEY, person.id)).toEqual({ ok: false, kind: 'missing', error: 'No such job.' });
      expect(await w.service.dismissByKey({ ...KEY, workspace: ELSEWHERE }, failed.id)).toEqual({ ok: false, kind: 'missing', error: 'No such job.' });
      expect(await w.service.dismissByKey(KEY, quiet.id)).toEqual({ ok: false, kind: 'missing', error: 'This job asked no question.' });
      expect(await w.service.dismissByKey(KEY, failed.id)).toEqual({ ok: false, kind: 'conflict', error: 'This job is not waiting for an answer.' });
    });
  });

  describe('the page answering a key\'s job', () => {
    it('queues the resume as the key and its maker, continuing the job, and answers it with the key by name and the maker\'s login', async () => {
      const job = asked();
      const w = waiting(job);
      const resume = value(await w.service.answer(MO, job.id, { answers: ANSWERS }));
      expect(w.state.jobs.find((j) => j.id === resume.id)).toMatchObject({ sent_by: OLGA, sent_by_key: API_KEY, continues: job.id });
      expect(resume).toMatchObject({ sentBy: OLGA, sentByLogin: 'olga', sentByKey: 'QA dashboard', continues: job.id, actingFor: null });
      expect(w.state.questions[0]).toMatchObject({ closed_by: MO, answers: ANSWERS });
    });

    it('still queues a person\'s job\'s resume as the one who answered, and sets no continues', async () => {
      const job = asked({ sent_by_key: null, sent_by: OLGA });
      const w = waiting(job);
      const resume = value(await w.service.answer(MO, job.id, { answers: ANSWERS }));
      expect(resume).toMatchObject({ sentBy: MO, sentByLogin: 'mo', sentByKey: null });
      expect(w.state.jobs.find((j) => j.id === resume.id)).toMatchObject({ sent_by: MO, sent_by_key: null });
      expect(w.state.jobs.find((j) => j.id === resume.id)).not.toHaveProperty('continues');
    });
  });
});

// PRD 2425 s7: a key cancels a job a key of its workspace sent, as the Runners page's Cancel does (a queued or claimed job
// ends at once, a running one is asked to stop), and relaunches one as the page offers (Send again for a failed or
// cancelled job, Resume for one stopped mid-way): the new job stays the first one's key's and maker's, `continues` it
// and keeps its notify_url.
describe('a key cancelling and relaunching its job (PRD 2425 s7)', () => {
  const NOTIFY = 'https://hooks.example.com/omni';
  const UNKNOWN_JOB = '00000000-0000-4000-8000-0000024259f8';
  /** The key that acts: not the one that sent the job. */
  const KEY = { id: OTHER_KEY, workspace: WORKSPACE, actingFor: 'Jane D.' };
  const NOT_OFFERED = 'This job is neither failed, cancelled nor stopped mid-way: the Runners page offers neither Send again nor Resume for it.';
  /** A bug fix the first key sent, through its maker Olga, to the fleet cia, with a link to ping. */
  const sent = (more: Partial<JobRow> = {}) => jobRow({ line: '/omni:bug-fix #314', sent_by: OLGA, sent_by_key: API_KEY, to_fleet: 'cia', notify_url: NOTIFY, ...more });
  const running = (more: Partial<JobRow> = {}) => sent({ status: 'running', runner_id: SHARED, claimed_at: T0.toISOString(), running_at: T0.toISOString(), ...more });
  const ended = (more: Partial<JobRow> = {}) => sent({
    status: 'failed', exit_code: 1, reason: 'exit 1', runner_id: SHARED, claimed_at: T0.toISOString(), running_at: T0.toISOString(), ended_at: T0.toISOString(), ...more,
  });

  describe('cancelling', () => {
    it('ends a queued job at once, as the key and whom it acted for, and answers it as a key reads a job', async () => {
      const job = sent();
      const w = world({ jobs: [job] });
      const read = value(await w.service.cancelByKey(KEY, job.id));
      expect(read).toMatchObject({ id: job.id, status: 'cancelled', endedAt: T0.toISOString(), cancelledBy: { key: 'Support bot', actingFor: 'Jane D.' } });
      expect(w.state.jobs[0]).toMatchObject({ status: 'cancelled', cancel_requested: true, ended_at: T0.toISOString(), cancelled_by_key: OTHER_KEY, cancelled_for: 'Jane D.' });
    });

    it('ends a claimed job at once, though its runner may never report on it', async () => {
      const job = sent({ status: 'claimed', runner_id: SHARED, claimed_at: T0.toISOString() });
      const w = world({ jobs: [job] });
      expect(value(await w.service.cancelByKey(KEY, job.id))).toMatchObject({ status: 'cancelled', runner: 'shared', endedAt: T0.toISOString() });
      expect(await w.service.update(OLGA, job.id, { status: 'running' })).toMatchObject({ ok: false, kind: 'conflict' });
    });

    it('asks the runner to stop a running job, which the runner reads at its next report, and names the key that asked', async () => {
      const job = running();
      const w = world({ jobs: [job] });
      expect(value(await w.service.cancelByKey(KEY, job.id))).toMatchObject({ status: 'running', endedAt: null, cancelledBy: { key: 'Support bot', actingFor: 'Jane D.' } });
      expect(w.state.jobs[0]).toMatchObject({ status: 'running', cancel_requested: true, ended_at: null, cancelled_by_key: OTHER_KEY, cancelled_for: 'Jane D.' });
      expect(value(await w.service.update(OLGA, job.id, { status: 'running' }))).toEqual({ cancel: true });
    });

    it('records whom the key acted for only when it said so', async () => {
      const job = sent();
      const w = world({ jobs: [job] });
      expect(value(await w.service.cancelByKey({ ...KEY, actingFor: null }, job.id))).toMatchObject({ cancelledBy: { key: 'Support bot', actingFor: null } });
      expect(w.state.jobs[0]).toMatchObject({ cancelled_by_key: OTHER_KEY, cancelled_for: null });
    });

    it('cancels a job the very key that sent it, as well as another key of the workspace', async () => {
      const job = sent();
      const w = world({ jobs: [job] });
      expect(value(await w.service.cancelByKey({ ...KEY, id: API_KEY }, job.id))).toMatchObject({ status: 'cancelled', cancelledBy: { key: 'QA dashboard' } });
    });

    it('leaves a running job already asked to stop with the key that asked first, and answers it all the same', async () => {
      const job = running({ cancel_requested: true, cancelled_by_key: API_KEY, cancelled_for: 'Ann P.' });
      const w = world({ jobs: [job] });
      expect(value(await w.service.cancelByKey(KEY, job.id))).toMatchObject({ status: 'running', cancelledBy: { key: 'QA dashboard', actingFor: 'Ann P.' } });
      expect(w.state.jobs[0]).toMatchObject({ cancel_requested: true, cancelled_by_key: API_KEY, cancelled_for: 'Ann P.' });
    });

    it('refuses an ended job as a conflict, in the words of the page, and changes nothing', async () => {
      const jobs = [ended({ status: 'done', exit_code: 0 }), ended({ status: 'failed' }), ended({ status: 'cancelled', cancel_requested: true })];
      const w = world({ jobs });
      for (const job of jobs) expect(await w.service.cancelByKey(KEY, job.id)).toEqual({ ok: false, kind: 'conflict', error: `This job has ended: ${job.status}.` });
      expect(w.state.jobs.map((job) => job.cancelled_by_key ?? null)).toEqual([null, null, null]);
    });

    it('reads a job whose silent runner is lost as ended, and refuses it', async () => {
      const job = running({ runner_id: CIA_BOX });
      const w = world({ jobs: [job], start: at(91) });
      expect(await w.service.cancelByKey(KEY, job.id)).toEqual({ ok: false, kind: 'conflict', error: 'This job has ended: failed.' });
    });

    it('finds none for a job a person sent, another workspace\'s key\'s and one that does not exist, and changes nothing', async () => {
      const person = sent({ sent_by_key: null, sent_by: MO });
      const mine = sent();
      const w = world({ jobs: [person, mine] });
      const missing = { ok: false, kind: 'missing', error: 'No such job.' };
      expect(await w.service.cancelByKey(KEY, person.id)).toEqual(missing);
      expect(await w.service.cancelByKey({ ...KEY, workspace: ELSEWHERE }, mine.id)).toEqual(missing);
      expect(await w.service.cancelByKey(KEY, UNKNOWN_JOB)).toEqual(missing);
      expect(w.state.jobs.map((job) => [job.status, job.cancelled_by_key ?? null])).toEqual([['queued', null], ['queued', null]]);
    });

    it('answers a job that moved on meanwhile as a conflict', async () => {
      const job = sent();
      const { store } = fakeStore({ jobs: [job], now: () => T0 });
      const racing = { ...store, updateJob: () => Promise.resolve(null) };
      const service = runnersService(racing, { now: () => T0, sleep: () => Promise.resolve() });
      expect(await service.cancelByKey(KEY, job.id)).toEqual({ ok: false, kind: 'conflict', error: 'This job changed meanwhile. Try again.' });
    });

    it('shows on the Runners page, beside the page\'s own cancel, which records no key', async () => {
      const [byKey, byPage] = [sent(), sent({ sent_by_key: null, sent_by: MO })];
      const w = world({ jobs: [byKey, byPage] });
      value(await w.service.cancelByKey(KEY, byKey.id));
      value(await w.service.cancel(MO, byPage.id));
      const board = value(await w.service.board(OLGA, WORKSPACE));
      expect(board.jobs.find((job) => job.id === byKey.id)).toMatchObject({ status: 'cancelled', cancelledByKey: 'Support bot' });
      expect(w.state.jobs.find((job) => job.id === byPage.id)).toMatchObject({ status: 'cancelled' });
      expect(w.state.jobs.find((job) => job.id === byPage.id)?.cancelled_by_key ?? null).toBeNull();
    });
  });

  describe('relaunching', () => {
    it('sends a failed job again, as the first job\'s key and maker, to the same fleet, and answers the new job as a key reads a job', async () => {
      const job = ended();
      const w = world({ jobs: [job] });
      const relaunched = value(await w.service.relaunchByKey(KEY, job.id));
      expect(relaunched).toMatchObject({ line: '/omni:bug-fix #314', repo: 'demo-org/app', status: 'queued', runner: null, continues: job.id, continuedBy: null, actingFor: 'Jane D.', questions: null, outcome: null });
      expect(relaunched.id).not.toBe(job.id);
      expect(w.state.jobs.find((j) => j.id === relaunched.id)).toMatchObject({
        status: 'queued', sent_by: OLGA, sent_by_key: API_KEY, continues: job.id, to_fleet: 'cia', to_runner: null, acting_for: 'Jane D.', notify_url: NOTIFY,
      });
    });

    it('sends a cancelled job again, as the page does', async () => {
      const job = ended({ status: 'cancelled', cancel_requested: true, cancelled_by_key: API_KEY, exit_code: null, reason: null });
      const w = world({ jobs: [job] });
      const relaunched = value(await w.service.relaunchByKey(KEY, job.id));
      expect(relaunched).toMatchObject({ line: job.line, status: 'queued', continues: job.id });
      expect(w.state.jobs.find((j) => j.id === relaunched.id)).toMatchObject({ cancel_requested: false, sent_by_key: API_KEY });
    });

    it('resumes a job stopped mid-way with the line it ran, as the page\'s Resume does', async () => {
      const job = ended({ status: 'done', exit_code: 0, reason: null, outcome: 'stopped', line: '/omni:yolo 2338', slices_merged: 3, slices_total: 5 });
      const w = world({ jobs: [job] });
      const relaunched = value(await w.service.relaunchByKey(KEY, job.id));
      expect(relaunched).toMatchObject({ line: '/omni:yolo 2338', status: 'queued', continues: job.id });
      expect(w.state.jobs.find((j) => j.id === relaunched.id)).toMatchObject({ sent_by: OLGA, sent_by_key: API_KEY });
    });

    it('goes to the runner the first job named, and to any runner when it named none', async () => {
      const [named, any] = [ended({ to_fleet: null, to_runner: CIA_BOX }), ended({ to_fleet: null })];
      const w = world({ jobs: [named, any] });
      const [first, second] = [value(await w.service.relaunchByKey(KEY, named.id)), value(await w.service.relaunchByKey(KEY, any.id))];
      expect(w.state.jobs.find((j) => j.id === first.id)).toMatchObject({ to_runner: CIA_BOX, to_fleet: null });
      expect(w.state.jobs.find((j) => j.id === second.id)).toMatchObject({ to_runner: null, to_fleet: null });
    });

    it('keeps the notify_url it had, and none when it had none; whom the key acted for is only what it said now', async () => {
      const [pinged, quiet] = [ended(), ended({ notify_url: null })];
      const w = world({ jobs: [pinged, quiet] });
      const [first, second] = [value(await w.service.relaunchByKey({ ...KEY, actingFor: null }, pinged.id)), value(await w.service.relaunchByKey(KEY, quiet.id))];
      expect(w.state.jobs.find((j) => j.id === first.id)).toMatchObject({ notify_url: NOTIFY, acting_for: null });
      expect(w.state.jobs.find((j) => j.id === second.id)).toMatchObject({ notify_url: null, acting_for: 'Jane D.' });
    });

    it('reads the first job as carried on by the new one', async () => {
      const job = ended();
      const w = world({ jobs: [job] });
      const relaunched = value(await w.service.relaunchByKey(KEY, job.id));
      expect(value(await w.service.keyJob(WORKSPACE, job.id))).toMatchObject({ continuedBy: relaunched.id, continues: null });
      expect(value(await w.service.keyJob(WORKSPACE, relaunched.id))).toMatchObject({ continues: job.id, continuedBy: null });
    });

    it('queues the job as the runners queue any: the claim hands the runner the key and its maker', async () => {
      const job = ended({ to_fleet: null });
      const w = world({ jobs: [job] });
      const relaunched = value(await w.service.relaunchByKey(KEY, job.id));
      expect(value(await w.service.next(OLGA, SHARED))).toEqual({ id: relaunched.id, line: job.line, repo: 'demo-org/app', sentBy: 'API key QA dashboard (@olga)', allowedSkills: [], sentByKey: 'QA dashboard', github: null });
    });

    it('offers it for exactly the jobs the Runners page offers Send again or Resume for', async () => {
      const mismatches: string[] = [];
      for (const status of ['queued', 'claimed', 'running', 'done', 'failed', 'cancelled'] as const) {
        for (const outcome of [null, ...STORED_OUTCOMES]) {
          const job = sent({ status, outcome });
          const served = await world({ jobs: [job] }).service.relaunchByKey(KEY, job.id);
          if (served.ok !== (canSendAgain({ status }) || canResume({ status, outcome }))) mismatches.push(`${status}/${String(outcome)}`);
          if (!served.ok) expect(served).toEqual({ ok: false, kind: 'conflict', error: NOT_OFFERED });
        }
      }
      expect(mismatches).toEqual([]);
    });

    it('refuses a job that is not offered it, and queues nothing', async () => {
      const [live, handedOff, asked] = [sent(), ended({ status: 'done', exit_code: 0, outcome: 'pr-opened' }), ended({ status: 'done', exit_code: 0, outcome: 'human' })];
      const w = world({ jobs: [live, handedOff, asked] });
      for (const job of [live, handedOff, asked]) expect(await w.service.relaunchByKey(KEY, job.id)).toEqual({ ok: false, kind: 'conflict', error: NOT_OFFERED });
      expect(w.state.jobs).toHaveLength(3);
    });

    it('refuses a job already carried on, however it was: one relaunch each, and a second answers as a conflict', async () => {
      const job = ended();
      const w = world({ jobs: [job] });
      value(await w.service.relaunchByKey(KEY, job.id));
      expect(await w.service.relaunchByKey(KEY, job.id)).toEqual({ ok: false, kind: 'conflict', error: 'This job was carried on already.' });
      expect(await w.service.relaunchByKey({ ...KEY, id: API_KEY }, job.id)).toMatchObject({ ok: false, kind: 'conflict' });
      expect(w.state.jobs).toHaveLength(2);
    });

    it('refuses the one that lost a race for the job, as the database\'s unique `continues` answers it', async () => {
      const job = ended();
      const { store, state } = fakeStore({ jobs: [job], now: () => T0 });
      const racing = { ...store, insertRelaunch: () => Promise.resolve(null) };
      const service = runnersService(racing, { now: () => T0, sleep: () => Promise.resolve() });
      expect(await service.relaunchByKey(KEY, job.id)).toEqual({ ok: false, kind: 'conflict', error: 'This job was carried on already.' });
      expect(state.jobs).toHaveLength(1);
    });

    it('finds none for a job a person sent, another workspace\'s key\'s and one that does not exist', async () => {
      const person = ended({ sent_by_key: null, sent_by: MO });
      const mine = ended();
      const w = world({ jobs: [person, mine] });
      const missing = { ok: false, kind: 'missing', error: 'No such job.' };
      expect(await w.service.relaunchByKey(KEY, person.id)).toEqual(missing);
      expect(await w.service.relaunchByKey({ ...KEY, workspace: ELSEWHERE }, mine.id)).toEqual(missing);
      expect(await w.service.relaunchByKey(KEY, UNKNOWN_JOB)).toEqual(missing);
      expect(w.state.jobs).toHaveLength(2);
    });

    it('queues as the first job\'s sender: one who left the workspace, or no longer plays in the fleet, is refused', async () => {
      const left = ended({ sent_by: EVE });
      const moved = ended({ sent_by: PIA });
      const w = world({ jobs: [left, moved] });
      expect(await w.service.relaunchByKey(KEY, left.id)).toMatchObject({ ok: false, kind: 'forbidden', error: expect.stringContaining('no longer a member') as string });
      expect(await w.service.relaunchByKey(KEY, moved.id)).toMatchObject({ ok: false, kind: 'forbidden', error: expect.stringContaining('cia') as string });
      expect(w.state.jobs).toHaveLength(2);
    });

    it('refuses a runner the first job named that is gone, in the runners\' words', async () => {
      const job = ended({ to_fleet: null, to_runner: '00000000-0000-4000-8000-0000018301ff' });
      const w = world({ jobs: [job] });
      expect(await w.service.relaunchByKey(KEY, job.id)).toEqual({ ok: false, kind: 'missing', error: 'No such runner in this workspace.' });
      expect(w.state.jobs).toHaveLength(1);
    });

    it('checks the line as Send checks it: a repository\'s own skill its owner no longer allows is refused', async () => {
      const job = ended({ line: '/validate-prd 347' });
      const allowed: AllowedSkillRow = { workspace_id: WORKSPACE, full_name: 'demo-org/app', skill: 'validate-prd' };
      const off = world({ jobs: [job] });
      expect(await off.service.relaunchByKey(KEY, job.id)).toEqual({
        ok: false, kind: 'malformed', error: '/validate-prd is not allowed on a runner for demo-org/app: an owner allows it in Settings › Repositories.',
      });
      expect(off.state.jobs).toHaveLength(1);
      const on = world({ jobs: [job], skills: [allowed] });
      expect(value(await on.service.relaunchByKey(KEY, job.id))).toMatchObject({ line: '/validate-prd 347', continues: job.id });
    });
  });
});

// PRD 2425 s8: a job sent with a notify_url pings it, `{job_id, event, at}`, when its status, outcome or questions change, once
// the change is stored; the jobs that carry it on inherit the link; a change the database makes alone pings nothing.
describe('a job that pings its link (PRD 2425 s8)', () => {
  const NOTIFY = 'https://hooks.example.com/omni';
  const key = { id: API_KEY, name: 'QA dashboard', workspace: WORKSPACE, maker: OLGA };
  /** The key that acts: not the one that sent the job. */
  const KEY = { id: OTHER_KEY, workspace: WORKSPACE, actingFor: 'Jane D.' };
  const ASK = { issue: parseIssue(314), lead: 'The planning query fails for 31 tenants.', questions: [QUESTION] };
  const ANSWERS = { 'Which fix?': 'Guard the input' };
  const times = { claimed_at: T0.toISOString(), running_at: T0.toISOString() };
  /** A bug fix the first key sent, through its maker Olga, to the fleet cia, with a link to ping. */
  const sent = (more: Partial<JobRow> = {}) => jobRow({ line: '/omni:bug-fix #314', sent_by: OLGA, sent_by_key: API_KEY, to_fleet: 'cia', notify_url: NOTIFY, ...more });
  const claimed = (more: Partial<JobRow> = {}) => sent({ status: 'claimed', runner_id: SHARED, claimed_at: T0.toISOString(), ...more });
  const running = (more: Partial<JobRow> = {}) => sent({ status: 'running', runner_id: SHARED, ...times, ...more });
  /** The same job, ended `done` with its questions open: Need human. */
  const waiting = (more: Partial<JobRow> = {}) => running({ status: 'done', outcome: 'human', exit_code: 0, ended_at: T0.toISOString(), ...more });
  const failed = (more: Partial<JobRow> = {}) => running({ status: 'failed', exit_code: 1, reason: 'exit 1', ended_at: T0.toISOString(), ...more });

  /** The service with a notifier that records each ping, with the status the store held for its job when the ping was made. */
  function pinging(options: Parameters<typeof world>[0] = {}) {
    const pings: (Ping & { stored: string | undefined })[] = [];
    const checked: string[] = [];
    const held: { jobs: JobRow[] } = { jobs: [] };
    const notifier: Notifier = {
      check: (url) => { checked.push(url); return Promise.resolve(url.includes('/refused') ? 'is refused here' : null); },
      ping: (ping) => { pings.push({ ...ping, stored: held.jobs.find((job) => job.id === ping.jobId)?.status }); },
    };
    const w = world({ ...options, notifier });
    held.jobs = w.state.jobs;
    return { ...w, pings, checked };
  }
  const ping = (job: Pick<JobRow, 'id'>, event: Ping['event'], stored: string, when: Date = T0) => ({ url: NOTIFY, jobId: job.id, event, at: when.toISOString(), stored });

  describe('sending', () => {
    it('stores the link and whom the key acts for, as given, queues the job and pings nothing yet', async () => {
      const w = pinging();
      const queued = value(await w.service.sendByKey(key, { repo: 'demo-org/app', line: '/omni:bug-fix Issue 548 totals', actingFor: ' Jane D. ', notifyUrl: NOTIFY }));
      expect(queued).toMatchObject({ status: 'queued', actingFor: ' Jane D. ' });
      expect(w.state.jobs[0]).toMatchObject({ acting_for: ' Jane D. ', notify_url: NOTIFY, sent_by_key: API_KEY, status: 'queued' });
      expect(w.pings).toEqual([]);
    });

    it('stores neither when the key sends neither, as a start has always been', async () => {
      const w = pinging();
      value(await w.service.sendByKey(key, { repo: 'demo-org/app', line: '/omni:bug-fix Issue 548 totals' }));
      expect(w.state.jobs[0]).toMatchObject({ acting_for: null, notify_url: null });
    });

    it('stores one without the other', async () => {
      const w = pinging();
      value(await w.service.sendByKey(key, { repo: 'demo-org/app', line: '/omni:bug-fix a', notifyUrl: NOTIFY }));
      value(await w.service.sendByKey(key, { repo: 'demo-org/app', line: '/omni:bug-fix b', actingFor: 'Jane D.' }));
      expect(w.state.jobs.map((job) => [job.acting_for, job.notify_url])).toEqual([[null, NOTIFY], ['Jane D.', null]]);
    });

    it('answers whether a link may be pinged with the notifier\'s own check, which no send repeats', async () => {
      const w = pinging();
      expect(await w.service.notifyCheck(NOTIFY)).toBeNull();
      expect(await w.service.notifyCheck('https://hooks.example.com/refused')).toBe('is refused here');
      expect(w.checked).toEqual([NOTIFY, 'https://hooks.example.com/refused']);
      value(await w.service.sendByKey(key, { repo: 'demo-org/app', line: '/omni:bug-fix a', notifyUrl: 'https://hooks.example.com/refused' }));
      expect(w.checked).toHaveLength(2);
    });

    it('has a notifier that refuses every link and pings nothing when none is given, so a link is never taken that no ping could reach', async () => {
      const { store } = fakeStore({ jobs: [sent()] });
      const service = runnersService(store, { now: () => T0, sleep: () => Promise.resolve() });
      expect(await service.notifyCheck(NOTIFY)).toEqual(expect.stringContaining('ping'));
      expect(value(await service.next(OLGA, CIA_BOX))?.id).toBeTruthy();
    });
  });

  describe('a runner claiming and reporting', () => {
    it('pings status when the job is claimed, after it is stored, with the time of the change', async () => {
      const job = sent();
      const w = pinging({ jobs: [job], start: at(30) });
      expect(value(await w.service.next(OLGA, CIA_BOX))?.id).toBe(job.id);
      expect(w.pings).toEqual([ping(job, 'status', 'claimed', at(30))]);
    });

    it('pings nothing for a job with no link, whatever it does', async () => {
      const job = sent({ notify_url: null, sent_by_key: null });
      const w = pinging({ jobs: [job] });
      value(await w.service.next(OLGA, CIA_BOX));
      value(await w.service.update(OLGA, job.id, { status: 'running' }));
      value(await w.service.update(OLGA, job.id, { status: 'done', exitCode: 0, outcome: 'pr-opened' }));
      expect(w.pings).toEqual([]);
    });

    it('pings status when it starts running, and nothing for a report that changes neither its status nor its outcome', async () => {
      const job = claimed();
      const w = pinging({ jobs: [job] });
      value(await w.service.update(OLGA, job.id, { status: 'running' }));
      value(await w.service.update(OLGA, job.id, { status: 'running', logTail: 'step 2' }));
      value(await w.service.update(OLGA, job.id, { status: 'running', from: 1, lines: ['one', 'two'] }));
      expect(w.pings).toEqual([ping(job, 'status', 'running')]);
    });

    it('pings outcome when it ends with one, a done bug fix with how it ended, and not status as well', async () => {
      const job = running();
      const w = pinging({ jobs: [job] });
      value(await w.service.update(OLGA, job.id, { status: 'done', exitCode: 0, outcome: 'pr-opened' }));
      expect(w.pings).toEqual([ping(job, 'outcome', 'done')]);
    });

    it('pings outcome when a bug fix ends with its questions open, whether or not the runner said need-human', async () => {
      const [said, silent] = [running(), running()];
      const w = pinging({ jobs: [said, silent], questions: [questionsRow({ job_id: said.id }), questionsRow({ job_id: silent.id })] });
      value(await w.service.update(OLGA, said.id, { status: 'done', exitCode: 0, outcome: 'need-human' }));
      value(await w.service.update(OLGA, silent.id, { status: 'done', exitCode: 0 }));
      expect(w.pings).toEqual([ping(said, 'outcome', 'done'), ping(silent, 'outcome', 'done')]);
      expect(w.state.jobs.map((job) => job.outcome)).toEqual(['human', 'human']);
    });

    it('pings status when it ends with no outcome: done with none, failed, or cancelled by its runner', async () => {
      const [done, bad, stopped] = [running(), running(), running({ cancel_requested: true })];
      const w = pinging({ jobs: [done, bad, stopped] });
      value(await w.service.update(OLGA, done.id, { status: 'done', exitCode: 0 }));
      value(await w.service.update(OLGA, bad.id, { status: 'failed', exitCode: 1, reason: 'exit 1' }));
      value(await w.service.update(OLGA, stopped.id, { status: 'cancelled' }));
      expect(w.pings).toEqual([ping(done, 'status', 'done'), ping(bad, 'status', 'failed'), ping(stopped, 'status', 'cancelled')]);
    });

    it('pings nothing for a report that was refused, or that only says what the runner released for a job that ended', async () => {
      const ended = failed();
      const w = pinging({ jobs: [ended] });
      expect(await w.service.update(OLGA, ended.id, { status: 'running' })).toMatchObject({ ok: false, kind: 'conflict' });
      value(await w.service.update(OLGA, ended.id, { status: 'failed', released: [1908], releaseError: null }));
      expect(await w.service.update(MO, ended.id, { status: 'failed' })).toMatchObject({ ok: false, kind: 'forbidden' });
      expect(w.pings).toEqual([]);
    });
  });

  describe('cancelling', () => {
    it('pings status when a queued or a claimed job ends at once, by its sender\'s page or by a key', async () => {
      const [queued, held, byKey] = [sent({ sent_by: OLGA, sent_by_key: null }), claimed(), sent()];
      const w = pinging({ jobs: [queued, held, byKey] });
      value(await w.service.cancel(OLGA, queued.id));
      value(await w.service.cancel(OLGA, held.id));
      value(await w.service.cancelByKey(KEY, byKey.id));
      expect(w.pings).toEqual([ping(queued, 'status', 'cancelled'), ping(held, 'status', 'cancelled'), ping(byKey, 'status', 'cancelled')]);
    });

    it('pings nothing when a running job is only asked to stop, then status when its runner reports it stopped', async () => {
      const job = running();
      const w = pinging({ jobs: [job] });
      value(await w.service.cancelByKey(KEY, job.id));
      value(await w.service.cancelByKey(KEY, job.id));
      expect(w.pings).toEqual([]);
      expect(value(await w.service.update(OLGA, job.id, { status: 'cancelled' }))).toEqual({ cancel: false });
      expect(w.pings).toEqual([ping(job, 'status', 'cancelled')]);
    });

    it('pings nothing for a cancel that is refused: an ended job, or one that is none of the key\'s', async () => {
      const [ended, person] = [failed(), sent({ sent_by_key: null, sent_by: MO, notify_url: NOTIFY })];
      const w = pinging({ jobs: [ended, person] });
      expect(await w.service.cancelByKey(KEY, ended.id)).toMatchObject({ ok: false, kind: 'conflict' });
      expect(await w.service.cancelByKey(KEY, person.id)).toMatchObject({ ok: false, kind: 'missing' });
      expect(await w.service.cancel(OLGA, ended.id)).toMatchObject({ ok: false, kind: 'conflict' });
      expect(w.pings).toEqual([]);
    });
  });

  describe('a runner lost', () => {
    it('pings status for each job a runner that registers again held, and none for a job without a link', async () => {
      const [starting, going, plain] = [claimed(), running(), running({ notify_url: null })];
      const w = pinging({ jobs: [starting, going, plain] });
      value(await w.service.register(OLGA, { name: 'shared', slots: 2, repos: ['demo-org/app'], version: '0.0.388' }));
      expect(w.state.jobs.map((job) => job.reason)).toEqual(['runner lost', 'runner lost', 'runner lost']);
      expect(w.pings).toEqual([ping(starting, 'status', 'failed'), ping(going, 'status', 'failed')]);
    });

    it('pings nothing for the jobs the database ends alone, a silent runner\'s, however it comes to know', async () => {
      const [silent, other] = [running({ runner_id: CIA_BOX }), running({ runner_id: CIA_BOX })];
      const w = pinging({ jobs: [silent, other], start: at(91) });
      value(await w.service.board(MO, WORKSPACE));
      expect(w.state.jobs.map((job) => [job.status, job.reason])).toEqual([['failed', 'runner lost'], ['failed', 'runner lost']]);
      expect(value(await w.service.next(OLGA, SHARED))).toBeNull();
      expect(w.pings).toEqual([]);
    });
  });

  describe('its questions', () => {
    const open = (job: JobRow) => ({ jobs: [job], questions: [questionsRow({ job_id: job.id })] });

    it('pings questions when the job asks them, once', async () => {
      const job = running();
      const w = pinging({ jobs: [job] });
      value(await w.service.ask(OLGA, job.id, ASK));
      expect(await w.service.ask(OLGA, job.id, ASK)).toMatchObject({ ok: false, kind: 'conflict' });
      expect(w.pings).toEqual([ping(job, 'questions', 'running')]);
    });

    it('pings nothing when asking is refused: a job that is not running, or one asked by another runner\'s owner', async () => {
      const [ended, job] = [failed(), running()];
      const w = pinging({ jobs: [ended, job] });
      expect(await w.service.ask(OLGA, ended.id, ASK)).toMatchObject({ ok: false, kind: 'conflict' });
      expect(await w.service.ask(MO, job.id, ASK)).toMatchObject({ ok: false, kind: 'forbidden' });
      expect(w.pings).toEqual([]);
    });

    it('pings questions on the job that asked when a key answers, and the resume it queues keeps the link', async () => {
      const job = waiting();
      const w = pinging(open(job));
      const resume = value(await w.service.answerByKey(KEY, job.id, ANSWERS));
      expect(w.pings).toEqual([ping(job, 'questions', 'done')]);
      expect(w.state.jobs.find((j) => j.id === resume.id)).toMatchObject({ notify_url: NOTIFY, sent_by_key: API_KEY, continues: job.id });
    });

    it('pings questions on the job that asked when the page answers, the answerer being a person', async () => {
      const job = waiting();
      const w = pinging(open(job));
      const resume = value(await w.service.answer(MO, job.id, { answers: ANSWERS }));
      expect(w.pings).toEqual([ping(job, 'questions', 'done')]);
      expect(w.state.jobs.find((j) => j.id === resume.id)).toMatchObject({ notify_url: NOTIFY });
    });

    it('pings questions when a key or a person dismisses them', async () => {
      const [byKey, byPerson] = [waiting(), waiting()];
      const w = pinging({ jobs: [byKey, byPerson], questions: [questionsRow({ job_id: byKey.id }), questionsRow({ job_id: byPerson.id })] });
      value(await w.service.dismissByKey(KEY, byKey.id));
      value(await w.service.dismiss(OLGA, byPerson.id));
      expect(w.pings).toEqual([ping(byKey, 'questions', 'done'), ping(byPerson, 'questions', 'done')]);
    });

    it('pings once for a round that two close, the second being refused, and nothing for an answer or a dismissal that is refused', async () => {
      const job = waiting();
      const w = pinging(open(job));
      value(await w.service.answerByKey(KEY, job.id, ANSWERS));
      expect(await w.service.answer(MO, job.id, { answers: ANSWERS })).toMatchObject({ ok: false, kind: 'conflict' });
      expect(await w.service.answerByKey(KEY, job.id, ANSWERS)).toMatchObject({ ok: false, kind: 'conflict' });
      expect(await w.service.dismissByKey(KEY, job.id)).toMatchObject({ ok: false, kind: 'conflict' });
      expect(await w.service.dismiss(OLGA, job.id)).toMatchObject({ ok: false, kind: 'conflict' });
      const mismatch = waiting();
      const m = pinging(open(mismatch));
      expect(await m.service.answerByKey(KEY, mismatch.id, { 'Another?': 'x' })).toMatchObject({ ok: false, kind: 'malformed' });
      expect(await m.service.dismissByKey(KEY, '00000000-0000-4000-8000-0000024259f9')).toMatchObject({ ok: false, kind: 'missing' });
      expect(w.pings).toHaveLength(1);
      expect(m.pings).toEqual([]);
    });

    it('pings nothing for a person\'s job with no link, whoever closes its round', async () => {
      const job = waiting({ notify_url: null, sent_by_key: null, sent_by: MO });
      const w = pinging(open(job));
      value(await w.service.answer(OLGA, job.id, { answers: ANSWERS }));
      expect(w.pings).toEqual([]);
    });
  });

  describe('the jobs that carry it on', () => {
    it('pings the resume of an answered job when a runner claims it, at its own id, as the thread continues', async () => {
      const job = waiting();
      const w = pinging({ jobs: [job], questions: [questionsRow({ job_id: job.id })] });
      const resume = value(await w.service.answerByKey(KEY, job.id, ANSWERS));
      value(await w.service.next(OLGA, CIA_BOX));
      expect(w.pings).toEqual([ping(job, 'questions', 'done'), ping(resume, 'status', 'claimed')]);
    });

    it('pings the relaunch of a failed job when a runner claims it, and the job it replaces never again', async () => {
      const job = failed({ to_fleet: 'cia' });
      const w = pinging({ jobs: [job] });
      const relaunched = value(await w.service.relaunchByKey(KEY, job.id));
      expect(w.pings).toEqual([]);
      value(await w.service.next(OLGA, CIA_BOX));
      expect(w.pings).toEqual([ping(relaunched, 'status', 'claimed')]);
    });
  });
});

// A job's parts (PRD 2537, s3): a job's report stores the parts its runner sent in `runner_jobs.parts`, a
// later report without them keeps them, and the page reads them with the job; a job whose runner never
// sent any reads none.
describe("a job's parts (PRD 2537, s3)", () => {
  const LIMIT = { agent: 'claude', model: 'claude-opus-5-5', account: 'claude-1', from: '2026-10-27T13:41:02.000Z', to: '2026-10-27T14:02:11.000Z', ended: 'limit' as const, resetsAt: '2026-10-27T18:00:00.000Z', guessed: false, note: 'runner' as const };
  const RUNNING = { agent: 'codex', model: 'gpt-5-codex', account: 'codex-1', from: '2026-10-27T14:02:15.000Z', to: null, ended: null };

  it('stores the parts a job report carries, keeps them when a later one carries none, and shows them with the job', async () => {
    const job = jobRow({ status: 'claimed', runner_id: SHARED, claimed_at: T0.toISOString() });
    const w = world({ jobs: [job] });
    value(await w.service.update(OLGA, job.id, { status: 'running', parts: [LIMIT, RUNNING] }));
    expect(w.state.jobs[0]?.parts).toEqual([LIMIT, RUNNING]);
    value(await w.service.update(OLGA, job.id, { status: 'running', logTail: 'working' }));
    expect(w.state.jobs[0]?.parts).toEqual([LIMIT, RUNNING]);
    const done = { ...RUNNING, to: '2026-10-27T14:30:00.000Z', ended: 'done' as const };
    value(await w.service.update(OLGA, job.id, { status: 'done', parts: [LIMIT, done] }));
    const board = value(await w.service.board(MO, RUNNERS[0]?.workspace_id ?? ''));
    expect(board.jobs.find((j) => j.id === job.id)?.parts).toEqual([LIMIT, done]);
  });

  it('shows a job whose runner never reported parts with none', async () => {
    const job = jobRow({ status: 'claimed', runner_id: SHARED, claimed_at: T0.toISOString() });
    const w = world({ jobs: [job] });
    value(await w.service.update(OLGA, job.id, { status: 'running' }));
    const board = value(await w.service.board(MO, RUNNERS[0]?.workspace_id ?? ''));
    expect(board.jobs.find((j) => j.id === job.id)?.parts).toBeNull();
  });
});

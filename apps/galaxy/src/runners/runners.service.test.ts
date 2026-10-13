import { describe, expect, it } from 'vitest';
import type { JobRow, RunnerRow } from './runners.repository';
import { cutLogTail, NEXT_POLL_MS, runnersService, runnerState } from './runners.service';
import {
  CIA_BOX, EVE, fakeStore, jobRow, MO, OLGA, OTHER, PIA, runnerRow, RUNNERS, SAM, SHARED, T0,
} from './fixtures/store.fake';

// The runners' rules (PRD 1830 s1), on realistic rows in memory and a fixed clock: which jobs a runner
// takes, when a silent runner's jobs end as `runner lost`, which reports a job accepts, and who may
// send, cancel and give a runner to a fleet.

const at = (seconds: number) => new Date(T0.getTime() + seconds * 1000);

/** The service on the fake store, with a clock that a held `next` moves forward as it sleeps. */
function world({ jobs = [], runners = RUNNERS, start = T0, onSleep }: { jobs?: JobRow[]; runners?: RunnerRow[]; start?: Date; onSleep?: (jobs: JobRow[]) => void } = {}) {
  let now = start;
  const slept: number[] = [];
  const { store, state } = fakeStore({ jobs, runners, now: () => now });
  const service = runnersService(store, {
    now: () => now,
    sleep: (ms) => {
      slept.push(ms);
      now = new Date(now.getTime() + ms);
      onSleep?.(state.jobs);
      return Promise.resolve();
    },
  });
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
    const { service } = world({ jobs: [jobRow({ to_runner: OTHER, repo: 'vertuoza/app' })] });
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
    expect(value(await service.next(OLGA, SHARED))).toEqual({ id: job.id, line: '/omni:pr-care 1801', repo: 'vertuoza/app', sentBy: 'mo' });
  });
});

describe('the long poll', () => {
  it('answers a job at once, counted as a check-in', async () => {
    const { service, state, slept } = world({ jobs: [jobRow()], runners: [runnerRow({ id: SHARED, name: 'shared', last_seen_at: at(-60).toISOString() })] });
    expect(value(await service.next(OLGA, SHARED))).not.toBeNull();
    expect(slept).toEqual([]);
    expect(state.runners[0]?.last_seen_at).toBe(T0.toISOString());
  });

  it('holds up to 50 seconds, checking in each time it looks, then answers none', async () => {
    const { service, state, slept } = world();
    expect(value(await service.next(OLGA, SHARED))).toBeNull();
    expect(slept.reduce((sum, ms) => sum + ms, 0)).toBeLessThanOrEqual(50_000);
    expect(slept.length).toBe(50_000 / NEXT_POLL_MS);
    expect(Date.parse(state.runners[0]?.last_seen_at ?? '')).toBeGreaterThan(at(45).getTime());
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
    expect(value(await w.service.update(OLGA, job.id, { status: 'done', prUrl: 'https://github.com/vertuoza/app/pull/12', exitCode: 0, logTail: 'opened #12' })))
      .toEqual({ cancel: false });
    expect(w.state.jobs[0]).toMatchObject({
      status: 'done', running_at: T0.toISOString(), ended_at: at(60).toISOString(), pr_url: 'https://github.com/vertuoza/app/pull/12', exit_code: 0, log_tail: 'opened #12',
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
    const job = claimed();
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
    const first = value(await w.service.register(OLGA, { name: 'vertuo-agents', slots: 4, repos: ['Vertuoza/App', 'vertuoza/app', 'vertuoza/other'], version: '0.0.387' }));
    expect(first).toMatchObject({ name: 'vertuo-agents', fleet: null });
    expect(w.state.runners[0]).toMatchObject({ owner: OLGA, repos: ['vertuoza/app', 'vertuoza/other'], slots: 4 });
    w.setNow(at(300));
    const again = value(await w.service.register(OLGA, { name: 'vertuo-agents', slots: 2, repos: ['vertuoza/app'], version: '0.0.388' }));
    expect(again.id).toBe(first.id);
    expect(w.state.runners).toHaveLength(1);
    expect(w.state.runners[0]).toMatchObject({ slots: 2, version: '0.0.388', last_seen_at: at(300).toISOString() });
  });

  it('refuses a name another person registered, a repository outside the workspace, and two workspaces', async () => {
    const w = world();
    expect(await w.service.register(MO, { name: 'shared', slots: 1, repos: ['vertuoza/app'], version: '1' })).toMatchObject({ ok: false, kind: 'forbidden' });
    expect(await w.service.register(OLGA, { name: 'x', slots: 1, repos: ['elsewhere/app'], version: '1' }))
      .toMatchObject({ ok: false, kind: 'forbidden', error: 'elsewhere/app is not in your workspace: you are not a member of the workspace that owns elsewhere/app.' });
    expect(await w.service.register(EVE, { name: 'x', slots: 1, repos: ['elsewhere/app', 'vertuoza/app'], version: '1' })).toMatchObject({ ok: false, kind: 'forbidden' });
  });
});

describe('who may send where', () => {
  const send = (target: Parameters<ReturnType<typeof runnersService>['send']>[1]['target'], line = '/omni:yolo 1717', repo = 'vertuoza/app') => ({ line, repo, target });

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

describe('cancelling', () => {
  it('ends a queued job at once', async () => {
    const job = jobRow({ sent_by: MO });
    const w = world({ jobs: [job] });
    expect(value(await w.service.cancel(MO, job.id))).toMatchObject({ status: 'cancelled', cancelRequested: true, endedAt: T0.toISOString() });
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
    const done = jobRow({ status: 'done', runner_id: CIA_BOX, claimed_at: T0.toISOString(), ended_at: at(-10).toISOString(), pr_url: 'https://github.com/vertuoza/app/pull/1' });
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
});

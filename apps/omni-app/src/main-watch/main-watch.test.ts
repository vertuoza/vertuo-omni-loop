import { InngestTestEngine, mockCtx } from '@inngest/test';
import { type Mock, describe, expect, it } from 'vitest';
import { parsePr } from 'omni-loop/kit/lib/ids.ts';
import { inngest } from '../inngest-client.ts';
import { httpError, replayGitHub } from '../../test/github-replay.ts';
import { CONFIG, FEATURE, SUB_PULLS, mergeFiles } from '../../test/retro-scenario.ts';
import { DAY_EVENT, DAY_WAIT } from '../retro/retro.ts';
import type { ApplyQueue } from '../retro/runner-queue.ts';
import type { Octokit } from '../retro/retro.types.ts';
import { megaScenario } from '../retro/targets.fixtures/mega.ts';
import { MAIN_WATCH_CI_EVENT, MAIN_WATCH_EVENT } from './events.ts';
import { CI_STEP, CI_WAIT, CLOCK_STEP, MAIN_WATCH_FUNCTION_ID, REWIND_STEP, WAIT_STEP, createMainWatch } from './main-watch.ts';
import type { Break } from './signals.ts';
import type { MainWatchStore } from './store.ts';

const SHA = 'a'.repeat(40);
const PARENT = 'b'.repeat(40);
const MERGED_AT = '2026-09-20T12:00:00.000Z';
const DAY_MS = 24 * 60 * 60 * 1000;
const at = (days: number, minutes = 0) => Date.parse(MERGED_AT) + days * DAY_MS + minutes * 60_000;
const iso = (days: number, minutes = 0) => new Date(at(days, minutes)).toISOString();

// ---- A stubbed GitHub: the retro's scenario for the merge, and the signals a test sets ------------

type Job = { id: number; name: string; conclusion: string; html_url: string; completed_at: string };
type Signals = {
  runs: Record<string, { id: number; name: string }[]>;
  jobs: Record<number, Job[]>;
  parents: Record<string, string>;
  commits: { sha: string; html_url: string; commit: { message: string; committer: { date: string } } }[];
  issues: Record<string, unknown>[];
  comments: Record<number, { body: string }[]>;
  refused: Set<string>;
};

const noSignals = (): Signals => ({ runs: {}, jobs: {}, parents: {}, commits: [], issues: [], comments: {}, refused: new Set() });

const RUNS = 'GET /repos/{owner}/{repo}/actions/runs';
const JOBS = 'GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs';
const COMMIT = 'GET /repos/{owner}/{repo}/commits/{ref}';
const COMMITS = 'GET /repos/{owner}/{repo}/commits';
const ISSUES = 'GET /repos/{owner}/{repo}/issues';
const COMMENTS = 'GET /repos/{owner}/{repo}/issues/{issue_number}/comments';

/** `octokit`, answering the watch's reads from `signals`; a page past the first is empty. */
function withSignals(octokit: Octokit, signals: Signals): Octokit {
  const answers: Record<string, (params: Record<string, unknown>) => unknown> = {
    [RUNS]: ({ head_sha: sha }) => ({ workflow_runs: signals.runs[String(sha)] ?? [] }),
    [JOBS]: ({ run_id: run }) => ({ jobs: signals.jobs[Number(run)] ?? [] }),
    [COMMIT]: ({ ref }) => ({ sha: ref, parents: [{ sha: signals.parents[String(ref)] ?? PARENT }] }),
    [COMMITS]: () => signals.commits,
    [ISSUES]: () => signals.issues,
    [COMMENTS]: ({ issue_number: number }) => signals.comments[Number(number)] ?? [],
  };
  return {
    request(route, params = {}) {
      const answer = answers[route];
      if (!answer) return octokit.request(route, params);
      if (signals.refused.has(route)) return Promise.reject(httpError(403, 'Resource not accessible by integration'));
      return Promise.resolve({ data: Number(params.page ?? 1) > 1 ? (route === RUNS ? { workflow_runs: [] } : route === JOBS ? { jobs: [] } : []) : answer(params) });
    },
  };
}

const red = (id: number, name: string): Job => ({ id, name, conclusion: 'failure', html_url: `https://github.com/acme/widgets/actions/runs/1/job/${id}`, completed_at: iso(0, 20) });
const green = (id: number, name: string): Job => ({ ...red(id, name), conclusion: 'success' });

/** PRD 7 of `acme/widgets`, merged through #12 at `SHA`, its signals `signals`. */
function widgets({ config = CONFIG, signals = noSignals() }: { config?: string; signals?: Signals } = {}) {
  const github = replayGitHub({ commits: { [SHA]: mergeFiles({ config }) }, pulls: [{ ...FEATURE, merge_commit_sha: SHA, merged_at: MERGED_AT }, ...SUB_PULLS] });
  const event = {
    name: MAIN_WATCH_EVENT,
    data: { installationId: 7, owner: 'acme', repo: 'widgets', repository: 'acme/widgets', prNumber: parsePr(12), mergeSha: SHA, mergedAt: MERGED_AT },
  };
  return { octokit: withSignals(github.octokit, signals), signals, event };
}

// ---- An in-memory store and queue, with the database's semantics ---------------------------------

type Row = { workspace: string; repository: string; prd: number; lane: string; mergeSha: string; status: string; unread: string[]; watchUntil: string };

function memoryStore(workspaces: Record<number, string> = { 7: 'ws-1' }) {
  const watches = new Map<string, Row>();
  const breaks = new Map<string, Break & { lane: string }>();
  const key = (...parts: unknown[]) => parts.map(String).join('|');
  const store: MainWatchStore = {
    open({ installationId, repository, prd, lanes }) {
      const workspace = workspaces[installationId];
      if (!workspace) return Promise.resolve({ workspace: null, reason: `no workspace holds the installation ${String(installationId)}`, opened: 0 });
      let opened = 0;
      for (const one of lanes) {
        const id = key(workspace, repository, prd, one.lane);
        if (watches.has(id)) continue;
        watches.set(id, { workspace, repository, prd, lane: one.lane, mergeSha: one.mergeSha, status: 'watching', unread: [], watchUntil: one.watchUntil });
        opened += 1;
      }
      return Promise.resolve({ workspace, reason: null, opened });
    },
    mark({ workspace, repository, prd, lane, breaks: found, unread }) {
      const row = watches.get(key(workspace, repository, prd, lane));
      if (!row) throw new Error(`no watch for ${lane}`);
      let added = 0;
      for (const one of found) {
        const id = key(workspace, repository, prd, lane, one.kind, one.source);
        if (breaks.has(id)) continue;
        breaks.set(id, { ...one, lane });
        added += 1;
      }
      if (row.status !== 'clean') {
        row.unread = [...unread];
        if (found.length > 0) row.status = 'broke';
      }
      return Promise.resolve({ added });
    },
    close({ workspace, repository, prd, lane }) {
      const row = watches.get(key(workspace, repository, prd, lane));
      if (!row || row.status !== 'watching') return Promise.resolve({ closed: false });
      row.status = 'clean';
      row.unread = [];
      return Promise.resolve({ closed: true });
    },
  };
  return { store, watches, breaks };
}

function memoryQueue() {
  const calls: Parameters<ApplyQueue>[0][] = [];
  const jobs = new Map<string, string>();
  const queue: ApplyQueue = (job) => {
    calls.push(job);
    const id = `${String(job.installationId)}|${job.repository}|${job.line}`;
    const found = jobs.get(id);
    if (found) return Promise.resolve({ job: found, created: false, reason: null });
    jobs.set(id, `job-${String(jobs.size + 1)}`);
    return Promise.resolve({ job: `job-${String(jobs.size)}`, created: true, reason: null });
  };
  return { queue, calls, jobs };
}

// ---- The engine: the waits answered by id, the days passed as a test says ------------------------

type Ctx = { step: { run: Mock<(id: string) => unknown>; waitForEvent: Mock<(id: string, options: { event: string; timeout: number; if?: string }) => unknown> } };
type Ran = { ctx: Ctx; result: unknown; error: unknown };

/** Answers the run's waits by step id, each once however often the run replays; a wait nobody answers fails the run. */
function answering(waits: Record<string, () => unknown>) {
  const given = new Map<string, unknown>();
  return (ctx: Parameters<typeof mockCtx>[0]): ReturnType<typeof mockCtx> => {
    const mocked = mockCtx(ctx);
    const waitForEvent = mocked.step.waitForEvent as unknown as Mock<(id: string) => Promise<unknown>>;
    waitForEvent.mockImplementation((id: string) => {
      const answer = waits[id];
      if (answer === undefined) return Promise.reject(new Error(`nobody answers the wait ${id}`));
      if (!given.has(id)) given.set(id, answer());
      return Promise.resolve(given.get(id));
    });
    return mocked;
  };
}

const tick = (ts: number) => ({ name: DAY_EVENT, data: {}, id: `tick-${String(ts)}`, ts });

/**
 * The seven days: the CI wait ends after `ciAt` minutes (on a red suite, or its timeout), then a tick
 * each day; `on[day]` runs when that day's tick comes, to change what GitHub holds.
 */
function week({ on = {}, ciAt = 30 }: { on?: Record<number, () => void>; ciAt?: number } = {}) {
  const waits: Record<string, () => unknown> = { [CI_STEP]: () => (on[0]?.(), null) };
  for (let day = 1; day <= 7; day += 1) waits[`${WAIT_STEP}-${String(day)}`] = () => (on[day]?.(), tick(at(day, 1)));
  return { steps: [{ id: `${CLOCK_STEP}-0`, handler: () => at(0, ciAt) }], waits };
}

type Deps = { octokitFor: (id: number) => Octokit; appOctokit?: Octokit | null; store: MainWatchStore | null; queue?: ApplyQueue | null };

async function run(deps: Deps, event: unknown, days = week()): Promise<Ran> {
  const fn = createMainWatch({ client: inngest, octokitFor: deps.octokitFor, appOctokit: deps.appOctokit ? () => deps.appOctokit as Octokit : null, store: deps.store, queue: deps.queue ?? null });
  const engine = new InngestTestEngine({ function: fn, events: [event as never], steps: days.steps, transformCtx: answering(days.waits) }) as unknown as { execute(): Promise<Ran> };
  return engine.execute();
}

const ranSteps = (ctx: Ctx) => ctx.step.run.mock.calls.map(([id]) => id);
const statusOf = (rows: Map<string, Row>) => Object.fromEntries([...rows.values()].map((row) => [row.lane, { status: row.status, unread: row.unread }]));

describe('main-watch — a PRD’s seven days on main, against a stubbed GitHub (PRD 2410)', () => {
  it('opens one watch for the PRD’s repository, and seven quiet days on the daily tick make it clean', async () => {
    const { octokit, event } = widgets();
    const db = memoryStore();
    const { ctx, result, error } = await run({ octokitFor: () => octokit, store: db.store, queue: memoryQueue().queue }, event);

    expect(error).toBeUndefined();
    expect(statusOf(db.watches)).toEqual({ 'acme/widgets': { status: 'clean', unread: [] } });
    expect([...db.watches.values()][0]).toMatchObject({ workspace: 'ws-1', repository: 'acme/widgets', prd: 7, mergeSha: SHA, watchUntil: iso(7) });
    expect(result).toEqual({ prd: 7, lanes: [{ lane: 'acme/widgets', status: 'clean', unread: [] }], queued: null });
    expect(ranSteps(ctx)).toEqual(['qualify', 'gather-pulls', 'open', `${CLOCK_STEP}-0`, ...[0, 1, 2, 3, 4, 5, 6, 7].flatMap((turn) => [`read-${String(turn)}-acme/widgets`, `record-${String(turn)}`]), 'close-acme/widgets']);
  });

  it('waits first for a red check suite on its merge commit, a day at most, then on the retro’s daily tick', async () => {
    const { octokit, event } = widgets();
    const { ctx } = await run({ octokitFor: () => octokit, store: memoryStore().store }, event);
    const waits = ctx.step.waitForEvent.mock.calls;
    expect(waits[0]).toEqual([CI_STEP, { event: MAIN_WATCH_CI_EVENT, timeout: CI_WAIT, if: `async.data.sha == '${SHA}'` }]);
    expect(waits.slice(1).map(([id, options]) => [id, options])).toEqual([1, 2, 3, 4, 5, 6, 7].map((day) => [`${WAIT_STEP}-${String(day)}`, { event: DAY_EVENT, timeout: DAY_WAIT }]));
    expect(waits.every(([, options]) => options.timeout <= 7 * DAY_MS)).toBe(true);
  });

  it('a red job on the merge commit, a red a re-run turned green too, makes it broke at the first look, the parent’s result kept', async () => {
    const signals = noSignals();
    signals.runs[SHA] = [{ id: 1, name: 'CI' }];
    signals.jobs[1] = [red(10, 'unit'), green(11, 'unit')];
    signals.runs[PARENT] = [{ id: 2, name: 'CI' }];
    signals.jobs[2] = [green(20, 'unit')];
    const { octokit, event } = widgets({ signals });
    const db = memoryStore();
    const rewind = memoryQueue();
    const { result } = await run({ octokitFor: () => octokit, store: db.store, queue: rewind.queue }, event);

    expect(statusOf(db.watches)).toEqual({ 'acme/widgets': { status: 'broke', unread: [] } });
    expect([...db.breaks.values()]).toEqual([
      { lane: 'acme/widgets', kind: 'ci-red', source: '1/unit', url: 'https://github.com/acme/widgets/actions/runs/1/job/10', title: 'CI › unit', parent: 'green', at: iso(0, 20) },
    ]);
    expect(rewind.calls).toEqual([{ installationId: 7, repository: 'acme/widgets', line: '/omni:rewind 7' }]);
    expect(result).toMatchObject({ lanes: [{ lane: 'acme/widgets', status: 'broke' }], queued: { job: 'job-1', created: true } });
  });

  it('a revert naming a sub-PR on day three makes it broke then, and queues the rewind once whatever breaks after', async () => {
    const signals = noSignals();
    const { octokit, event } = widgets({ signals });
    const db = memoryStore();
    const rewind = memoryQueue();
    const revert = (sha: string, message: string, day: number) => ({ sha, html_url: `https://github.com/acme/widgets/commit/${sha}`, commit: { message, committer: { date: iso(day) } } });
    const days = week({
      on: {
        3: () => signals.commits.push(revert('c'.repeat(40), `Revert "${SUB_PULLS[0]?.title ?? ''} (#13)" (#30)\n\nReverts acme/widgets#13`, 3)),
        5: () => signals.issues.push({ number: 41, title: 'The colour is lost', body: 'Since #7.', html_url: 'https://github.com/acme/widgets/issues/41', created_at: iso(5), user: { type: 'User' }, labels: [] }),
      },
    });
    const { ctx } = await run({ octokitFor: () => octokit, store: db.store, queue: rewind.queue }, event, days);

    expect([...db.breaks.values()].map(({ kind, source }) => [kind, source])).toEqual([
      ['revert', 'c'.repeat(40)],
      ['regression', '41'],
    ]);
    expect(statusOf(db.watches)).toEqual({ 'acme/widgets': { status: 'broke', unread: [] } });
    expect(rewind.calls).toHaveLength(1);
    expect(ranSteps(ctx).filter((id) => id === REWIND_STEP)).toEqual([REWIND_STEP]);
    expect(ranSteps(ctx).indexOf(REWIND_STEP)).toBe(ranSteps(ctx).indexOf('record-3') + 1);
    expect(ranSteps(ctx)).not.toContain('close-acme/widgets');
  });

  it('an issue naming the PRD opened on day eight changes nothing: the watch ends clean', async () => {
    const signals = noSignals();
    signals.issues.push({ number: 42, title: 'Late', body: 'Day eight: #7 broke it.', html_url: 'https://github.com/acme/widgets/issues/42', created_at: iso(8), user: { type: 'User' }, labels: [] });
    const { octokit, event } = widgets({ signals });
    const db = memoryStore();
    const rewind = memoryQueue();
    await run({ octokitFor: () => octokit, store: db.store, queue: rewind.queue }, event);
    expect(statusOf(db.watches)).toEqual({ 'acme/widgets': { status: 'clean', unread: [] } });
    expect(db.breaks.size).toBe(0);
    expect(rewind.calls).toEqual([]);
  });

  it('a read GitHub refused keeps it watching past its seven days, the unread signal named, never clean', async () => {
    const signals = noSignals();
    signals.refused.add(RUNS);
    const { octokit, event } = widgets({ signals });
    const db = memoryStore();
    const { ctx, result } = await run({ octokitFor: () => octokit, store: db.store }, event);
    expect(statusOf(db.watches)).toEqual({ 'acme/widgets': { status: 'watching', unread: ['ci'] } });
    expect(result).toMatchObject({ lanes: [{ lane: 'acme/widgets', status: 'watching', unread: ['ci'] }] });
    expect(ranSteps(ctx)).not.toContain('close-acme/widgets');
  });

  it('a replayed event writes nothing new and queues no second rewind', async () => {
    const signals = noSignals();
    signals.runs[SHA] = [{ id: 1, name: 'CI' }];
    signals.jobs[1] = [red(10, 'unit')];
    const { octokit, event } = widgets({ signals });
    const db = memoryStore();
    const rewind = memoryQueue();
    await run({ octokitFor: () => octokit, store: db.store, queue: rewind.queue }, event);
    const [watches, breaks] = [structuredClone([...db.watches.values()]), structuredClone([...db.breaks.values()])];

    const { result } = await run({ octokitFor: () => octokit, store: db.store, queue: rewind.queue }, event);
    expect([...db.watches.values()]).toEqual(watches);
    expect([...db.breaks.values()]).toEqual(breaks);
    expect(rewind.jobs.size).toBe(1);
    expect(result).toMatchObject({ queued: { job: 'job-1', created: false } });
  });

  it('queues the rewind for the installation’s workspace only: no workspace, no watch and no job', async () => {
    const signals = noSignals();
    signals.runs[SHA] = [{ id: 1, name: 'CI' }];
    signals.jobs[1] = [red(10, 'unit')];
    const { octokit, event } = widgets({ signals });
    const db = memoryStore({ 9: 'ws-other' });
    const rewind = memoryQueue();
    const { result } = await run({ octokitFor: () => octokit, store: db.store, queue: rewind.queue }, event);
    expect(result).toEqual({ prd: 7, skipped: 'no workspace holds the installation 7' });
    expect(db.watches.size).toBe(0);
    expect(rewind.calls).toEqual([]);
  });

  it('with mainWatch.enabled false at the merge, opens no watch and reads no signal', async () => {
    const signals = noSignals();
    signals.runs[SHA] = [{ id: 1, name: 'CI' }];
    signals.jobs[1] = [red(10, 'unit')];
    const { octokit, event } = widgets({ config: `${CONFIG}mainWatch:\n  enabled: false\n`, signals });
    const db = memoryStore();
    const rewind = memoryQueue();
    const { ctx, result } = await run({ octokitFor: () => octokit, store: db.store, queue: rewind.queue }, event);
    expect(result).toEqual({ prd: 7, skipped: 'mainWatch.enabled is false at the merge' });
    expect(ranSteps(ctx)).toEqual(['qualify']);
    expect(db.watches.size).toBe(0);
    expect(rewind.calls).toEqual([]);
  });

  it('a merge that is not a feature PR, or no database, watches nothing', async () => {
    const { octokit, event } = widgets();
    const db = memoryStore();
    const notFeature = { ...event, data: { ...event.data, prNumber: parsePr(13) } };
    const { result } = await run({ octokitFor: () => octokit, store: db.store }, notFeature);
    expect(result).toEqual({ skipped: 'The base `feat/widget` is not the default branch `main`.' });
    expect(db.watches.size).toBe(0);
    expect((await run({ octokitFor: () => octokit, store: null }, event)).result).toEqual({ skipped: 'no database to keep the watch in' });
  });

  it('refuses an event of another shape, naming its field', async () => {
    const { octokit } = widgets();
    const { error } = await run({ octokitFor: () => octokit, store: memoryStore().store }, { name: MAIN_WATCH_EVENT, data: { installationId: 7 } });
    expect(String((error as Error | undefined)?.message)).toMatch(/main-watch\.requested.*owner/s);
  });

  it('is its own function, on its own event', () => {
    const fn = createMainWatch({ client: inngest, octokitFor: () => widgets().octokit, store: null, queue: null });
    expect(fn.id()).toBe(MAIN_WATCH_FUNCTION_ID);
    expect(fn.opts.triggers).toEqual([{ event: MAIN_WATCH_EVENT }]);
  });
});

describe('main-watch — a multi-repository PRD (PRD 2410, PRD 1130)', () => {
  /** The retro's multi-repository scenario: the plan repository, its back-end and front-end targets, and mobile, where the App is not installed. */
  function mega(signalsOf: Record<string, Signals>) {
    const scenario = megaScenario();
    const repoOf: Record<number, string> = { 7: 'plan', 21: 'backend', 22: 'frontend' };
    const octokitFor = (id: number) => withSignals(scenario.octokitFor(id), signalsOf[repoOf[id] ?? ''] ?? noSignals());
    return { scenario, octokitFor, event: { name: MAIN_WATCH_EVENT, data: scenario.event.data } };
  }

  it('opens one watch per repository it merged into; one broken target makes the PRD broke, and a target not read keeps its own lane watching', async () => {
    const backend = noSignals();
    backend.runs.m40 = [{ id: 4, name: 'CI' }];
    backend.jobs[4] = [red(40, 'unit')];
    const { scenario, octokitFor, event } = mega({ backend });
    const db = memoryStore();
    const rewind = memoryQueue();
    const { result, error } = await run({ octokitFor, appOctokit: scenario.app, store: db.store, queue: rewind.queue }, event);

    expect(error).toBeUndefined();
    expect(statusOf(db.watches)).toEqual({
      'acme/plan': { status: 'watching', unread: ['target mobile'] },
      'acme/backend': { status: 'broke', unread: [] },
      'acme/frontend': { status: 'clean', unread: [] },
    });
    expect([...db.watches.values()].map((row) => [row.lane, row.repository, row.mergeSha])).toEqual([
      ['acme/plan', 'acme/plan', 'merge1'],
      ['acme/backend', 'acme/plan', 'm40'],
      ['acme/frontend', 'acme/plan', 'm50'],
    ]);
    expect(rewind.calls).toEqual([{ installationId: 7, repository: 'acme/plan', line: '/omni:rewind 7' }]);
    expect(result).toMatchObject({ prd: 7 });
  });
});

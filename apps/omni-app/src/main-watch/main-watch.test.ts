import { describe, expect, it } from 'vitest';
import { parsePr } from 'omni-loop/kit/lib/ids.ts';
import { httpError, replayGitHub } from '../../test/github-replay.ts';
import { CONFIG, FEATURE, SUB_PULLS, mergeFiles } from '../../test/retro-scenario.ts';
import type { ClaimedJob } from '../jobs/ledger.ts';
import { liveWorkers } from '../jobs/pr-checks.ts';
import type { JobResult } from '../jobs/worker.ts';
import type { ApplyQueue } from '../retro/runner-queue.ts';
import type { Octokit } from '../retro/retro.types.ts';
import { megaScenario } from '../retro/targets.fixtures/mega.ts';
import { asSaved, type StepRun } from '../saved-step.ts';
import { MAIN_WATCH_KIND, MAX_LOOKS, REWIND_STEP, mainWatchHandler, mainWatchJob } from './main-watch.ts';
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
  const event = { installationId: 7, owner: 'acme', repo: 'widgets', prNumber: parsePr(12), mergeSha: SHA, mergedAt: MERGED_AT };
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

// ---- The job: runs of the handler on saved steps, the clock moved a day between them ------------

type Payload = Parameters<typeof mainWatchJob>[0];
type Deps = { octokitFor: (id: number) => Octokit; appOctokit?: Octokit | null; store: MainWatchStore | null; queue?: ApplyQueue | null };
type Ran = { results: JobResult[]; ran: string[]; times: number[] };

/** The job of `payload`, claimed with `progress`: what the worker hands the handler. */
function claimed(payload: Payload, progress: Record<string, unknown> = {}): ClaimedJob {
  return { id: 'job-1', ...mainWatchJob(payload), tries: 1, claim: 'claim-1', claimedUntil: '2026-09-20T12:05:00Z', progress };
}

/**
 * The runs of one job, as the worker makes them: the steps saved across runs (`ran` lists those that ran, never one
 * read back), the progress each `later` keeps, the clock at the date it asks for. `before[n]` runs before run `n`,
 * to change what GitHub holds; run 0 opens the watch, run `n` is the look of day `n`.
 */
async function run(deps: Deps, payload: Payload, { before = {}, start = at(0, 30), runs = 20 }: { before?: Record<number, () => void>; start?: number; runs?: number } = {}): Promise<Ran> {
  let now = start;
  const handler = mainWatchHandler({ octokitFor: deps.octokitFor, appOctokit: deps.appOctokit ? () => deps.appOctokit as Octokit : null, store: deps.store, queue: deps.queue ?? null, now: () => now });
  const saved = new Map<string, unknown>();
  const ran: string[] = [];
  const step: StepRun = {
    run: async (id, fn) => {
      if (!saved.has(id)) {
        ran.push(id);
        saved.set(id, asSaved(await fn()));
      }
      return saved.get(id);
    },
  };
  const results: JobResult[] = [];
  const times: number[] = [];
  let progress: Record<string, unknown> = {};
  for (let n = 0; n < runs; n += 1) {
    before[n]?.();
    times.push(now);
    const result = await handler(claimed(payload, progress), { step });
    results.push(result);
    if (result.outcome !== 'later') break;
    progress = result.progress;
    now = result.at.getTime();
  }
  return { results, ran, times };
}

const last = (ran: Ran): JobResult | undefined => ran.results.at(-1);
const statusOf = (rows: Map<string, Row>) => Object.fromEntries([...rows.values()].map((row) => [row.lane, { status: row.status, unread: row.unread }]));

describe('main-watch — a PRD’s seven days on main, a job of the ledger, against a stubbed GitHub (PRD 2410, PRD omni-loop-4 s4)', () => {
  it('opens one watch for the PRD’s repository in its first run and ends later a day on, with no look yet', async () => {
    const { octokit, event } = widgets();
    const db = memoryStore();
    const ended = await run({ octokitFor: () => octokit, store: db.store, queue: memoryQueue().queue }, event, { runs: 1 });

    expect(ended.results).toEqual([{ outcome: 'later', at: new Date(at(1, 30)), progress: { turn: 0, done: [], broke: [] } }]);
    expect(ended.ran).toEqual(['qualify', 'gather-pulls', 'open']);
    expect(statusOf(db.watches)).toEqual({ 'acme/widgets': { status: 'watching', unread: [] } });
    expect([...db.watches.values()][0]).toMatchObject({ workspace: 'ws-1', repository: 'acme/widgets', prd: 7, mergeSha: SHA, watchUntil: iso(7) });
  });

  it('seven quiet days, one look a day, make it clean and end the job done', async () => {
    const { octokit, event } = widgets();
    const db = memoryStore();
    const ended = await run({ octokitFor: () => octokit, store: db.store, queue: memoryQueue().queue }, event);

    expect(statusOf(db.watches)).toEqual({ 'acme/widgets': { status: 'clean', unread: [] } });
    expect(last(ended)).toEqual({ outcome: 'done' });
    expect(ended.results.slice(0, -1).every((result) => result.outcome === 'later')).toBe(true);
    expect(ended.results).toHaveLength(8);
    expect(ended.ran).toEqual(['qualify', 'gather-pulls', 'open', ...[0, 1, 2, 3, 4, 5, 6].flatMap((turn) => [`read-${String(turn)}-acme/widgets`, `record-${String(turn)}`]), 'close-acme/widgets']);
    // Each run asks for the day after the clock it read, never a longer wait: the ledger takes 20 of them.
    expect(ended.results.slice(0, -1).map((result, n) => (result.outcome === 'later' ? result.at.getTime() - (ended.times[n] ?? 0) : 0))).toEqual(Array.from({ length: 7 }, () => DAY_MS));
  });

  it('a run woken before its day has passed still looks, and asks for the day after the wake', async () => {
    const signals = noSignals();
    signals.runs[SHA] = [{ id: 1, name: 'CI' }];
    signals.jobs[1] = [red(10, 'unit')];
    const { octokit, event } = widgets({ signals });
    const db = memoryStore();
    const rewind = memoryQueue();
    const ended = await run({ octokitFor: () => octokit, store: db.store, queue: rewind.queue }, event, { runs: 2 });
    expect(ended.results[1]).toMatchObject({ outcome: 'later', progress: { turn: 1, done: [], broke: ['acme/widgets'] } });
    expect(statusOf(db.watches)).toEqual({ 'acme/widgets': { status: 'broke', unread: [] } });
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
    const ended = await run({ octokitFor: () => octokit, store: db.store, queue: rewind.queue }, event);

    expect(statusOf(db.watches)).toEqual({ 'acme/widgets': { status: 'broke', unread: [] } });
    expect([...db.breaks.values()]).toEqual([
      { lane: 'acme/widgets', kind: 'ci-red', source: '1/unit', url: 'https://github.com/acme/widgets/actions/runs/1/job/10', title: 'CI › unit', parent: 'green', at: iso(0, 20) },
    ]);
    expect(rewind.calls).toEqual([{ installationId: 7, repository: 'acme/widgets', line: '/omni:rewind 7' }]);
    expect(last(ended)).toEqual({ outcome: 'done' });
  });

  it('a revert naming a sub-PR on day three makes it broke then, and queues the rewind once whatever breaks after', async () => {
    const signals = noSignals();
    const { octokit, event } = widgets({ signals });
    const db = memoryStore();
    const rewind = memoryQueue();
    const revert = (sha: string, message: string, day: number) => ({ sha, html_url: `https://github.com/acme/widgets/commit/${sha}`, commit: { message, committer: { date: iso(day) } } });
    const before = {
      3: () => signals.commits.push(revert('c'.repeat(40), `Revert "${SUB_PULLS[0]?.title ?? ''} (#13)" (#30)\n\nReverts acme/widgets#13`, 3)),
      5: () => signals.issues.push({ number: 41, title: 'The colour is lost', body: 'Since #7.', html_url: 'https://github.com/acme/widgets/issues/41', created_at: iso(5), user: { type: 'User' }, labels: [] }),
    };
    const ended = await run({ octokitFor: () => octokit, store: db.store, queue: rewind.queue }, event, { before });

    expect([...db.breaks.values()].map(({ kind, source }) => [kind, source])).toEqual([
      ['revert', 'c'.repeat(40)],
      ['regression', '41'],
    ]);
    expect(statusOf(db.watches)).toEqual({ 'acme/widgets': { status: 'broke', unread: [] } });
    expect(rewind.calls).toHaveLength(1);
    expect(ended.ran.filter((id) => id === REWIND_STEP)).toEqual([REWIND_STEP]);
    expect(ended.ran.indexOf(REWIND_STEP)).toBe(ended.ran.indexOf('record-2') + 1);
    expect(ended.ran).not.toContain('close-acme/widgets');
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
    const ended = await run({ octokitFor: () => octokit, store: db.store }, event);
    expect(statusOf(db.watches)).toEqual({ 'acme/widgets': { status: 'watching', unread: ['ci'] } });
    expect(last(ended)).toEqual({ outcome: 'done' });
    expect(ended.ran).not.toContain('close-acme/widgets');
  });

  it('a replayed job writes nothing new and queues no second rewind', async () => {
    const signals = noSignals();
    signals.runs[SHA] = [{ id: 1, name: 'CI' }];
    signals.jobs[1] = [red(10, 'unit')];
    const { octokit, event } = widgets({ signals });
    const db = memoryStore();
    const rewind = memoryQueue();
    await run({ octokitFor: () => octokit, store: db.store, queue: rewind.queue }, event);
    const [watches, breaks] = [structuredClone([...db.watches.values()]), structuredClone([...db.breaks.values()])];

    const replayed = await run({ octokitFor: () => octokit, store: db.store, queue: rewind.queue }, event);
    expect([...db.watches.values()]).toEqual(watches);
    expect([...db.breaks.values()]).toEqual(breaks);
    expect(rewind.jobs.size).toBe(1);
    expect(last(replayed)).toEqual({ outcome: 'done' });
  });

  it('takes the looks it has left and no more: at its last look it ends done, its lanes still watching', async () => {
    const { octokit, event } = widgets();
    const db = memoryStore();
    const step: StepRun = { run: async (_id, fn) => asSaved(await fn()) };
    const handler = mainWatchHandler({ octokitFor: () => octokit, store: db.store, queue: null, now: () => at(2, 30) });
    expect(await handler(claimed(event, { turn: MAX_LOOKS - 2, done: [], broke: [] }), { step })).toMatchObject({ outcome: 'later' });
    expect(await handler(claimed(event, { turn: MAX_LOOKS - 1, done: [], broke: [] }), { step })).toEqual({ outcome: 'done' });
    expect(statusOf(db.watches)).toEqual({ 'acme/widgets': { status: 'watching', unread: [] } });
  });

  it('queues the rewind for the installation’s workspace only: no workspace, no watch and no job', async () => {
    const signals = noSignals();
    signals.runs[SHA] = [{ id: 1, name: 'CI' }];
    signals.jobs[1] = [red(10, 'unit')];
    const { octokit, event } = widgets({ signals });
    const db = memoryStore({ 9: 'ws-other' });
    const rewind = memoryQueue();
    const ended = await run({ octokitFor: () => octokit, store: db.store, queue: rewind.queue }, event);
    expect(last(ended)).toEqual({ outcome: 'skipped', reason: 'no workspace holds the installation 7' });
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
    const ended = await run({ octokitFor: () => octokit, store: db.store, queue: rewind.queue }, event);
    expect(ended.results).toEqual([{ outcome: 'skipped', reason: 'mainWatch.enabled is false at the merge' }]);
    expect(ended.ran).toEqual(['qualify']);
    expect(db.watches.size).toBe(0);
    expect(rewind.calls).toEqual([]);
  });

  it('a merge that is not a feature PR, or no database, watches nothing', async () => {
    const { octokit, event } = widgets();
    const db = memoryStore();
    const notFeature = { ...event, prNumber: parsePr(13) };
    expect(last(await run({ octokitFor: () => octokit, store: db.store }, notFeature))).toEqual({ outcome: 'skipped', reason: 'The base `feat/widget` is not the default branch `main`.' });
    expect(db.watches.size).toBe(0);
    expect(last(await run({ octokitFor: () => octokit, store: null }, event))).toEqual({ outcome: 'skipped', reason: 'no database to keep the watch in' });
  });

  it('refuses a payload of another shape, naming its field', async () => {
    const { octokit } = widgets();
    const handler = mainWatchHandler({ octokitFor: () => octokit, store: memoryStore().store, queue: null });
    const job: ClaimedJob = { id: 'job-1', kind: MAIN_WATCH_KIND, key: 'acme/widgets#12', subject: 'acme/widgets', payload: { installationId: 7 }, tries: 1, claim: 'c', claimedUntil: iso(0, 5) };
    await expect(handler(job)).rejects.toThrow(/main-watch job carries an unexpected payload.*owner/s);
  });

  it('is a job of its own kind, keyed by repository and pull request, in no lane', () => {
    const job = mainWatchJob({ installationId: 7, owner: 'Acme', repo: 'Widgets', prNumber: parsePr(12), mergeSha: SHA, mergedAt: MERGED_AT });
    expect(job).toMatchObject({ kind: 'main-watch', key: 'acme/widgets#12', subject: 'acme/widgets', maxTries: 4 });
    expect(job.lane).toBeUndefined();
  });
});

describe('main-watch — a multi-repository PRD (PRD 2410, PRD 1130)', () => {
  /** The retro's multi-repository scenario: the plan repository, its back-end and front-end targets, and mobile, where the App is not installed. */
  function mega(signalsOf: Record<string, Signals>) {
    const scenario = megaScenario();
    const repoOf: Record<number, string> = { 7: 'plan', 21: 'backend', 22: 'frontend' };
    const octokitFor = (id: number) => withSignals(scenario.octokitFor(id), signalsOf[repoOf[id] ?? ''] ?? noSignals());
    return { scenario, octokitFor, event: scenario.event.data as Payload };
  }

  it('opens one watch per repository it merged into; one broken target makes the PRD broke, and a target not read keeps its own lane watching', async () => {
    const backend = noSignals();
    backend.runs.m40 = [{ id: 4, name: 'CI' }];
    backend.jobs[4] = [red(40, 'unit')];
    const { scenario, octokitFor, event } = mega({ backend });
    const db = memoryStore();
    const rewind = memoryQueue();
    const ended = await run({ octokitFor, appOctokit: scenario.app, store: db.store, queue: rewind.queue }, event);

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
    expect(last(ended)).toEqual({ outcome: 'done' });
  });
});

describe('main-watch — registered on the worker (PRD omni-loop-4 s4)', () => {
  it('is a kind of the live worker, with no failure hook, so a job never runs on Inngest and the ledger both', () => {
    const { handlers, failures } = liveWorkers({ supabase: { url: 'https://db.example', key: 'service-key' } }, () => Promise.reject(new Error('unused')));
    expect(typeof handlers[MAIN_WATCH_KIND]).toBe('function');
    expect(failures[MAIN_WATCH_KIND]).toBeUndefined();
  });
});

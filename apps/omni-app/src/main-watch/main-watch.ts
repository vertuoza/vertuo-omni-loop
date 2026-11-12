// `main-watch`: what a PRD did to main in the seven days after its feature PR merged (PRD 2410; moved off Inngest
// onto the job ledger by PRD omni-loop-4 s4). A status, not a retro: the retro (PRD 72) runs beside it unchanged,
// and this job never shares a run with it. `/api/github` adds one job for a pull request merged into the default
// branch, keyed `<owner/name>#<pr>`, lower case, in no lane (a watch waiting for its next day holds nothing up).
// Its payload is where and when the pull request merged, never a token (L-GDPR-2).
//
// The first run opens the watch, then ends `later`, a day on:
//
//   step "qualify"            the config at the merge SHA, a feature PR by the app's rule, its PRD (the
//                             retro's own `qualify`); `mainWatch.enabled: false` there ends the job `skipped`
//   step "gather-pulls"       the sub-PRs into the feature branch
//   steps "target-<name>"     a multi-repository PRD's targets, as the retro reads them (PRD 1130)
//   step "open"               one `prd_main_watch` row per lane, a repository the PRD merged into: its own,
//                             then each target whose feature PR merged; a target the App could not read
//                             is named unread on the PRD's own lane, so the PRD never reads clean
//
// Each run after it is one look, on the saved steps above (read back, never run again), numbered by the `turn` its
// progress keeps:
//
//   steps "read-<turn>-<lane>"  each lane's signals, in full (./signals.ts), as the lane's installation
//   step "record-<turn>"      the breaks into the store, a lane `broke` once it has one, and what was not read
//   step "queue-rewind"       on the first break, `/omni:rewind <n>` queued once as a runner job sent by
//                             the app, for the installation's workspace (the retro's runner queue)
//   steps "close-<lane>"      a lane whose seven days are over, with no break and nothing unread: `clean`;
//                             a lane with something unread stays `watching`, read as could not check
//
// then ends `later`, a day on, until every lane's seven days are over: `done`. A red check suite on a watched merge
// commit wakes the job (`background_job_wake`, called by `/api/github`), so its look comes at once, not a day later.
// The clock is read again on every run, never saved. The ledger lets a job ask to run again 20 times: a watch takes
// `MAX_LOOKS` looks at most, then ends `done` with its lanes still `watching`.
//
// Every look reads each signal in full, and the store adds a break only once (its key holds its source), so a
// replayed job, or a look that comes again, writes nothing new. A watch owed at the switch (PRD omni-loop-4 s4,
// ../jobs/gaps.ts) opens its lanes again, which leaves their rows as they are, and carries on from the store.
//
// `mainWatchHandler` takes `octokitFor(installationId)`, the App's own client (to find its installation on a
// target), the store and the runner queue, so a test runs the real job against a stubbed GitHub and an in-memory
// store. No store (no database): the job ends `skipped` before reading.
import { z } from 'zod';
import { parseOrThrow } from 'omni-loop/kit/lib/schema/parse-or-throw.ts';
import { PrNumberSchema, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import type { NewJob } from '../jobs/ledger.ts';
import type { JobHandler, JobResult } from '../jobs/worker.ts';
import type { OctokitFor } from '../octokit-for.ts';
import { memorySteps, savedStep, type StepRun } from '../saved-step.ts';
import { listPullsInto } from '../retro/github.ts';
import { qualify } from '../retro/qualify.ts';
import { PullsIntoSchema, QualifiedSchema, QueuedSchema } from '../retro/retro.schema.ts';
import type { ApplyQueue, Queued } from '../retro/runner-queue.ts';
import { readTargets, type AppOctokit } from '../retro/targets.read.ts';
import type { Config, FeaturePull, Octokit, PullInto, TargetRead } from '../retro/retro.types.ts';
import { ClosedSchema, OpenedSchema, ProgressSchema, ReadSchema, RecordedSchema, type Progress } from './main-watch.schema.ts';
import { readSignals, type Break, type Lane, type SignalScope } from './signals.ts';
import type { MainWatchStore } from './store.ts';

export const MAIN_WATCH_KIND = 'main-watch';

const DAY_MS = 24 * 60 * 60 * 1000;
/** How long a PRD is watched after its merge. */
const WATCH_DAYS = 7;
export const REWIND_STEP = 'queue-rewind';
/** The most looks a watch takes: a day apart, seven days fit well inside it, and the ledger's 20 `later` are not spent. */
export const MAX_LOOKS = 18;

/** A main watch's tries (Inngest's 3 retries, and the first): the 4th that throws fails it. */
const MAX_TRIES = 4;

/** The payload of a `main-watch` job: where and when the pull request merged. */
const MainWatchPayloadSchema = z.looseObject({
  installationId: z.number(),
  owner: z.string().min(1),
  repo: z.string().min(1),
  prNumber: PrNumberSchema,
  mergeSha: z.string().min(1),
  mergedAt: z.string().nullish(),
});
export type MainWatchPayload = z.infer<typeof MainWatchPayloadSchema>;

/** The job of one merged pull request: a delivery sent twice is one job, and the comparison's add of one `/api/github` already added none. */
export function mainWatchJob({ installationId, owner, repo, prNumber, mergeSha, mergedAt }: MainWatchPayload): NewJob {
  const subject = `${owner}/${repo}`.toLowerCase();
  return {
    kind: MAIN_WATCH_KIND,
    key: `${subject}#${String(prNumber)}`,
    subject,
    payload: { installationId, owner, repo, repository: `${owner}/${repo}`, prNumber, mergeSha, mergedAt: mergedAt ?? null },
    maxTries: MAX_TRIES,
  };
}

export type MainWatchDeps = {
  octokitFor: OctokitFor<Octokit>;
  /** The App's own client, which looks up its installation on each target of a multi-repository PRD. */
  appOctokit?: AppOctokit | null;
  /** The watch's tables, as the service role; `null` (no database): nothing is watched. */
  store: MainWatchStore | null;
  /** The runner queue the rewind is queued on; `null`: no rewind is queued. */
  queue: ApplyQueue | null;
  /** The clock, in milliseconds: read on every run, never saved. */
  now?: () => number;
};

/** The handler of the `main-watch` kind: the first run opens the watch, each run after it is one look. */
export function mainWatchHandler(deps: MainWatchDeps): JobHandler {
  return async (job, run) => mainWatch(deps, job.payload, job.progress ?? {}, run?.step ?? memorySteps());
}

async function mainWatch(
  { octokitFor, appOctokit = null, store, queue, now = Date.now }: MainWatchDeps,
  payload: unknown,
  progress: unknown,
  step: StepRun,
): Promise<JobResult> {
  const data = parseOrThrow(MainWatchPayloadSchema, payload, 'The main-watch job carries an unexpected payload');
  if (!store) return { outcome: 'skipped', reason: 'no database to keep the watch in' };
  const github = async () => octokitFor(data.installationId);

  const qualified = await savedStep(step, 'qualify', QualifiedSchema, async () => qualify(await github(), data));
  if (qualified.skip !== null) return { outcome: 'skipped', reason: qualified.skip };
  const { pr, prd, config } = qualified;
  if (!config.mainWatch.enabled) return { outcome: 'skipped', reason: 'mainWatch.enabled is false at the merge' };

  const pulls = await savedStep(step, 'gather-pulls', PullsIntoSchema, async () => listPullsInto(await github(), { owner: data.owner, repo: data.repo, base: pr.headRef }));
  const targets = await readTargets({ step, appOctokit, octokitFor, planSlug: `${data.owner}/${data.repo}`, scope: { config, prd } });
  const { lanes, unreadTargets } = lanesOf({ data, pr, pulls, targets });

  const repository = `${data.owner}/${data.repo}`.toLowerCase();
  const opened = await savedStep(step, 'open', OpenedSchema, () => store.open({ installationId: data.installationId, repository, prd: prd.number, lanes }));
  if (opened.workspace === null) return { outcome: 'skipped', reason: opened.reason ?? 'no workspace' };

  const state = ProgressSchema.safeParse(progress);
  if (!state.success) return waitsFor(now(), { turn: 0, done: [], broke: [] });
  const watch: Watch = {
    step,
    octokitFor,
    store,
    queue,
    workspace: opened.workspace,
    installationId: data.installationId,
    repository,
    prd: prd.number,
    lanes,
    unreadTargets,
    scope: scopeOf(config, prd.number, repository),
  };
  return look(watch, state.data, now());
}

/** The job asked to run again a day on, with what its next look reads. */
function waitsFor(now: number, progress: Progress): JobResult {
  return { outcome: 'later', at: new Date(now + DAY_MS), progress: { turn: progress.turn, done: [...progress.done], broke: [...progress.broke] } };
}

/** The lanes of one PRD: its own repository first, then each target whose feature PR merged; the targets not read, by name. */
function lanesOf({ data, pr, pulls, targets }: { data: MainWatchPayload; pr: FeaturePull; pulls: PullInto[]; targets: TargetRead[] }): { lanes: Lane[]; unreadTargets: string[] } {
  const mergedAt = data.mergedAt ?? pr.mergedAt;
  if (!mergedAt) throw new Error(`#${String(pr.number)} names no time it merged`);
  const own = lane({ slug: `${data.owner}/${data.repo}`, installationId: data.installationId, pr: { ...pr, mergeSha: data.mergeSha, mergedAt }, pulls: [pr, ...pulls] });
  const lanes = [own];
  const unreadTargets: string[] = [];
  for (const target of targets) {
    if (!target.read) {
      unreadTargets.push(`target ${target.name}`);
      continue;
    }
    const merged = target.featurePrs.filter((one) => one.merged && one.mergedAt).at(-1);
    if (merged) lanes.push(lane({ slug: target.repo, installationId: target.installationId, pr: merged, pulls: [...target.featurePrs, ...target.pulls] }));
  }
  return { lanes, unreadTargets };
}

/** One lane: the repository, the merge it watches and its seven days, and the pull requests that may be reverted or traced. */
function lane({ slug, installationId, pr, pulls }: { slug: string; installationId: number; pr: FeaturePull; pulls: { number: Lane['pulls'][number]['number']; title: string }[] }): Lane {
  const [owner = '', repo = ''] = slug.split('/');
  const mergedAt = new Date(pr.mergedAt ?? '').toISOString();
  return {
    lane: slug.toLowerCase(),
    owner,
    repo,
    installationId,
    base: pr.baseRef,
    mergeSha: pr.mergeSha,
    mergedAt,
    watchUntil: new Date(Date.parse(mergedAt) + WATCH_DAYS * DAY_MS).toISOString(),
    pulls: pulls.map(({ number, title }) => ({ number, title })),
  };
}

/** What a look reads beyond the lane: the PRD, its repository and the two labels of its config. */
function scopeOf(config: Config, prd: PrdNumber, repository: string): SignalScope {
  return { prd, planSlug: repository, regressionLabel: config.labels.regression, retroLabel: config.labels.retro };
}

/** One watch, as its looks read and write it. */
type Watch = {
  step: StepRun;
  octokitFor: OctokitFor<Octokit>;
  store: MainWatchStore;
  queue: ApplyQueue | null;
  workspace: string;
  installationId: number;
  repository: string;
  prd: PrdNumber;
  lanes: Lane[];
  unreadTargets: string[];
  scope: SignalScope;
};

/** What one look found on a lane: its breaks, and what was not read (a target not read, on the PRD's own lane). */
type Looked = { breaks: Break[]; unread: string[] };

/**
 * One look at every lane not done: read, record, queue the rewind on the first break, close what is over. Then the
 * job asks for the next day, or ends `done` once every lane's seven days are over (or the looks ran out).
 */
async function look(watch: Watch, progress: Progress, now: number): Promise<JobResult> {
  const { lanes } = watch;
  const turn = progress.turn;
  const done = new Set(progress.done);
  const broke = new Set(progress.broke);
  const open = lanes.filter((one) => !done.has(one.lane));
  const reads = await readLanes(watch, open, turn);
  await recordLanes(watch, open, reads, turn);
  for (const [name, read] of reads) if (read.breaks.length > 0) broke.add(name);
  if (broke.size > 0) await queueRewind(watch);
  for (const one of open) if (now >= Date.parse(one.watchUntil)) done.add(await finish(watch, broke, one, reads.get(one.lane)));
  if (done.size >= lanes.length || turn + 1 >= MAX_LOOKS) return { outcome: 'done' };
  return waitsFor(now, { turn: turn + 1, done: [...done], broke: [...broke] });
}

/** Each open lane's signals, in full, one saved step per lane. */
async function readLanes(watch: Watch, open: readonly Lane[], turn: number): Promise<Map<string, Looked>> {
  const reads = new Map<string, Looked>();
  for (const one of open) {
    const read = await savedStep(watch.step, `read-${String(turn)}-${one.lane}`, ReadSchema, async () => readSignals(await watch.octokitFor(one.installationId), one, watch.scope));
    reads.set(one.lane, { breaks: read.breaks, unread: [...read.unread, ...(one === watch.lanes[0] ? watch.unreadTargets : [])] });
  }
  return reads;
}

/** The look's breaks and unread signals into the store, in one saved step. */
async function recordLanes(watch: Watch, open: readonly Lane[], reads: ReadonlyMap<string, Looked>, turn: number): Promise<void> {
  await savedStep(watch.step, `record-${String(turn)}`, RecordedSchema, async () => {
    let added = 0;
    for (const one of open) {
      const read = reads.get(one.lane) ?? { breaks: [], unread: [] };
      added += (await watch.store.mark({ workspace: watch.workspace, repository: watch.repository, prd: watch.prd, lane: one.lane, breaks: read.breaks, unread: read.unread })).added;
    }
    return { added };
  });
}

/** The rewind, queued once for the installation's workspace, sent by the app; nothing without a queue. */
async function queueRewind({ step, queue, installationId, repository, prd }: Watch): Promise<Queued | null> {
  if (!queue) return null;
  return savedStep(step, REWIND_STEP, QueuedSchema, () => queue({ installationId, repository, line: `/omni:rewind ${String(prd)}` }));
}

/**
 * A lane whose seven days are over: broke, clean when nothing broke it and nothing was unread, else still watching
 * (the lane is done with, and the store keeps it `watching`). The lane's name, to be marked done.
 */
async function finish(watch: Watch, broke: ReadonlySet<string>, one: Lane, read: Looked | undefined): Promise<string> {
  const unread = read?.unread ?? [];
  if (broke.has(one.lane) || unread.length > 0) return one.lane;
  await savedStep(watch.step, `close-${one.lane}`, ClosedSchema, () =>
    watch.store.close({ workspace: watch.workspace, repository: watch.repository, prd: watch.prd, lane: one.lane }),
  );
  return one.lane;
}

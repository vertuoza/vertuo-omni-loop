// `main-watch`: what a PRD did to main in the seven days after its feature PR merged (PRD 2410). A
// status, not a retro: the retro (PRD 72) runs beside it unchanged, and this function never shares a
// run with it.
//
//   step "qualify"            the config at the merge SHA, a feature PR by the app's rule, its PRD (the
//                             retro's own `qualify`); `mainWatch.enabled: false` there ends the run
//   step "gather-pulls"       the sub-PRs into the feature branch
//   steps "target-<name>"     a multi-repository PRD's targets, as the retro reads them (PRD 1130)
//   step "open"               one `prd_main_watch` row per lane, a repository the PRD merged into: its own,
//                             then each target whose feature PR merged; a target the App could not read
//                             is named unread on the PRD's own lane, so the PRD never reads clean
//   "wait-ci"                 a red check suite on a lane's merge commit (`MAIN_WATCH_CI_EVENT`), or a day
//   then, a look per turn, until every lane's seven days are over:
//   steps "read-<turn>-<lane>"  each lane's signals, in full (./signals.ts), as the lane's installation
//   step "record-<turn>"      the breaks into the store, a lane `broke` once it has one, and what was not read
//   step "queue-rewind"       on the first break, `/omni:rewind <n>` queued once as a runner job sent by
//                             the app, for the installation's workspace (the retro's runner queue)
//   steps "close-<lane>"      a lane whose seven days are over, with no break and nothing unread: `clean`;
//                             a lane with something unread stays `watching`, read as could not check
//   "wait-day-<n>"            a day at a time: each wait ends on the retro's daily tick (`DAY_EVENT`), or
//                             after `DAY_WAIT` with none, and then "clock-<n>" reads the time
//
// Every look reads each signal in full, and the store adds a break only once (its key holds its
// source), so a replayed event, or a look that comes again, writes nothing new. The app's Inngest plan
// caps a sleep at seven days, so the watch never sleeps through its seven days in one wait.
//
// `createMainWatch` takes the Inngest client, `octokitFor(installationId)`, the App's own client (to
// find its installation on a target), the store and the runner queue, so a test runs the real function
// against a stubbed GitHub and an in-memory store. No store (no database): the run ends before reading.
import type { Inngest } from 'inngest';
import { parseOrThrow } from 'omni-loop/kit/lib/schema/parse-or-throw.ts';
import type { PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import type { OctokitFor } from '../octokit-for.ts';
import { savedStep, parseSaved, type StepRun } from '../saved-step.ts';
import { listPullsInto } from '../retro/github.ts';
import { qualify } from '../retro/qualify.ts';
import { DAY_EVENT, DAY_WAIT } from '../retro/retro.ts';
import { ClockSchema, PullsIntoSchema, QualifiedSchema, QueuedSchema } from '../retro/retro.schema.ts';
import type { ApplyQueue, Queued } from '../retro/runner-queue.ts';
import { readTargets, type AppOctokit } from '../retro/targets.read.ts';
import type { Config, FeaturePull, Octokit, PullInto, TargetRead } from '../retro/retro.types.ts';
import { MAIN_WATCH_CI_EVENT, MAIN_WATCH_EVENT, MainWatchDataSchema, type MainWatchData } from './events.ts';
import { ClosedSchema, OpenedSchema, ReadSchema, RecordedSchema, TickSchema } from './main-watch.schema.ts';
import { readSignals, type Break, type Lane, type SignalScope } from './signals.ts';
import type { MainWatchStore } from './store.ts';

export const MAIN_WATCH_FUNCTION_ID = 'main-watch';

const DAY_MS = 24 * 60 * 60 * 1000;
/** How long a PRD is watched after its merge. */
const WATCH_DAYS = 7;
/** The first wait: a red check suite on a merge commit wakes it, else it ends after a day. */
export const CI_WAIT = DAY_MS;
export const CI_STEP = 'wait-ci';
/** Between two looks: the n-th wait is `<WAIT_STEP>-<n>`; the clock read after it, `<CLOCK_STEP>-<n>`. */
export const WAIT_STEP = 'wait-day';
export const CLOCK_STEP = 'clock';
export const REWIND_STEP = 'queue-rewind';
/** The most looks a watch takes: a day apart, seven days fit well inside it. */
const MAX_TURNS = 21;

/** The step tools the watch uses. */
type WatchStep = StepRun & {
  waitForEvent(id: string, options: { event: string; timeout: number; if?: string }): Promise<unknown>;
};

export type MainWatchDeps = {
  client: Inngest.Any;
  octokitFor: OctokitFor<Octokit>;
  /** The App's own client, which looks up its installation on each target of a multi-repository PRD. */
  appOctokit?: AppOctokit | null;
  /** The watch's tables, as the service role; `null` (no database): nothing is watched. */
  store: MainWatchStore | null;
  /** The runner queue the rewind is queued on; `null`: no rewind is queued. */
  queue: ApplyQueue | null;
};

/** What the run did, lane by lane. */
type LaneOutcome = { lane: string; status: 'clean' | 'broke' | 'watching'; unread: string[] };

export function createMainWatch({ client, octokitFor, appOctokit = null, store, queue }: MainWatchDeps) {
  return client.createFunction(
    { id: MAIN_WATCH_FUNCTION_ID, name: 'omni-loop · main watch', triggers: [{ event: MAIN_WATCH_EVENT }], retries: 3 },
    async ({ event, step }) => {
      const data = parseOrThrow(MainWatchDataSchema, event.data, `The ${MAIN_WATCH_EVENT} event carries an unexpected shape`);
      if (!store) return { skipped: 'no database to keep the watch in' };
      const github = async () => octokitFor(data.installationId);

      const qualified = await savedStep(step, 'qualify', QualifiedSchema, async () => qualify(await github(), data));
      if (qualified.skip !== null) return { skipped: qualified.skip };
      const { pr, prd, config } = qualified;
      if (!config.mainWatch.enabled) return { prd: prd.number, skipped: 'mainWatch.enabled is false at the merge' };

      const pulls = await savedStep(step, 'gather-pulls', PullsIntoSchema, async () => listPullsInto(await github(), { owner: data.owner, repo: data.repo, base: pr.headRef }));
      const targets = await readTargets({ step, appOctokit, octokitFor, planSlug: `${data.owner}/${data.repo}`, scope: { config, prd } });
      const { lanes, unreadTargets } = lanesOf({ data, pr, pulls, targets });

      const repository = `${data.owner}/${data.repo}`.toLowerCase();
      const opened = await savedStep(step, 'open', OpenedSchema, () => store.open({ installationId: data.installationId, repository, prd: prd.number, lanes }));
      if (opened.workspace === null) return { prd: prd.number, skipped: opened.reason };

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
      return { prd: prd.number, ...(await watchLanes(watch)) };
    },
  );
}

/** The lanes of one PRD: its own repository first, then each target whose feature PR merged; the targets not read, by name. */
function lanesOf({ data, pr, pulls, targets }: { data: MainWatchData; pr: FeaturePull; pulls: PullInto[]; targets: TargetRead[] }): { lanes: Lane[]; unreadTargets: string[] } {
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
  step: WatchStep;
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

/** What the looks have found so far: the lanes done (their seven days over), the lanes broke, the rewind queued. */
type Found = { done: Map<string, LaneOutcome>; broke: Set<string>; queued: Queued | null };

/**
 * The looks, from the merge commit's CI to the end of the seven days: the first after a red check
 * suite on a merge commit, or a day; each after it a day later, on the daily tick.
 */
async function watchLanes(watch: Watch): Promise<{ lanes: LaneOutcome[]; queued: Queued | null }> {
  const { step, lanes } = watch;
  const shas = lanes.map((one) => one.mergeSha).filter((sha) => /^[0-9a-f]{7,64}$/i.test(sha));
  if (shas.length > 0) await step.waitForEvent(CI_STEP, { event: MAIN_WATCH_CI_EVENT, timeout: CI_WAIT, if: shas.map((sha) => `async.data.sha == '${sha}'`).join(' || ') });

  const found: Found = { done: new Map(), broke: new Set(), queued: null };
  let now = await savedStep(step, `${CLOCK_STEP}-0`, ClockSchema, () => Date.now());
  for (let turn = 0; turn < MAX_TURNS && found.done.size < lanes.length; turn += 1) {
    if (turn > 0) now = await nextDay(step, turn);
    await look(watch, found, turn, now);
  }
  return { lanes: lanes.map((one) => found.done.get(one.lane) ?? { lane: one.lane, status: found.broke.has(one.lane) ? 'broke' : 'watching', unread: [] }), queued: found.queued };
}

/** Waits for the next day: the tick's time, or the clock read after a wait no tick ended. */
async function nextDay(step: WatchStep, turn: number): Promise<number> {
  const wait = `${WAIT_STEP}-${String(turn)}`;
  const tick = parseSaved(TickSchema, await step.waitForEvent(wait, { event: DAY_EVENT, timeout: DAY_WAIT }), wait);
  return tick?.ts ?? (await savedStep(step, `${CLOCK_STEP}-${String(turn)}`, ClockSchema, () => Date.now()));
}

/** One look at every lane not done: read, record, queue the rewind on the first break, close what is over. */
async function look(watch: Watch, found: Found, turn: number, now: number): Promise<void> {
  const { step, octokitFor, store, lanes } = watch;
  const open = lanes.filter((one) => !found.done.has(one.lane));
  const reads = new Map<string, Looked>();
  for (const one of open) {
    const read = await savedStep(step, `read-${String(turn)}-${one.lane}`, ReadSchema, async () => readSignals(await octokitFor(one.installationId), one, watch.scope));
    reads.set(one.lane, { breaks: read.breaks, unread: [...read.unread, ...(one === lanes[0] ? watch.unreadTargets : [])] });
  }
  await savedStep(step, `record-${String(turn)}`, RecordedSchema, async () => {
    let added = 0;
    for (const one of open) {
      const read = reads.get(one.lane) ?? { breaks: [], unread: [] };
      added += (await store.mark({ workspace: watch.workspace, repository: watch.repository, prd: watch.prd, lane: one.lane, breaks: read.breaks, unread: read.unread })).added;
    }
    return { added };
  });
  for (const [name, read] of reads) if (read.breaks.length > 0) found.broke.add(name);
  if (found.broke.size > 0 && found.queued === null) found.queued = await queueRewind(watch);
  for (const one of open) if (now >= Date.parse(one.watchUntil)) found.done.set(one.lane, await finish(watch, found, one, reads.get(one.lane)));
}

/** The rewind, queued once for the installation's workspace, sent by the app; nothing without a queue. */
async function queueRewind({ step, queue, installationId, repository, prd }: Watch): Promise<Queued | null> {
  if (!queue) return null;
  return savedStep(step, REWIND_STEP, QueuedSchema, () => queue({ installationId, repository, line: `/omni:rewind ${String(prd)}` }));
}

/** A lane whose seven days are over: broke, clean when nothing broke it and nothing was unread, else still watching. */
async function finish(watch: Watch, found: Found, one: Lane, read: Looked | undefined): Promise<LaneOutcome> {
  const unread = read?.unread ?? [];
  if (found.broke.has(one.lane)) return { lane: one.lane, status: 'broke', unread };
  if (unread.length > 0) return { lane: one.lane, status: 'watching', unread };
  await savedStep(watch.step, `close-${one.lane}`, ClosedSchema, () =>
    watch.store.close({ workspace: watch.workspace, repository: watch.repository, prd: watch.prd, lane: one.lane }),
  );
  return { lane: one.lane, status: 'clean', unread };
}

// QA checks a mission's PRD before the Reviewer, and hands its bugs to the Engineer (PRD 3001 s4, spec sections 1, 3 and 4): the
// supervisor's decisions for the QA pair, pure, over what one run read. No database, no GitHub, no clock: ./qa-run.ts reads and
// lands, ./supervisor.ts asks these where a PRD of the pair goes next.
//
//   the steps    after the build, `/omni:qa <n>` under `…:qa:1`; its bugs, one `/omni:bug-fix #<issue> --base <feature branch>` at a
//                time under `…:qa-fix:1:<k>` (k from 1 to 5, in the verdict's order); once each fix landed or is marked, `/omni:qa <n>
//                --round 2` under `…:qa:2`. A pass in either round sends the Reviewer's round 1. There is no third round
//   a verdict    read from the QA job's log by the kit (kit/lib/qa/verdict.ts › qaLine): a QA job that ended done with no verdict
//                that reads, or one of another round, ends `failed · verdict not read`, and the repair budget handles it (PRD 2980)
//   a fix        the Engineer's fix pull request lands on the PRD's feature branch once green (./qa-run.ts), never on the default
//                branch (N-PRODUCT-15). A fix job that opened none, or a fix that cannot land (red, closed, a draft, refused by
//                GitHub), is marked `not fixed: <why>`, and the next bug is sent: QA's round 2 checks it again
//   the pick     a bug still there after round 2 holds the PRD on `Decide the bugs` until a person picks, recorded as a mission
//                event of that person naming the round-2 QA job: `resumed` sends it on to the Reviewer, `stopped` stops the PRD
//   the events   `checked` for each verdict, signed `qa` (its words the room's: `2 bugs found · Round 1 of 2 · #12 #13`), and the
//                Engineer's `fixed #12 · PR #15` or `not fixed #13: <why>` once its fix landed or was marked
import type { IssueNumber, PrdNumber, PrNumber } from 'omni-loop/kit/lib/ids.ts';
import { PrNumberSchema } from 'omni-loop/kit/lib/ids.ts';
import type { QaPosted } from 'omni-loop/kit/lib/qa/verdict.ts';
import type { PullRead } from './gate.ts';
import { judgeFix, type FixLanding } from './repair.ts';
import type { Attempt, NewEvent, PrdState, RecordedEvent, Run, Step } from './supervisor.ts';

/** QA's two rounds. */
export type QaStep = 'qa:1' | 'qa:2';
/** The Engineer's fix of the k-th bug of round 1, five at most. */
export type QaFixStep = 'qa-fix:1:1' | 'qa-fix:1:2' | 'qa-fix:1:3' | 'qa-fix:1:4' | 'qa-fix:1:5';

/** The fix steps, in order: the k-th fixes the k-th bug. */
export const FIX_STEPS: readonly QaFixStep[] = ['qa-fix:1:1', 'qa-fix:1:2', 'qa-fix:1:3', 'qa-fix:1:4', 'qa-fix:1:5'];

export const isQaStep = (step: string): step is QaStep => step === 'qa:1' || step === 'qa:2';
export const isFixStep = (step: string): step is QaFixStep => FIX_STEPS.some((one) => one === step);

/** QA's round a step is; null for any other step. */
export const qaRoundOf = (step: Step): 1 | 2 | null => (step === 'qa:1' ? 1 : step === 'qa:2' ? 2 : null);

/** The bug a fix step fixes, 1 to 5. */
export const bugOf = (step: QaFixStep): number => FIX_STEPS.indexOf(step) + 1;

/** The step of the k-th fix; null past the fifth. */
const fixStepOf = (k: number): QaFixStep | null => FIX_STEPS[k - 1] ?? null;

/** The bug a fix job is sent for, and the feature branch its fix pull request targets. */
export type Fix = { issue: IssueNumber; branch: string };

/** QA's line for round `round` (spec section 2): the first round names the PRD alone. */
export const qaSkillLine = (prd: PrdNumber, round: 1 | 2): string => `/omni:qa ${String(prd)}${round === 2 ? ' --round 2' : ''}`;

/** The Engineer's line for one bug (spec section 3): its issue, fixed into the PRD's feature branch, never the default branch. */
export const fixLine = ({ issue, branch }: Fix): string => `/omni:bug-fix #${String(issue)} --base ${branch}`;

/** A branch a runner's line may carry (kit/lib/runner/line.ts takes letters, digits and `._/-`), as `--base` takes it. */
const BRANCH = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

/** A person's pick on `Decide the bugs` (spec section 4): send it on to the Reviewer, or stop the PRD. */
export type BugsPick = 'review' | 'stop';

/** The feature branch a PRD's fixes go to, or why it could not be read. */
export type Feature = { branch: string } | { why: string };

/** What a run read of the QA pair. */
export type QaView = {
  /** A plan repository's PRD skips the QA pair, as it skips the Reviewer (spec section 1). */
  skip: boolean;
  /** By PRD in the fix phase: its feature branch, read from the feature pull request QA checked. */
  features: ReadonlyMap<PrdNumber, Feature>;
  /** By fix job: its fix pull request's landing on the feature branch. */
  landings: ReadonlyMap<string, FixLanding>;
  /** By QA job of round 2: the person's pick. */
  picks: ReadonlyMap<string, BugsPick>;
};

/** Nothing read: no feature branch, no landing, no pick. */
export const NO_QA: QaView = { skip: false, features: new Map(), landings: new Map(), picks: new Map() };

/** Why a QA job that ended done is read as failed (spec section 4, AC-6). */
export const VERDICT_NOT_READ = 'verdict not read';

/**
 * The runs as the supervisor reads them (AC-6): each QA job that ended done with no verdict of its own round, read from its log
 * (`checked`, which ./store.ts sets), ends failed, `verdict not read`, so the repair budget handles it as any failed step.
 */
export function withVerdicts(runs: readonly Run[]): Run[] {
  return runs.map((one) => {
    const round = qaRoundOf(one.step);
    if (round === null) return one;
    return {
      ...one,
      attempts: one.attempts.map((attempt) =>
        attempt.status !== 'done' || (attempt.checked != null && attempt.checked.verdict.round === round) ? attempt : { ...attempt, status: 'failed', checked: null, reason: VERDICT_NOT_READ },
      ),
    };
  });
}

/** The latest of `runs` by run, then step order. */
const latestOf = (runs: readonly Run[], after: (a: Run, b: Run) => boolean): Run | null => runs.reduce<Run | null>((last, one) => (last === null || after(one, last) ? one : last), null);

/** QA's latest verdict of round `round` for PRD `prd`, with the job it ended; null when none reads. */
export function verdictOf(runs: readonly Run[], prd: PrdNumber, round: 1 | 2): { run: Run; attempt: Attempt; posted: QaPosted } | null {
  let best: { run: Run; attempt: Attempt; posted: QaPosted } | null = null;
  for (const one of runs) {
    const attempt = one.attempts.at(-1);
    const posted = attempt?.checked;
    if (one.prd !== prd || qaRoundOf(one.step) !== round || attempt === undefined || posted == null || attempt.status !== 'done') continue;
    if (best === null || one.run > best.run) best = { run: one, attempt, posted };
  }
  return best;
}

/** The bugs QA's round 1 found for PRD `prd`, in the order they are fixed; none when it passed or did not read. */
export function bugsOf(runs: readonly Run[], prd: PrdNumber): readonly IssueNumber[] {
  const verdict = verdictOf(runs, prd, 1)?.posted.verdict;
  return verdict?.verdict === 'bugs' ? verdict.bugs.map((bug) => bug.issue) : [];
}

/**
 * The person's picks on `Decide the bugs`, by the round-2 QA job they name, from the mission's events in order: a `resumed` of the
 * PRD sends it on to the Reviewer, a `stopped` of it stops it. The first pick stands. The supervisor's own `stopped` names no job,
 * and the mission's own `resumed` no PRD, so neither reads as one.
 */
export function picksOf(events: readonly RecordedEvent[]): Map<string, BugsPick> {
  const picks = new Map<string, BugsPick>();
  for (const { kind, prd, job } of events) {
    if (prd === null || job === null || picks.has(job)) continue;
    if (kind === 'resumed') picks.set(job, 'review');
    else if (kind === 'stopped') picks.set(job, 'stop');
  }
  return picks;
}

/** The fix pull request a fix job opened: its link, when its log said it opened one (`pr-opened`, PRD 2425). */
export function fixPrOf(attempt: Attempt): { url: string; pr: PrNumber } | null {
  if (attempt.status !== 'done' || attempt.outcome !== 'pr-opened' || attempt.prUrl === null) return null;
  const pr = PrNumberSchema.safeParse(Number(/\/pull\/(\d+)$/.exec(attempt.prUrl)?.[1]));
  return pr.success ? { url: attempt.prUrl, pr: pr.data } : null;
}

/** Why a fix job that ended done opened no fix to land, in the room's words, by its ending (PRD 2425's words). */
const NO_FIX: Readonly<Record<string, string>> = {
  'already-fixed': 'its reproduction passed on the branch',
  'not-a-bug': 'it is not a bug',
  human: 'it needs a person',
  'needs-brainstorm': 'it needs a product decision',
  stuck: 'it got stuck',
  blocked: 'it was blocked',
};

const noFixWhy = (attempt: Attempt): string => NO_FIX[attempt.outcome ?? ''] ?? 'it opened no fix';

/** Whether a fix pull request lands on feature branch `branch`: as a repair's fix does (./repair.ts › judgeFix), a draft never. */
export function judgeBugFix(pull: PullRead, branch: string): FixLanding | { state: 'merge' } {
  if (!pull.merged && pull.state === 'open' && pull.draft) return { state: 'refused', why: `#${String(pull.number)} is still a draft` };
  return judgeFix(pull, branch);
}

/** The feature branch a feature pull request's head is, when a runner's line may carry it and it is not the default branch. */
export function featureOf(pull: Pick<PullRead, 'number' | 'branch' | 'defaultBranch'>): Feature {
  const branch = pull.branch ?? null;
  if (branch === null || !BRANCH.test(branch)) return { why: `the branch of #${String(pull.number)} cannot be read` };
  return branch === pull.defaultBranch ? { why: `#${String(pull.number)} is built on ${branch}, the default branch` } : { branch };
}

/** `#12 #13`. */
const issuesWords = (issues: readonly IssueNumber[]): string => issues.map((issue) => `#${String(issue)}`).join(' ');

// ── Where a PRD of the pair goes ────────────────────────────────────────────────

const startable = (run: number, step: Step, fix?: Fix): PrdState => (fix === undefined ? { state: 'startable', run, step } : { state: 'startable', run, step, fix });

/** A PRD whose fix waits: running, saying on what. */
const fixWaits = (run: number, words: string): PrdState => ({ state: 'running', run, waiting: { on: 'fix', words } });

/** The k-th fix of round 1, at run `run`: sent once its feature branch is read; else the PRD waits on it. Past the last bug, round 2. */
export function fixNext(prd: PrdNumber, run: number, k: number, runs: readonly Run[], view: QaView): PrdState {
  const bugs = bugsOf(runs, prd);
  const step = fixStepOf(k);
  const issue = bugs[k - 1];
  if (step === null || issue === undefined) return startable(run, 'qa:2');
  const feature = view.features.get(prd);
  if (feature === undefined || 'why' in feature) return fixWaits(run, `the fix of #${String(issue)} waits: ${feature?.why ?? 'its feature branch is not read yet'}`);
  return startable(run, step, { issue, branch: feature.branch });
}

/** Where a PRD goes once QA's round ended on its verdict: the Reviewer on a pass, the fixes after round 1, a person after round 2. */
export function afterChecked(prd: PrdNumber, latest: Run, posted: QaPosted, runs: readonly Run[], view: QaView): PrdState {
  const verdict = posted.verdict;
  if (verdict.verdict === 'pass') return startable(latest.run, 'review:1');
  if (verdict.round === 1) return fixNext(prd, latest.run, 1, runs, view);
  const pick = [latest.job, ...latest.attempts.map((one) => one.id)].map((id) => view.picks.get(id)).find((one) => one !== undefined);
  const issues = verdict.bugs.map((bug) => bug.issue);
  if (pick === 'review') return startable(latest.run, 'review:1');
  if (pick === 'stop') return { state: 'stopped', why: `a person stopped it with ${issuesWords(issues)} still there after QA's round 2` };
  return { state: 'waits', on: 'decide-bugs', issues, pr: posted.pr };
}

/** Where a PRD goes once a fix job ended done: on to the next bug (or round 2) once its fix landed or is marked; else it waits for the landing. */
export function afterFix(prd: PrdNumber, latest: Run & { step: QaFixStep }, last: Attempt, runs: readonly Run[], view: QaView): PrdState {
  const fix = fixPrOf(last);
  const landing = view.landings.get(last.id);
  if (fix !== null && (landing === undefined || landing.state === 'waits')) {
    const lacks = landing === undefined || landing.lacks.length === 0 ? 'it lands once green' : landing.lacks.join('; ');
    return fixWaits(latest.run, `its fix #${String(fix.pr)} waits: ${lacks}`);
  }
  return fixNext(prd, latest.run, bugOf(latest.step) + 1, runs, view);
}

/**
 * Whether a run reads PRD `prd`'s feature branch (./qa-run.ts): while it is in the fix phase, its latest job QA's round 1 with bugs, or a
 * fix that ended. `pr` is the feature pull request QA checked, `fix` the fix pull request to land, when that fix job opened one.
 */
export function needsFeature(runs: readonly Run[], prd: PrdNumber, after: (a: Run, b: Run) => boolean): { pr: PrNumber; fix: { job: string; pr: PrNumber } | null } | null {
  const latest = latestOf(runs.filter((one) => one.prd === prd), after);
  const last = latest?.attempts.at(-1);
  const round1 = verdictOf(runs, prd, 1);
  if (latest === null || last === undefined || round1 === null || round1.posted.verdict.verdict !== 'bugs') return null;
  if (latest.step === 'qa:1') return last.status === 'done' ? { pr: round1.posted.pr, fix: null } : null;
  if (!isFixStep(latest.step) || last.status === 'queued' || last.status === 'claimed' || last.status === 'running') return null;
  const fix = fixPrOf(last);
  return { pr: round1.posted.pr, fix: fix === null ? null : { job: last.id, pr: fix.pr } };
}

// ── The words ───────────────────────────────────────────────────────────────────

/** What a PRD waiting on `Decide the bugs` waits on: `decide bug #13`, `decide bugs #13 #14`. */
export const decideWords = (issues: readonly IssueNumber[]): string => `decide bug${issues.length === 1 ? '' : 's'} ${issuesWords(issues)}`;

/** QA's verdict in the room's words (spec section 6): `2 bugs found · Round 1 of 2 · #12 #13`, `1 bug still there · Round 2 of 2 · #13`, `pass · Round 2 of 2`. */
export function checkedWords({ verdict }: QaPosted): string {
  const round = `Round ${String(verdict.round)} of 2`;
  if (verdict.verdict === 'pass') return `pass · ${round}`;
  const count = verdict.bugs.length;
  const found = verdict.round === 1 ? 'found' : 'still there';
  return `${String(count)} bug${count === 1 ? '' : 's'} ${found} · ${round} · ${issuesWords(verdict.bugs.map((bug) => bug.issue))}`;
}

/** A link an event may carry: a web address of at most 500 characters, else none. */
const linkOf = (url: string | null): string | null => (url !== null && /^https:\/\//.test(url) && url.length <= 500 ? url : null);

/** QA's verdict as a mission event: `checked`, signed `qa`, linking its comment, else the pull request it checked. */
export const checkedEvent = (prd: PrdNumber, last: Attempt, posted: QaPosted): NewEvent => ({
  kind: 'checked',
  role: 'qa',
  prd,
  job: last.id,
  link: linkOf(posted.url ?? last.prUrl),
  sentence: checkedWords(posted),
});

/**
 * The Engineer's fix of a bug as a mission event, once it landed or was marked (spec section 6): `fixed #12 · PR #15`, or
 * `not fixed #13: <why>`; none while its fix waits to land.
 */
export function fixEvent(prd: PrdNumber, step: QaFixStep, last: Attempt, runs: readonly Run[], view: QaView): NewEvent | null {
  const issue = bugsOf(runs, prd)[bugOf(step) - 1];
  const fix = fixPrOf(last);
  const landing = view.landings.get(last.id);
  if (fix !== null && (landing === undefined || landing.state === 'waits')) return null;
  const bug = issue === undefined ? 'its bug' : `#${String(issue)}`;
  const said = (sentence: string): NewEvent => ({ kind: 'job-ended', role: 'engineer', prd, job: last.id, link: linkOf(fix?.url ?? null), sentence });
  if (fix === null) return said(`not fixed ${bug}: ${noFixWhy(last)}`);
  return landing?.state === 'landed' ? said(`fixed ${bug} · PR #${String(fix.pr)}`) : said(`not fixed ${bug}: ${landing?.state === 'refused' ? landing.why : 'it did not land'}`);
}

/** What a dispatch of the pair says: its line (a fix's `--base` once its branch is known), and its round or bug. */
export function sentPairWords(one: Run, where: string, runs: readonly Run[], view: QaView): string | null {
  const round = qaRoundOf(one.step);
  if (round !== null) return `Sent ${qaSkillLine(one.prd, round)} to ${where} (run ${String(one.run)}, round ${String(round)}).`;
  if (!isFixStep(one.step)) return null;
  const bugs = bugsOf(runs, one.prd);
  const k = bugOf(one.step);
  const issue = bugs[k - 1];
  const feature = view.features.get(one.prd);
  const line = issue === undefined ? '/omni:bug-fix' : feature !== undefined && 'branch' in feature ? fixLine({ issue, branch: feature.branch }) : `/omni:bug-fix #${String(issue)}`;
  return `Sent ${line} to ${where} (run ${String(one.run)}, bug ${String(k)} of ${String(Math.max(k, bugs.length))}).`;
}

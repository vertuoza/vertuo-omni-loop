// The merge gate of a mission branch (PRD 2896 s4, spec "3. Joining the mission branch"): pure, over what ./join.ts read
// of a PRD's feature pull request on GitHub. It decides whether the App squash-merges that pull request into the mission
// branch, with no person, so it says yes only when all three hold, on the pull request's head:
//
//   the checks     every check run and commit status on the head is green. Each check is the latest run of its name that
//                  decided: a run skipped by a draft's push is passed over for the one the ready pull request ran. A check
//                  still queued or running is `not finished`; one that ended neutral, skipped or cancelled is `not judged`,
//                  with its reason, never a pass (BL-GATE-1); no check at all on the head holds it too
//   the Reviewer   its latest review carrying the marker `/omni:review` posts (PRD 2871) says `pass`, on the head itself
//   the outbox     no open item ranked high or human-action at the head; an item that cannot be read holds it as one would
//
// A pull request already merged into the mission branch has joined (a replay, or a run that merged and failed before it
// recorded). One that is closed, a draft, or into another branch never merges: the App merges into its mission's branch
// only, never into the default branch (N-PRODUCT-15).
import { readReviewMarker, type VerdictName } from 'omni-loop/kit/lib/review/verdict.ts';

/** One check run on the head, as GitHub lists it: its conclusion null until it completed. */
export type CheckRun = { id: number; name: string; status: string; conclusion: string | null; title: string | null };

/** One commit status on the head, the latest of its context. */
export type CommitStatus = { context: string; state: string; description: string | null };

/** What a check says of the head. */
export type CheckState = 'pass' | 'fail' | 'not-judged' | 'not-finished';

/** One check of the head, judged. */
export type CheckVerdict = { name: string; state: CheckState; why: string | null };

/** One review of the pull request, as GitHub lists it, oldest first. */
export type ListedReview = { body: string | null; commit: string | null };

/**
 * The open items of the PRD's outbox at the head, by rank (null for one that does not parse), or why they were not read. `open`
 * names each with its id, null for one that does not parse (PRD 2896 s10: the committee answers a high item by its id).
 */
export type OpenItems = { ranks: readonly (string | null)[]; open?: readonly { id: string | null; rank: string | null }[] } | { notRead: string };

/** What ./join.ts read of a PRD's feature pull request. */
export type PullRead = {
  number: number;
  url: string;
  title: string;
  state: string;
  draft: boolean;
  merged: boolean;
  base: string;
  defaultBranch: string;
  head: string;
  /** The head's branch (PRD 3001: the feature branch QA's fixes land on); absent when GitHub did not say. */
  branch?: string;
  runs: readonly CheckRun[];
  statuses: readonly CommitStatus[];
  reviews: readonly ListedReview[];
  items: OpenItems;
};

/** The gate's answer: joined already, merge it now, or wait on what it lacks, in words. */
export type Gate = { decision: 'joined' } | { decision: 'merge' } | { decision: 'waits'; lacks: string[] };

const PASSED = 'success';
/** Ended without deciding: never a pass (BL-GATE-1). */
const UNDECIDED = new Set(['neutral', 'skipped', 'cancelled']);

/** A check run's state, once it is the one its name is judged by. */
function runVerdict(run: CheckRun): CheckVerdict {
  if (run.status !== 'completed') return { name: run.name, state: 'not-finished', why: null };
  const conclusion = run.conclusion ?? 'none';
  if (conclusion === PASSED) return { name: run.name, state: 'pass', why: null };
  if (UNDECIDED.has(conclusion)) return { name: run.name, state: 'not-judged', why: run.title ?? conclusion };
  return { name: run.name, state: 'fail', why: conclusion };
}

/** The run a check's name is judged by: its latest, unless that one completed and an earlier run of it decided. */
function judgedRun(runs: readonly CheckRun[]): CheckRun | undefined {
  const latestFirst = [...runs].sort((a, b) => b.id - a.id);
  const latest = latestFirst[0];
  if (latest === undefined || latest.status !== 'completed') return latest;
  return latestFirst.find((run) => run.status === 'completed' && run.conclusion !== 'skipped') ?? latest;
}

/** A commit status's state: success passes, pending is not finished, anything else fails. */
function statusVerdict(status: CommitStatus): CheckVerdict {
  if (status.state === PASSED) return { name: status.context, state: 'pass', why: null };
  if (status.state === 'pending') return { name: status.context, state: 'not-finished', why: null };
  return { name: status.context, state: 'fail', why: status.description ?? status.state };
}

/** Every check of the head, one per name, in name order: its check runs, then its commit statuses. */
export function checksOf(runs: readonly CheckRun[], statuses: readonly CommitStatus[]): CheckVerdict[] {
  const byName = new Map<string, CheckRun[]>();
  for (const run of runs) byName.set(run.name, [...(byName.get(run.name) ?? []), run]);
  const judged = [...byName.values()].flatMap((named) => {
    const run = judgedRun(named);
    return run === undefined ? [] : [runVerdict(run)];
  });
  return [...judged, ...statuses.map(statusVerdict)].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/** What the checks lack, in words; none when every one passed. */
function checkLacks(checks: readonly CheckVerdict[]): string[] {
  if (checks.length === 0) return ['no check has run on its head'];
  return checks.flatMap(({ name, state, why }) => {
    if (state === 'fail') return [`${name} failed`];
    if (state === 'not-judged') return [`${name} not judged: ${why ?? 'it ended without deciding'}`];
    return state === 'not-finished' ? [`${name} not finished`] : [];
  });
}

/** The Reviewer's latest verdict on the pull request (the highest round, the last listed of it), and the commit it is on. */
export function latestVerdict(reviews: readonly ListedReview[]): { round: number; verdict: VerdictName; commit: string | null } | null {
  let latest: { round: number; verdict: VerdictName; commit: string | null } | null = null;
  for (const review of reviews) {
    const marker = readReviewMarker(review.body);
    if (marker && (latest === null || marker.round >= latest.round)) latest = { ...marker, commit: review.commit };
  }
  return latest;
}

/** What the Reviewer's verdict lacks, in words; none when it passed the head. */
function reviewLacks(reviews: readonly ListedReview[], head: string): string[] {
  const latest = latestVerdict(reviews);
  if (latest === null) return ['the Reviewer has not reviewed it'];
  if (latest.verdict !== 'pass') return [`the Reviewer asked for changes in round ${String(latest.round)}`];
  return latest.commit === head ? [] : ['the Reviewer passed an older commit, not its head'];
}

/** `1 high item`, `2 high items`. */
const count = (n: number, what: string): string => `${String(n)} ${what} item${n === 1 ? '' : 's'}`;

/** What the outbox lacks, in words; none when no high or human-action item is open. */
function itemLacks(items: OpenItems): string[] {
  if ('notRead' in items) return [`its outbox not judged: ${items.notRead}`];
  const high = items.ranks.filter((rank) => rank === 'high').length;
  const human = items.ranks.filter((rank) => rank === 'human-action').length;
  const unread = items.ranks.filter((rank) => rank === null).length;
  return [
    ...(human > 0 ? [`${count(human, 'human-action')} open`] : []),
    ...(high > 0 ? [`${count(high, 'high')} open`] : []),
    ...(unread > 0 ? [`${count(unread, 'unreadable')} in its outbox`] : []),
  ];
}

/** Whether the pull request joins mission branch `branch`: already joined, merge it, or what it waits on. */
export function judge(pull: PullRead, branch: string): Gate {
  const pr = `#${String(pull.number)}`;
  if (pull.merged) return pull.base === branch ? { decision: 'joined' } : { decision: 'waits', lacks: [`${pr} was merged into ${pull.base}, not ${branch}`] };
  if (pull.base !== branch || pull.base === pull.defaultBranch) return { decision: 'waits', lacks: [`${pr} targets ${pull.base}, not ${branch}`] };
  if (pull.state !== 'open') return { decision: 'waits', lacks: [`${pr} is closed`] };
  const lacks = [
    ...(pull.draft ? [`${pr} is a draft`] : []),
    ...checkLacks(checksOf(pull.runs, pull.statuses)),
    ...reviewLacks(pull.reviews, pull.head),
    ...itemLacks(pull.items),
  ];
  return lacks.length === 0 ? { decision: 'merge' } : { decision: 'waits', lacks };
}

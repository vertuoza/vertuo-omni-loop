// PRD 1139, slice s1: the verdict for one PRD — what a loop's next tick does about it. Pure: the
// command (`kit/bin/commands/next.ts`) reads the facts from the PRD's board, its feature PR's care
// state, its outbox and its phase-0 PR, and this decides. It writes nothing anywhere.
//
// Earlier rows win:
//
// | the PRD                                                                   | verdict                  |
// | ------------------------------------------------------------------------- | ------------------------ |
// | its feature PR merged or closed, or its folder shipped with no open PR    | `done`                   |
// | its phase-0 PR open                                                       | `park` (a reviewer)      |
// | GitHub or its board could not be read                                     | `wait`                   |
// | feature PR ready, and red CI to fix, a conflict, or a thread to handle    | `act pr-care --once`     |
// | feature PR ready, and red CI marked stuck                                 | `park` (a person)        |
// | every slice merged, and answers posted to its open outbox questions       | `act yolo-fix`           |
// | every slice merged, and outbox questions open                             | `park` (the PRD's owner) |
// | every slice merged, the feature PR draft or not opened yet                | `act yolo`               |
// | every slice merged, the ready PR's CI running                             | `wait` (CI hint)         |
// | every slice merged, the ready PR clean                                    | `park` (a merger)        |
// | no plan yet                                                               | `act yolo`               |
// | slices takeable in the next wave                                          | `act wave`               |
// | a slice claimed by another session, a commit on it within `stallDays`     | `wait` (claim hint)      |
// | a slice in flight with no commit for `stallDays` (stalled)                | `park` (a person)        |
// | a slice stuck                                                             | `park` (a person)        |
// | anything else                                                             | `wait` (claim hint)      |
//
// PRD 1162, slice s1: in a plan repository (`facts.across` set) a PRD lands in several repositories,
// and the single-repository skills stall on it: `decideAcross` below returns only the `ultra-` skills
// and `mega-pr-care --once`, read from the plan PR (the plan repository's feature PR, `feature`), each
// target's feature PR (`across.targets`) and the board across every repository. Earlier rows win:
//
// | the PRD                                                                     | verdict                        |
// | --------------------------------------------------------------------------- | ------------------------------ |
// | the plan PR and every target PR merged or closed, or shipped with none open | `done`                         |
// | its phase-0 PR open                                                         | `park` (a reviewer), naming it |
// | GitHub, a target or its board could not be read                             | `wait`                         |
// | a ready PR in any repository, and red CI to fix, a conflict, or a thread    | `act mega-pr-care --once`      |
// | a ready PR in any repository, and red CI marked stuck                       | `park` (a person)              |
// | no plan yet                                                                 | `act ultra-yolo`               |
// | every slice merged, and answers posted to its open outbox questions         | `act ultra-yolo-fix`           |
// | every slice merged, and outbox questions open                               | `park` (the PRD's owner)       |
// | every slice merged, the plan PR or a target PR draft or not opened yet      | `act ultra-yolo`               |
// | every slice merged, CI running on a ready PR in any repository              | `wait` (CI hint)               |
// | every slice merged, every PR ready and clean                                | `park`, naming each open PR    |
// | slices takeable in the next wave, in any repository                         | `act ultra-wave`               |
// | then as in one repository: a claim held, a slice stuck, anything else       | `wait`, `park`, `wait`         |

import type { CheckState } from '../care/state.ts';
import type { PrNumber, PrdNumber, WorkSliceId } from '../ids.ts';

/** How long a loop sleeps, in seconds, before it looks again: CI is checked again sooner than a claim. */
export const WAKE_HINTS = Object.freeze({ ci: 300, claim: 1200, unreadable: 300 });

/** The skill an `act` verdict runs, as the loop types it after `/omni:`. */
export type NextSkill = 'pr-care --once' | 'yolo-fix' | 'yolo' | 'wave' | 'mega-pr-care --once' | 'ultra-yolo-fix' | 'ultra-yolo' | 'ultra-wave';

/** One PRD's verdict, as `omni next --json` prints it. In a plan repository the command adds the
 * short names of the repositories the PRD's plan lands in (`repos`). */
export type Verdict =
  | { prd: PrdNumber; verdict: 'act'; skill: NextSkill; why: string; link?: string; repos?: string[] }
  | { prd: PrdNumber; verdict: 'wait'; why: string; wakeHint: number; link?: string; repos?: string[] }
  | { prd: PrdNumber; verdict: 'park'; why: string; link?: string; repos?: string[] }
  | { prd: PrdNumber; verdict: 'done'; why: string; link?: string; repos?: string[] };

/** The PRD's feature PR, as far as the verdict reads it. */
export type FeatureFacts = {
  url: string;
  state: string;
  isDraft: boolean;
  author: string | null;
  checks: CheckState;
  /** Red CI the loop can fix: red on something other than the outbox or inbox gate. */
  fixable: boolean;
  /** Red CI already marked as needing a person. */
  stuck: boolean;
  conflict: boolean;
  /** Review threads a PR care round has to judge or mark. */
  threads: number;
};

/** A slice in flight whose sub-PR has had no commit for `limits.stallDays`: abandoned, not held. */
export type StalledSlice = { id: WorkSliceId; pr: PrNumber; url: string; since: string };

/** The PRD's board, as far as the verdict reads it. */
export type BoardFacts = {
  total: number;
  merged: number;
  wave: number | null;
  takeable: WorkSliceId[];
  inFlight: WorkSliceId[];
  /** The slices of `inFlight` that have stalled ({@link stalledSlices}). */
  stalled: StalledSlice[];
  /** `limits.stallDays`, as the verdict names it. */
  stallDays: number;
  stuck: WorkSliceId[];
  unreadable: WorkSliceId[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The in-flight slices that have stalled: the head commit of their sub-PR is `stallDays` old or
 * older — the kit's own meaning of a stall (`deriveStatus` in `kit/lib/inbox/status.ts`: in flight,
 * no commit for `stallDays`). An unknown head commit date is never read as a stall, as the board never
 * calls a claim stale on a signal it did not see.
 */
export function stalledSlices(
  rows: readonly { id: WorkSliceId; state: string; pr: { number?: PrNumber | undefined; headCommitDate?: string | null | undefined } | null }[],
  { now, stallDays, prUrl }: { now: number; stallDays: number; prUrl: (pr: PrNumber) => string },
): StalledSlice[] {
  return rows.flatMap(({ id, state, pr }) => {
    const since = pr?.headCommitDate;
    if (state !== 'in-flight' || pr?.number === undefined || !since) return [];
    if (now - new Date(since).getTime() < stallDays * DAY_MS) return [];
    return [{ id, pr: pr.number, url: prUrl(pr.number), since }];
  });
}

/** The PRD's open outbox questions (human-action and high), and whether a person answered one. */
export type OutboxFacts = { questions: number; answered: boolean };

/** One target's feature PR of a plan-repository PRD: the target's short name, and its PR. */
export type TargetPr = { repo: string; pr: FeatureFacts | null | 'unreadable' };

/** In a plan repository: the plan repository's short name, and each target the plan lands in. */
export type AcrossFacts = { repo: string; targets: TargetPr[] };

/** Everything the verdict is decided on. `null` means there is none; `unreadable`, it could not be
 * read. In a plan repository `feature` is the plan PR, and `across` names the targets. */
export type PrdFacts = {
  prd: PrdNumber;
  shipped: boolean;
  phase0: { url: string } | null;
  feature: FeatureFacts | null | 'unreadable';
  board: BoardFacts | null | 'unreadable';
  outbox: OutboxFacts | 'unreadable';
  across?: AcrossFacts;
};

const act = (prd: PrdNumber, skill: NextSkill, why: string, link?: string): Verdict => ({ prd, verdict: 'act', skill, why, ...(link ? { link } : {}) });
const wait = (prd: PrdNumber, why: string, wakeHint: number, link?: string): Verdict => ({ prd, verdict: 'wait', why, wakeHint, ...(link ? { link } : {}) });
const park = (prd: PrdNumber, why: string, link?: string): Verdict => ({ prd, verdict: 'park', why, ...(link ? { link } : {}) });

/** A list of slice ids, in words. */
const ids = (list: readonly string[]): string => list.join(', ');

/** Plural words: `1 question`, `2 questions`. */
const count = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

/** What a PR care round has to do on a ready feature PR, in words: none, or each need. */
function careNeeds(feature: FeatureFacts): string[] {
  const redToFix = feature.checks === 'red' && feature.fixable && !feature.stuck;
  return [redToFix ? 'red CI' : null, feature.conflict ? 'a conflict' : null, feature.threads > 0 ? `${count(feature.threads, 'review thread')} to handle` : null].filter(
    (need) => need !== null,
  );
}

/** The verdict a ready feature PR forces before anything else, or `null` when it forces none. */
function readyPr(prd: PrdNumber, feature: FeatureFacts): Verdict | null {
  if (feature.state !== 'OPEN' || feature.isDraft) return null;
  const needs = careNeeds(feature);
  if (needs.length > 0) return act(prd, 'pr-care --once', `the ready feature PR has ${needs.join(', ')}`, feature.url);
  if (feature.checks === 'red' && feature.stuck) return park(prd, "waits on a person: the feature PR's CI is stuck after its attempts", feature.url);
  return null;
}

/** The verdict open outbox questions force once every slice is merged, or `null` with none open. */
function questions(prd: PrdNumber, feature: FeatureFacts | null, outbox: OutboxFacts): Verdict | null {
  if (outbox.questions === 0) return null;
  const link = feature?.url;
  if (outbox.answered) return act(prd, 'yolo-fix', "answers are posted on the feature PR's outbox questions", link);
  const who = feature?.author ? `@${feature.author}` : "the PRD's owner";
  return park(prd, `waits on ${who}: ${count(outbox.questions, 'outbox question')} to answer`, link);
}

/** The verdict once every slice is merged. */
function finished(prd: PrdNumber, feature: FeatureFacts | null, outbox: OutboxFacts): Verdict {
  const asked = questions(prd, feature, outbox);
  if (asked !== null) return asked;
  if (feature === null || feature.isDraft) return act(prd, 'yolo', 'every slice is merged and the feature PR is not ready yet', feature?.url);
  if (feature.checks === 'running') return wait(prd, "the feature PR's CI is running", WAKE_HINTS.ci, feature.url);
  return park(prd, 'waits on a person: the feature PR is ready to merge', feature.url);
}

/** The park a stalled slice forces: each sub-PR named with the day of its last commit, the first linked. */
function stalledPark(prd: PrdNumber, stalled: readonly StalledSlice[], stallDays: number): Verdict {
  const named = stalled.map(({ id, pr, since }, index) => `${id}'s sub-PR #${pr}${index === 0 ? ' has had no commit' : ''} since ${since.slice(0, 10)}`);
  const them = stalled.length === 1 ? 'take it over or close it' : 'take them over or close them';
  return park(prd, `waits on a person: ${named.join(', ')} (${stallDays} days or more); ${them}`, stalled[0]?.url);
}

/** The verdict while slices remain to build. */
function building(prd: PrdNumber, board: BoardFacts, link: string | undefined): Verdict {
  if (board.takeable.length > 0) return act(prd, 'wave', `wave ${board.wave ?? '?'} can take ${ids(board.takeable)}`, link);
  const stalled = new Set(board.stalled.map(({ id }) => id));
  const held = board.inFlight.filter((id) => !stalled.has(id));
  if (held.length > 0) return wait(prd, `another session holds the claim on ${ids(held)}`, WAKE_HINTS.claim, link);
  if (board.stalled.length > 0) return stalledPark(prd, board.stalled, board.stallDays);
  if (board.stuck.length > 0) return park(prd, `waits on a person: ${ids(board.stuck)} stuck`, link);
  if (board.unreadable.length > 0) return wait(prd, `cannot read ${ids(board.unreadable)}`, WAKE_HINTS.unreadable, link);
  return wait(prd, 'nothing can move yet', WAKE_HINTS.claim, link);
}

/** PRD `facts.prd`'s verdict. */
export function decideNext(facts: PrdFacts): Verdict {
  if (facts.across !== undefined) return decideAcross(facts, facts.across);
  const { prd, feature, board, outbox } = facts;
  if (feature !== null && feature !== 'unreadable' && feature.state !== 'OPEN') {
    return { prd, verdict: 'done', why: `the feature PR is ${feature.state.toLowerCase()}`, link: feature.url };
  }
  if (facts.shipped && (feature === null || feature === 'unreadable')) return { prd, verdict: 'done', why: 'the PRD has shipped' };
  if (facts.phase0 !== null) return park(prd, 'waits on a reviewer: the phase-0 PR is open', facts.phase0.url);
  if (feature === 'unreadable' || outbox === 'unreadable') return wait(prd, 'github unreachable', WAKE_HINTS.unreadable);
  if (board === 'unreadable') return wait(prd, 'the board cannot be read', WAKE_HINTS.unreadable, feature?.url);

  const ready = feature === null ? null : readyPr(prd, feature);
  if (ready !== null) return ready;
  if (board === null) return act(prd, 'yolo', 'the PRD has no plan yet', feature?.url);
  if (board.total > 0 && board.merged === board.total) return finished(prd, feature, outbox);
  return building(prd, board, feature?.url);
}

/** A pull request named by its repository, `crew#40`, read from its URL; the URL as it is otherwise. */
function prRef(url: string): string {
  const match = /\/([^/]+)\/pull\/(\d+)\/?$/.exec(url);
  return match ? `${match[1]}#${match[2]}` : url;
}

/** A pull request of the PRD that exists and could be read, or `null`. */
const known = (entry: TargetPr): FeatureFacts | null => (entry.pr === null || entry.pr === 'unreadable' ? null : entry.pr);

/** Whether a pull request is open and ready for review. */
const isReady = (pr: FeatureFacts | null): pr is FeatureFacts => pr !== null && pr.state === 'OPEN' && !pr.isDraft;

/** Whether the plan PR and every target PR opened are merged or closed. */
function allEnded(planPr: FeatureFacts | null, targets: readonly TargetPr[]): boolean {
  if (planPr === null || planPr.state === 'OPEN') return false;
  return targets.every((entry) => entry.pr === null || (entry.pr !== 'unreadable' && entry.pr.state !== 'OPEN'));
}

/** The verdict a ready PR in any repository forces before anything else, or `null` when none does. */
function readyAcross(prd: PrdNumber, prs: readonly TargetPr[]): Verdict | null {
  const ready = prs.map(known).filter(isReady);
  for (const pr of ready) {
    const needs = careNeeds(pr);
    if (needs.length > 0) return act(prd, 'mega-pr-care --once', `${prRef(pr.url)} has ${needs.join(', ')}`, pr.url);
  }
  const stuck = ready.find((pr) => pr.checks === 'red' && pr.stuck);
  return stuck ? park(prd, `waits on a person: ${prRef(stuck.url)}'s CI is stuck after its attempts`, stuck.url) : null;
}

/** The verdict open outbox questions force once every slice is merged, or `null` with none open:
 * they are asked and answered on the plan PR. */
function questionsAcross(prd: PrdNumber, planPr: FeatureFacts | null, outbox: OutboxFacts): Verdict | null {
  if (outbox.questions === 0) return null;
  const on = planPr ? ` on ${prRef(planPr.url)}` : '';
  if (outbox.answered) return act(prd, 'ultra-yolo-fix', `answers are posted on the outbox questions${on}`, planPr?.url);
  const who = planPr?.author ? `@${planPr.author}` : "the PRD's owner";
  return park(prd, `waits on ${who}: ${count(outbox.questions, 'outbox question')} to answer${on}`, planPr?.url);
}

/** The verdict once every slice is merged, in a plan repository; `prs` starts with the plan PR. */
function finishedAcross(prd: PrdNumber, prs: readonly TargetPr[], outbox: OutboxFacts): Verdict {
  const asked = questionsAcross(prd, prs[0] ? known(prs[0]) : null, outbox);
  if (asked !== null) return asked;
  const open = prs.filter((entry) => entry.pr === null || known(entry)?.state === 'OPEN');
  const notReady = open.find((entry) => !isReady(known(entry)));
  if (notReady) {
    const pr = known(notReady);
    const what = pr === null ? `${notReady.repo}'s feature PR is not opened yet` : `${prRef(pr.url)} is not ready yet`;
    return act(prd, 'ultra-yolo', `every slice is merged and ${what}`, pr?.url);
  }
  const ready = open.map(known).filter(isReady);
  const running = ready.find((pr) => pr.checks === 'running');
  if (running) return wait(prd, `${prRef(running.url)}'s CI is running`, WAKE_HINTS.ci, running.url);
  return park(prd, `waits on a person: ready to merge: ${ready.map((pr) => prRef(pr.url)).join(', ')}`, ready[0]?.url);
}

/** The verdict of a plan-repository PRD that has ended, or `null` while it has not. */
function endedAcross(facts: PrdFacts, prs: readonly TargetPr[], planPr: FeatureFacts | null): Verdict | null {
  const { prd } = facts;
  if (allEnded(planPr, prs.slice(1))) return { prd, verdict: 'done', why: 'the plan PR and every target PR are merged or closed', ...(planPr ? { link: planPr.url } : {}) };
  return facts.shipped && prs.every((entry) => entry.pr === null) ? { prd, verdict: 'done', why: 'the PRD has shipped' } : null;
}

/** The verdict that stops a plan-repository PRD before its work is read: ended, its phase-0 PR open,
 * a PR that cannot be read, or a ready PR to care for; `null` when none does. */
function stoppedAcross(facts: PrdFacts, prs: readonly TargetPr[], planPr: FeatureFacts | null): Verdict | null {
  const { prd, phase0 } = facts;
  const ended = endedAcross(facts, prs, planPr);
  if (ended !== null) return ended;
  if (phase0 !== null) return park(prd, `waits on a reviewer: the phase-0 PR ${prRef(phase0.url)} is open`, phase0.url);
  if (prs.some((entry) => entry.pr === 'unreadable')) return wait(prd, 'github unreachable', WAKE_HINTS.unreadable);
  return readyAcross(prd, prs);
}

/** The verdict of a plan-repository PRD whose plan is read: finishing, or building. */
function plannedAcross(prd: PrdNumber, board: BoardFacts, { prs, outbox }: { prs: readonly TargetPr[]; outbox: OutboxFacts }, link: string | undefined): Verdict {
  if (board.total > 0 && board.merged === board.total) return finishedAcross(prd, prs, outbox);
  return board.takeable.length > 0 ? act(prd, 'ultra-wave', `wave ${board.wave ?? '?'} can take ${ids(board.takeable)}`, link) : building(prd, board, link);
}

/** PRD `facts.prd`'s verdict in a plan repository: only the `ultra-` skills and `mega-pr-care --once`. */
function decideAcross(facts: PrdFacts, across: AcrossFacts): Verdict {
  const { prd, feature, board, outbox } = facts;
  const prs: TargetPr[] = [{ repo: across.repo, pr: feature }, ...across.targets];
  const planPr = known({ repo: across.repo, pr: feature });
  const link = planPr?.url;
  const stopped = stoppedAcross(facts, prs, planPr);
  if (stopped !== null) return stopped;
  if (outbox === 'unreadable') return wait(prd, 'github unreachable', WAKE_HINTS.unreadable);
  if (board === 'unreadable') return wait(prd, 'the board cannot be read', WAKE_HINTS.unreadable, link);
  return board === null ? act(prd, 'ultra-yolo', 'the PRD has no plan yet', link) : plannedAcross(prd, board, { prs, outbox }, link);
}

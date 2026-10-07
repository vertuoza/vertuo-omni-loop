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
// | a slice claimed by another session                                        | `wait` (claim hint)      |
// | a slice stuck                                                             | `park` (a person)        |
// | anything else                                                             | `wait` (claim hint)      |

import type { CheckState } from '../care/state.ts';
import type { PrdNumber, WorkSliceId } from '../ids.ts';

/** How long a loop sleeps, in seconds, before it looks again: CI is checked again sooner than a claim. */
export const WAKE_HINTS = Object.freeze({ ci: 300, claim: 1200, unreadable: 300 });

/** The skill an `act` verdict runs, as the loop types it after `/omni:`. */
export type NextSkill = 'pr-care --once' | 'yolo-fix' | 'yolo' | 'wave';

/** One PRD's verdict, as `omni next --json` prints it. */
export type Verdict =
  | { prd: PrdNumber; verdict: 'act'; skill: NextSkill; why: string; link?: string }
  | { prd: PrdNumber; verdict: 'wait'; why: string; wakeHint: number; link?: string }
  | { prd: PrdNumber; verdict: 'park'; why: string; link?: string }
  | { prd: PrdNumber; verdict: 'done'; why: string; link?: string };

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

/** The PRD's board, as far as the verdict reads it. */
export type BoardFacts = {
  total: number;
  merged: number;
  wave: number | null;
  takeable: WorkSliceId[];
  inFlight: WorkSliceId[];
  stuck: WorkSliceId[];
  unreadable: WorkSliceId[];
};

/** The PRD's open outbox questions (human-action and high), and whether a person answered one. */
export type OutboxFacts = { questions: number; answered: boolean };

/** Everything the verdict is decided on. `null` means there is none; `unreadable`, it could not be read. */
export type PrdFacts = {
  prd: PrdNumber;
  shipped: boolean;
  phase0: { url: string } | null;
  feature: FeatureFacts | null | 'unreadable';
  board: BoardFacts | null | 'unreadable';
  outbox: OutboxFacts | 'unreadable';
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

/** The verdict while slices remain to build. */
function building(prd: PrdNumber, board: BoardFacts, link: string | undefined): Verdict {
  if (board.takeable.length > 0) return act(prd, 'wave', `wave ${board.wave ?? '?'} can take ${ids(board.takeable)}`, link);
  if (board.inFlight.length > 0) return wait(prd, `another session holds the claim on ${ids(board.inFlight)}`, WAKE_HINTS.claim, link);
  if (board.stuck.length > 0) return park(prd, `waits on a person: ${ids(board.stuck)} stuck`, link);
  if (board.unreadable.length > 0) return wait(prd, `cannot read ${ids(board.unreadable)}`, WAKE_HINTS.unreadable, link);
  return wait(prd, 'nothing can move yet', WAKE_HINTS.claim, link);
}

/** PRD `facts.prd`'s verdict. */
export function decideNext(facts: PrdFacts): Verdict {
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

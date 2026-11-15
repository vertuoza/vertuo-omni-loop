// The status of a work, from its facts (PRD 2906's spec, "How each step is read" and "The verdict"):
// pure. `omni now --status` gathers the facts; this module reads the step the work is at, the verdict,
// **You**, **Next** and the details, every word from `words.ts`.
//
// - **A PRD** shows its brainstorm's steps until it is approved, then its build's. Shipped once its
//   folder is in shipped or its feature PR merged; else, before approval, `Waiting for your approval`
//   while an approval wait runs or its phase-0 PR is open, `Writing it down` once its folder exists,
//   `Shaping the idea` before. Once approved: `Planning` with no plan, `Ready to build` while no slice
//   of its board has started (a board not read counts as none started), `Building (k of n parts)`
//   while one is not merged, then `Questions for you` while questions are open (never `Ready for your
//   review` then, BR-PRODUCT-5), `Ready for your review` on an open feature PR, else `Checking it all
//   together`. With no board read, open questions or an open feature PR still read their step.
// - **A bug fix:** `Merged` once its folder is on the default branch or its pull request merged;
//   `Ready for your review` on an open pull request; on a draft (or a closed one), `Reproduced,
//   fixing it` while its changed files are tests and the fix's folder only (or are not known), else
//   `Fix done, checks running`; `Trying to reproduce it` on its fix branch; else `Understanding the
//   bug`.
// - **A visual update:** `Merged` as a bug fix; `Ready for your review` on an open pull request whose
//   checks are all green; `Checks running` on any other pull request; `Applying your pick` on its fix
//   branch; else `Showing you options`.
// - **The verdict**, the first that holds: `Stopped` on a pull request closed without merging;
//   `Stuck` on a failed check, then on a stuck slice; `Waiting for you` when **You** asks something;
//   `Waiting` while a pull request is open and its checks are not known; else `On track`. A stuck
//   verdict's **Next** is its own; **You** is the step's, never empty.
// - **The details** are the failed checks' names, at most three.
// - **`readStatus`** keeps the technical words marked, for the block; **`statusOf`** is the answer
//   `omni now --json` carries, every word plain.
import type { IssueNumber, PrdNumber } from '../../ids.ts';
import type { LoopChangeDetail, LoopChangeState } from '../../loop-reads/contract.ts';
import {
  BUILDING_UNCOUNTED, CHECKS_UNKNOWN, failedCount, fill, LEVEL_LABELS, NOTHING_TO_DO, plain, questionsWait, STEPS, stuckParts, theQuestions, TRACKS, VERDICTS, WHERE,
} from './words.ts';
import type { StatusKind, StatusLevel, StepId, StepWords, Track } from './words.ts';

/** A check of the work's pull request, as `LoopReads` reads it. */
export type StatusCheck = LoopChangeDetail['review']['checks'][number];

/** The work's pull request: its state, its changed files and its checks (`null`: not known). */
export type StatusPullRequest = { state: LoopChangeState; files: readonly string[] | null; checks: readonly StatusCheck[] | null };

/** The work's links: its Omni page, its GitHub issue and its pull request, each `null` when it has none. */
type StatusLinks = { page: string | null; issueUrl: string | null; pullRequest: string | null };

/** When the pull request's facts were read (`null`: never), and whether this read asked GitHub and it answered. */
export type StatusChecked = { at: string | null; fetch: 'answered' | 'no-answer' | 'not-asked' };

type CommonFacts = { title: string; pullRequest: StatusPullRequest | null; links: StatusLinks; checked: StatusChecked };

/** A PRD's facts: where its folder is, its approval, its plan, its board's slices (`null`: not read)
 * and its open questions; its pull request is its feature PR. */
export type PrdStatusFacts = CommonFacts & {
  kind: 'prd';
  number: PrdNumber;
  folder: 'none' | 'inbox' | 'shipped';
  approved: boolean;
  approvalWait: boolean;
  phase0Open: boolean;
  plan: boolean;
  slices: readonly { id: string; state: string }[] | null;
  openQuestions: number;
};

/** A fix's facts: its folder's path, whether its fix branch exists, whether its folder is on the default branch. */
export type FixStatusFacts = CommonFacts & { kind: 'bug' | 'visual'; number: IssueNumber; folder: string; branch: boolean; merged: boolean };

/** A work's facts. */
export type StatusFacts = PrdStatusFacts | FixStatusFacts;

/** A step as the answer names it. */
export type StatusStep = { id: StepId; name: string; short: string };

/** A work's status (`omni now --json`'s `status` key): `at` is the step's place in `steps`, from 1. */
export type Status = {
  verdict: { level: StatusLevel; line: string };
  kind: StatusKind;
  steps: StatusStep[];
  at: number;
  you: string;
  next: string[];
  details: string[];
  checkedAt: string | null;
};

const STARTED = new Set(['merged', 'in-flight', 'claimed-stale', 'stuck']);
const GREEN = new Set<StatusCheck['state']>(['success', 'neutral', 'skipped']);
const TEST_FILE = /(^|\/)(test|tests|__tests__|e2e)\/|\.(test|spec)\.[^/]+$/;
const MAX_DETAILS = 3;
const MAX_NEXT = 2;

/** Where the work is: its track, the step it is at, and the build's counts for a PRD. */
type Place = { track: Track; at: StepId };

const after = (at: StepId): Place => ({ track: 'prd-after', at });
const READY: Place = Object.freeze({ track: 'prd-before', at: 'ready' });

/** A PRD's step before it is approved. */
const beforeStep = (facts: PrdStatusFacts): StepId => {
  if (facts.approvalWait || facts.phase0Open) return 'approval';
  return facts.folder === 'none' ? 'shaping' : 'writing';
};

/** Where an approved PRD is once its parts are `built` (or its board was not read): its questions and its feature PR say. */
function finalPlace(facts: PrdStatusFacts, built: boolean): Place {
  if (facts.openQuestions > 0 && (built || facts.pullRequest)) return after('questions');
  if (facts.pullRequest?.state === 'open') return after('prd-review');
  return built ? after('checking') : READY;
}

/** Where an approved PRD with a plan is, from its board's slices. */
function buildPlace(facts: PrdStatusFacts): Place {
  const { slices } = facts;
  if (slices === null) return finalPlace(facts, false);
  if (!slices.some((slice) => STARTED.has(slice.state))) return READY;
  return slices.every((slice) => slice.state === 'merged') ? finalPlace(facts, true) : after('building');
}

function prdPlace(facts: PrdStatusFacts): Place {
  if (facts.folder === 'shipped' || facts.pullRequest?.state === 'merged') return after('shipped');
  if (!facts.approved) return { track: 'prd-before', at: beforeStep(facts) };
  return facts.plan ? buildPlace(facts) : after('planning');
}

/** Whether every one of `files` is a test, or in the fix's `folder`; files not known count as so. */
function testsOnly(files: readonly string[] | null, folder: string): boolean {
  const inside = `${folder.replace(/\/+$/, '')}/`;
  return (files ?? []).every((file) => TEST_FILE.test(file) || file.startsWith(inside));
}

const checksGreen = (checks: readonly StatusCheck[] | null): boolean => checks !== null && checks.every((check) => GREEN.has(check.state));

/** The steps of a fix read before its pull request's, by kind. */
const FIX_STEPS = Object.freeze({
  bug: { merged: 'fix-merged', branch: 'reproducing', none: 'understanding' },
  visual: { merged: 'visual-merged', branch: 'applying', none: 'options' },
} as const satisfies Record<'bug' | 'visual', Record<string, StepId>>);

/** A fix's step on its pull request `pullRequest`, neither merged nor gone. */
function pullRequestStep(facts: FixStatusFacts, pullRequest: StatusPullRequest): StepId {
  const open = pullRequest.state === 'open';
  if (facts.kind === 'visual') return open && checksGreen(pullRequest.checks) ? 'visual-review' : 'checks';
  if (open) return 'fix-review';
  return testsOnly(pullRequest.files, facts.folder) ? 'fixing' : 'fix-checks';
}

function fixStep(facts: FixStatusFacts): StepId {
  const steps = FIX_STEPS[facts.kind];
  const { pullRequest } = facts;
  if (facts.merged || pullRequest?.state === 'merged') return steps.merged;
  if (pullRequest) return pullRequestStep(facts, pullRequest);
  return facts.branch ? steps.branch : steps.none;
}

const fixPlace = (facts: FixStatusFacts): Place => ({ track: facts.kind, at: fixStep(facts) });

/** The build's counts of a PRD: merged slices of all. */
function counts(facts: StatusFacts): { k: number; n: number } {
  const slices = facts.kind === 'prd' ? (facts.slices ?? []) : [];
  return { k: slices.filter((slice) => slice.state === 'merged').length, n: slices.length };
}

/** Where a person answers or approves: the work's page, else its pull request, else GitHub. */
function whereOf({ links }: StatusFacts): string {
  if (links.page) return WHERE.page;
  return links.pullRequest ? WHERE.pullRequest : WHERE.github;
}

/** The track's steps, the fifth of a PRD's build being `Questions for you` while the work is at it. */
function stepsOf({ track, at }: Place, values: Readonly<Record<string, string | number>>): StatusStep[] {
  const nameOf = (id: StepId): string => (id === 'building' && values.n === 0 ? BUILDING_UNCOUNTED : fill(STEPS[id].name, values));
  return TRACKS[track].map((id) => (id === 'prd-review' && at === 'questions' ? 'questions' : id)).map((id) => ({ id, name: nameOf(id), short: STEPS[id].short }));
}

/** The verdict the facts say over the step, or `null` when the step's own holds. */
/** A verdict, and the Next it says instead of the step's (`null`: the step's stays). */
type Said = { verdict: Status['verdict']; next: readonly string[] | null };

const failedChecks = (facts: StatusFacts): StatusCheck[] => (facts.pullRequest?.checks ?? []).filter((check) => check.state === 'failure');

/** The stuck verdict `key`, its sentence filled from `values`. */
function stuckSaid(key: keyof typeof VERDICTS, values: Readonly<Record<string, string>> = {}): Said {
  const said = VERDICTS[key];
  return { verdict: { level: 'stuck', line: `${said.label}: ${fill(said.sentence, values)}.` }, next: said.next };
}

/** The stuck verdict the facts say over the step, or `null` when none holds. */
function stuckVerdict(facts: StatusFacts): Said | null {
  if (facts.pullRequest?.state === 'closed') return stuckSaid('closed');
  const failed = failedChecks(facts).length;
  if (failed > 0) return stuckSaid('failed', { failed: failedCount(failed) });
  const stuck = facts.kind === 'prd' ? (facts.slices ?? []).filter((slice) => slice.state === 'stuck').length : 0;
  return stuck > 0 ? stuckSaid('stuck', { stuck: stuckParts(stuck) }) : null;
}

const isOpen = (pullRequest: StatusPullRequest | null): boolean => pullRequest?.state === 'open' || pullRequest?.state === 'draft';

/** The verdict over the step `words`: stuck, else Waiting for you when You asks, else Waiting while
 * an open pull request's checks are not known, else On track. */
function verdictOf(facts: StatusFacts, words: StepWords, values: Readonly<Record<string, string | number>>): Said {
  const stuck = stuckVerdict(facts);
  if (stuck) return stuck;
  if (!words.asks && isOpen(facts.pullRequest) && facts.pullRequest?.checks === null) {
    return { verdict: { level: 'waiting', line: `${CHECKS_UNKNOWN.label}: ${CHECKS_UNKNOWN.sentence}.` }, next: null };
  }
  const level = words.asks ? 'waiting' : 'on-track';
  return { verdict: { level, line: `${LEVEL_LABELS[level]}: ${fill(words.sentence, values)}.` }, next: null };
}

/** The status of the work whose facts are `facts`, its technical words marked for the block. */
export function readStatus(facts: StatusFacts): Status {
  const place = fixOrPrd(facts);
  const questions = facts.kind === 'prd' ? facts.openQuestions : 0;
  const values = { ...counts(facts), questions: questionsWait(questions), theQuestions: theQuestions(questions), where: whereOf(facts) };
  const words = STEPS[place.at];
  const steps = stepsOf(place, values);
  const { verdict, next } = verdictOf(facts, words, values);
  return {
    verdict,
    kind: facts.kind,
    steps,
    at: steps.findIndex((entry) => entry.id === place.at) + 1,
    you: fill(words.you, values) || NOTHING_TO_DO,
    next: (next ?? words.next.map((item) => fill(item, values))).slice(0, MAX_NEXT),
    details: failedChecks(facts).map((check) => check.name).slice(0, MAX_DETAILS),
    checkedAt: facts.checked.at,
  };
}

const fixOrPrd = (facts: StatusFacts): Place => (facts.kind === 'prd' ? prdPlace(facts) : fixPlace(facts));

/** The status of the work whose facts are `facts`, as `omni now --json` carries it: every word plain. */
export function statusOf(facts: StatusFacts): Status {
  const status = readStatus(facts);
  return {
    ...status,
    verdict: { ...status.verdict, line: plain(status.verdict.line) },
    steps: status.steps.map((entry) => ({ ...entry, name: plain(entry.name) })),
    you: plain(status.you),
    next: status.next.map(plain),
  };
}

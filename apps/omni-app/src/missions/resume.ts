// The resume step (PRD omni-loop-21 s10, spec section 5): a step whose job ended without its result line gets one fresh job of the
// same skill, which reads where the PRD stands on GitHub and goes on from there. Pure, over the step's jobs as the store reads them
// back (./store.ts: its first job under the step's key, each fresh one under `:resume:<k>`, read with its `resume`). The supervisor
// asks `resumeStep` once a PRD's latest job ended, at `alone`, and sends the fresh job it names through the store's `send` with
// that `resume`; `halfwayEvent` is what that end says.
//
//   halfway       a job that ended done with no result line its step reads (the table's `stopped`): a hand-back, the machine
//                 asleep, a job that ended before it wrote its line. A hold, a failure, a lost runner or a cancel is no halfway end,
//                 and QA's pair keeps its own reading (PRD 3001): a QA job with no verdict fails, an Engineer's fix lands
//   the count     the step's jobs that ended halfway, the latest included, each counting one; a job that ended on a spend or rate
//                 limit (PRD 2949: its `limitedUntil`) counts none, since its wait is the runner's, not the step's
//   resume        while the count is at most `mandate.resumes` (0 to 10, 3 when the brief says nothing), one fresh job of the same
//                 step, the next `:resume:<k>`; the run and the step stay as they were, so a resume moves nothing (./stuck.ts)
//   repair        past that, or past the tenth key, the step goes to repair (PRD 2980, ./repair.ts), as a failed step does
//   below alone   none: a step that stopped mid-way is sent again once as run 2, then stops, as before
import { DEFAULT_RESUMES, type MissionLevel } from 'omni-loop/kit/lib/mission/brief.ts';
import type { PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { isFixStep, isQaStep } from './qa.ts';
import type { Resumed } from './store.ts';
import type { Attempt, NewEvent, Run } from './supervisor.ts';

/** A step's job as the store reads it back: its run, and which fresh job of its step it is. */
export type StepJob = Run & Resumed;

/** The highest resume a step's key takes (`:resume:10`, ./store.ts): `mandate.resumes` is 0 to 10. */
const RESUMES_MAX = 10;

/** The words a job's result line ends on, as the supervisor's table reads them: any other end of a done job is halfway. */
const RESULT_WORDS: ReadonlySet<string> = new Set(['ready', 'answers', 'human', 'held', 'review', 'changes']);

/** Whether a job ended halfway: done, with no result line its step reads and no QA verdict. */
export const endedHalfway = ({ status, outcome, checked }: Attempt): boolean => status === 'done' && checked == null && (outcome === null || !RESULT_WORDS.has(outcome));

/** Which fresh job of its step a job is: 0 for the step's first, k for its k-th resume. */
export const resumeOf = (job: Resumed): number => job.resume ?? 0;

/** Whether a job ended on a spend or rate limit (PRD 2949): its end counts no resume. */
const onLimit = (attempt: Attempt): boolean => attempt.limitedUntil != null;

/** Whether a step's job counts toward its resumes: its last attempt ended on no spend or rate limit. */
const counts = (job: StepJob): boolean => {
  const last = job.attempts.at(-1);
  return last !== undefined && !onLimit(last);
};

/** The resumes a mission gives a step: `mandate.resumes` at `alone` (3 when the brief says nothing); null below it, which resumes none. */
export const resumeCap = ({ level, resumes }: { level: MissionLevel; resumes?: number }): number | null => (level === 'alone' ? (resumes ?? DEFAULT_RESUMES) : null);

/**
 * Where a step whose latest job ended halfway goes: a fresh job, its `resume`, and its `count` of `cap` when its end `counted` (one
 * on a spend or rate limit counts none); or repair, saying why.
 */
export type ResumeNext = { next: 'resume'; resume: number; count: number; cap: number; counted: boolean } | { next: 'repair'; why: string; count: number };

/** `once`, `4 times`. */
const timesWords = (count: number): string => (count === 1 ? 'once' : `${String(count)} times`);

/** `it ended without its result line 4 times`: why a step goes to repair once its resumes are spent. */
const spentWhy = (count: number): string => `it ended without its result line ${timesWords(count)}`;

/**
 * Where the step goes whose jobs are `jobs` (its first and its resumes, any order), its latest one having ended halfway: a fresh job
 * while its count is at most `cap` (`mandate.resumes`), else repair.
 */
export function resumeNext(jobs: readonly StepJob[], cap: number = DEFAULT_RESUMES): ResumeNext {
  const latest = jobs.reduce<StepJob | null>((last, one) => (last === null || resumeOf(one) > resumeOf(last) ? one : last), null);
  const count = jobs.filter(counts).length;
  if (latest === null || count > cap || resumeOf(latest) >= RESUMES_MAX) return { next: 'repair', why: spentWhy(count), count };
  return { next: 'resume', resume: resumeOf(latest) + 1, count, cap, counted: counts(latest) };
}

/** The jobs of `one`'s PRD, run and step among `runs`, up to `one`: the step's first job and its resumes until then. */
export const stepJobs = (runs: readonly StepJob[], one: StepJob): StepJob[] =>
  runs.filter((other) => other.prd === one.prd && other.run === one.run && other.step === one.step && resumeOf(other) <= resumeOf(one));

/** Whether the resume step reads `one`'s end: a build, a Reviewer or a fix whose last attempt ended halfway, at a level with a cap. */
const halfwayAt = (one: StepJob, cap: number | null): boolean => {
  const last = one.attempts.at(-1);
  return cap !== null && last !== undefined && endedHalfway(last) && !isQaStep(one.step) && !isFixStep(one.step);
};

/**
 * What the resume step makes of `latest`, a PRD's latest job among `runs`, at a mission whose cap is `cap` (`resumeCap`): its fresh
 * job or its repair once it ended halfway; null when it did not, or below `alone`, where the supervisor's table reads it as before.
 */
export function resumeStep(runs: readonly StepJob[], latest: StepJob, cap: number | null): ResumeNext | null {
  return cap !== null && halfwayAt(latest, cap) ? resumeNext(stepJobs(runs, latest), cap) : null;
}

/** What a halfway end says at `alone`: `PRD 1 ended without its result line: the mission sends it a fresh job (resume 1 of 3).` */
export function halfwayWords(n: string, next: ResumeNext): string {
  if (next.next === 'repair') return `${n} ended without its result line ${timesWords(next.count)}: the mission sends a repair, while it has one left.`;
  const which = next.counted ? `resume ${String(next.count)} of ${String(next.cap)}` : 'a spend or rate limit counts none';
  return `${n} ended without its result line: the mission sends it a fresh job (${which}).`;
}

/**
 * The event of `one`'s halfway end (its kind `held`, keyed by its job's end, so it is recorded once), read over the step's jobs up to
 * it; null when the resume step does not read its end. Signed `supervisor`, by `agent`.
 */
export function halfwayEvent(prd: PrdNumber, one: StepJob, runs: readonly StepJob[], cap: number | null): NewEvent | null {
  const next = resumeStep(runs, one, cap);
  const last = one.attempts.at(-1);
  if (next === null || last === undefined) return null;
  return { kind: 'held', role: 'supervisor', prd, job: last.id, link: null, sentence: halfwayWords(`PRD ${String(prd)}`, next) };
}

/** `, resume 2`: what a resume's dispatch adds to its run; nothing for a step's first job. */
export const resumeWords = (job: Resumed): string => (resumeOf(job) === 0 ? '' : `, resume ${String(resumeOf(job))}`);

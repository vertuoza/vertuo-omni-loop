// Whether a PRD continues once its answers are in (PRD 2270, s1). After a touch's read of the PRD's
// dossier, the page queues `/omni:yolo-fix <n>` to the runner job that waited, when all of these hold:
//
// - every open outbox item ranked high or human-action has a counted reply, as PRD 2223's outboxStand
//   reads it (../dossier/page/stage.ts): a held reply, or one from an author GitHub does not list as an
//   owner, member or collaborator, does not count, so the page and the runner never disagree;
// - the PRD's newest runner job in the repository ended done with outcome `answers`;
// - no job of the PRD in the repository is queued, claimed or running;
// - that job has not been continued already (the database holds it too: runner_jobs.continues is unique);
// - the repository's Fix on a runner once answered is on. A repository the workspace does not list has
//   no switch a person can see or turn off: it reads as off.
//
// When it cannot decide (the outbox or the replies unread), nothing is queued: the next touch decides
// again. Plain functions over what was read, so each condition is tested failing alone
// (./continue.test.ts).
import { PrdNumberSchema, type PrdNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import type { OutboxStand } from '../dossier/page/stage';
import { checkLine, type JOB_OUTCOMES, type RunnerSkill } from './runners.contract';

/** A job, as the decision reads it: the columns of a runner_jobs row it needs. */
export type JobSeen = {
  id: string;
  line: string;
  status: 'queued' | 'claimed' | 'running' | 'done' | 'failed' | 'cancelled';
  outcome?: (typeof JOB_OUTCOMES)[number] | null | undefined;
  continues?: string | null | undefined;
  queued_at: string;
};

export type ContinueInput<J extends JobSeen> = {
  prd: PrdNumber;
  /** Where the PRD's asked questions stand; null when the outbox or the replies were not read, or none is asked. */
  stand: OutboxStand | null;
  /** The repository's jobs that may be the PRD's, in any order: a job of another PRD is left out here. */
  jobs: readonly J[];
  /** The repository's Fix on a runner once answered. */
  switchOn: boolean;
};

export type ContinueDecision<J extends JobSeen> = { continue: true; job: J } | { continue: false; why: string };

/** The skills whose line names a PRD by its number first; a fix's skills take a bug, not a PRD. */
const PRD_SKILLS: ReadonlySet<RunnerSkill> = new Set<RunnerSkill>(['yolo', 'yolo-fix', 'pr-care', 'do-work', 'wave', 'plan', 'pitch', 'prove']);

const ACTIVE: ReadonlySet<JobSeen['status']> = new Set<JobSeen['status']>(['queued', 'claimed', 'running']);

/** The PRD a runner's line names: `/omni:yolo 2270`, `/omni:do-work 2270 s1`; null for any other line. */
export function prdOfLine(line: string): PrdNumber | null {
  const checked = checkLine(line);
  if (!checked.ok || !PRD_SKILLS.has(checked.skill)) return null;
  const first = checked.args.split(' ')[0] ?? '';
  if (!/^\d+$/.test(first)) return null;
  const prd = PrdNumberSchema.safeParse(Number(first));
  return prd.success ? prd.data : null;
}

/** Whether something was asked and every asked item has a counted reply. */
export function answeredAll(stand: OutboxStand | null): boolean {
  return stand !== null && stand.asked > 0 && stand.answered === stand.asked;
}

/** Why the asked questions do not let the PRD continue yet; null once every one has a counted reply. */
export function unansweredWhy(stand: OutboxStand | null): string | null {
  if (answeredAll(stand)) return null;
  if (stand === null) return 'the outbox or its replies were not read, or nothing was asked';
  return `${String(stand.answered)} of ${String(stand.asked)} asked items answered`;
}

/** The newest of the jobs, by when it was queued. */
function newestOf<J extends JobSeen>(jobs: readonly J[]): J | undefined {
  return [...jobs].sort((a, b) => b.queued_at.localeCompare(a.queued_at) || b.id.localeCompare(a.id))[0];
}

export function shouldContinue<J extends JobSeen>({ prd, stand, jobs, switchOn }: ContinueInput<J>): ContinueDecision<J> {
  const no = (why: string): ContinueDecision<J> => ({ continue: false, why });
  if (!switchOn) return no('Fix on a runner once answered is off for this repository');
  const unanswered = unansweredWhy(stand);
  if (unanswered !== null) return no(unanswered);
  const ofPrd = jobs.filter((job) => prdOfLine(job.line) === prd);
  const busy = ofPrd.find((job) => ACTIVE.has(job.status));
  if (busy) return no(`a job of PRD ${String(prd)} is ${busy.status}`);
  const newest = newestOf(ofPrd);
  if (!newest) return no(`no runner job of PRD ${String(prd)} here`);
  if (newest.status !== 'done' || newest.outcome !== 'answers') return no(`its newest runner job, ${newest.id}, did not end on Waiting on answers`);
  if (jobs.some((job) => job.continues === newest.id)) return no(`job ${newest.id} was continued already`);
  return { continue: true, job: newest };
}

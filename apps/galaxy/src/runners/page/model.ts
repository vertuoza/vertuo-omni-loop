import type { Board, Job, Runner, Target } from '../runners.contract';

type RunnerHealth = NonNullable<Runner['health']>;

// The Runners page's words (PRD 1830 s3), from the board the service reads: pure, so each runner state
// and each job status is tested without a page. A runner reads Online, Busy, or Offline with when it
// was last seen; a job reads Queued, Running with its time, Done, Failed with its reason (Runner lost,
// Timeout, its exit code), or Cancelled. Cancel shows on a queued or running job, Send again on a
// failed or cancelled one, sent again to where it first went.

/** A fleet a runner may be given to: its key (`teams.name`) and the label the app shows. */
export type Fleet = { name: string; label: string };

/** The page in each situation: before the board (the shared gate), the board, or a read that failed. */
export type RunnersPageView =
  | { kind: 'closed' }
  | { kind: 'sign-in' }
  | { kind: 'no-workspace' }
  | { kind: 'unreadable' }
  | { kind: 'board'; name: string; board: Board; fleets: readonly Fleet[]; now: string; answered: readonly string[] };

/** The command that starts a runner, as the empty page shows it. */
export const START_COMMAND = 'omni runner --name <name> --repos <dir>';

/** How often the page reads its rows again, while it is open. */
export const REFRESH_MS = 5_000;

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** How long `ms` is, in the page's short words: `12 min`, `3 h`, `2 d`; under a minute, `now`. */
function spanOf(ms: number): string {
  if (ms < MIN) return 'now';
  if (ms < HOUR) return `${String(Math.floor(ms / MIN))} min`;
  if (ms < DAY) return `${String(Math.floor(ms / HOUR))} h`;
  return `${String(Math.floor(ms / DAY))} d`;
}

const since = (iso: string, now: Date) => Math.max(0, now.getTime() - Date.parse(iso));

/** A runner's state in words: Online, Busy, or Offline with when it was last seen. */
export function stateWords(runner: Pick<Runner, 'state' | 'lastSeenAt'> & { health?: Pick<RunnerHealth, 'paused'> | null | undefined }, now: Date): string {
  if (runner.state !== 'offline' && runner.health?.paused) return `Paused: ${runner.health.paused}`;
  if (runner.state === 'online') return 'Online';
  if (runner.state === 'busy') return 'Busy';
  const ago = spanOf(since(runner.lastSeenAt, now));
  return ago === 'now' ? 'Offline' : `Offline, ${ago} ago`;
}

/** A done job's outcome in words (PRD 2223). */
const OUTCOME_WORDS = { answers: 'Waiting on answers', held: 'Held', ready: 'Ready' } as const;

/** What a job that waited on answers reads once they are in (PRD 2270): Answered · fixing while its
 * continuation is queued, starting or running, Answered · fixed once that ended, linking it; Answered with a
 * Fix with answers button when every asked item is answered and nothing continued it (`answered` holds the
 * ids of the jobs the page's read found so). Null: it still reads Waiting on answers, or is no such job. */
export type Answered = { words: 'Answered · fixing' | 'Answered · fixed' | 'Answered'; tone: 'run' | 'done' | 'wait'; fix: string | null; button: boolean };

export function answeredOf(job: Pick<Job, 'id' | 'status' | 'outcome'>, jobs: readonly Pick<Job, 'id' | 'status' | 'continues'>[], answered: readonly string[]): Answered | null {
  if (job.status !== 'done' || job.outcome !== 'answers') return null;
  const fix = jobs.find((other) => other.continues === job.id);
  if (fix) {
    const going = fix.status === 'queued' || fix.status === 'claimed' || fix.status === 'running';
    return going ? { words: 'Answered · fixing', tone: 'run', fix: fix.id, button: false } : { words: 'Answered · fixed', tone: 'done', fix: fix.id, button: false };
  }
  return answered.includes(job.id) ? { words: 'Answered', tone: 'wait', fix: null, button: true } : null;
}

/** Under the fix job's line: `after answers · job <8 characters>`; null for any other job. */
export const afterAnswersWords = (job: Pick<Job, 'continues'>): string | null =>
  job.continues ? `after answers · job ${job.continues.slice(0, 8)}` : null;

/** The fix a job that waited asks for once answered: the same PRD's `/omni:yolo-fix <n>`; null when its line names none. */
export function fixLineOf(job: Pick<Job, 'line'>): string | null {
  const number = /^\/omni:[a-z-]+ (\d+)/.exec(job.line)?.[1];
  return number === undefined ? null : `/omni:yolo-fix ${number}`;
}

/** A job's status in words. */
export function statusWords(job: Pick<Job, 'status' | 'reason' | 'exitCode' | 'runningAt' | 'claimedAt'> & { outcome?: Job['outcome'] }, now: Date): string {
  switch (job.status) {
    case 'queued': return 'Queued';
    case 'claimed': return 'Starting';
    case 'running': {
      const from = job.runningAt ?? job.claimedAt;
      return from ? `Running ${spanOf(since(from, now))}` : 'Running';
    }
    case 'done': return job.outcome ? OUTCOME_WORDS[job.outcome] : 'Done';
    case 'cancelled': return 'Cancelled';
    case 'failed':
      if (job.reason === 'runner lost') return 'Runner lost';
      if (job.reason === 'timeout') return 'Timeout';
      if (job.exitCode !== null) return `Failed, exit ${String(job.exitCode)}`;
      return 'Failed';
  }
}

/** The tone a status is drawn in. */
export function statusTone(status: Job['status'], outcome?: Job['outcome']): 'queue' | 'run' | 'done' | 'fail' | 'off' | 'wait' {
  if (status === 'done' && (outcome === 'answers' || outcome === 'held')) return 'wait';
  if (status === 'queued') return 'queue';
  if (status === 'claimed' || status === 'running') return 'run';
  if (status === 'done') return 'done';
  return status === 'failed' ? 'fail' : 'off';
}

/** Whether a job may still be cancelled: queued or Starting, which a cancel ends at once (#2168), or
 * running with no cancel asked yet. */
export const canCancel = (job: Pick<Job, 'status' | 'cancelRequested'>): boolean =>
  job.status === 'queued' || job.status === 'claimed' || (job.status === 'running' && !job.cancelRequested);

/** Whether a job may be sent again: it failed or was cancelled. Nothing runs again by itself. */
export const canSendAgain = (job: Pick<Job, 'status'>): boolean => job.status === 'failed' || job.status === 'cancelled';

/** Where a job first went, to send it there again. */
export function targetOf(job: Pick<Job, 'toRunner' | 'toFleet'>): Target {
  if (job.toRunner !== null) return { kind: 'runner', runner: job.toRunner };
  if (job.toFleet !== null) return { kind: 'fleet', fleet: job.toFleet };
  return { kind: 'any' };
}

/** A fleet's label, or its key when the workspace no longer lists it. */
const fleetLabel = (fleet: string, fleets: readonly Fleet[]): string => fleets.find((f) => f.name === fleet)?.label ?? fleet;

/** A runner's name, by its id. */
const runnerName = (id: string, runners: readonly Pick<Runner, 'id' | 'name'>[]): string => runners.find((r) => r.id === id)?.name ?? 'A runner';

/** Where a job went, in words: a runner's name, a fleet's label, or Any runner; then the runner that took
 * it, when that is not already its name. */
export function whereWords(job: Pick<Job, 'toRunner' | 'toFleet' | 'runner'>, runners: readonly Pick<Runner, 'id' | 'name'>[], fleets: readonly Fleet[]): string {
  const target = job.toRunner !== null ? runnerName(job.toRunner, runners) : job.toFleet !== null ? fleetLabel(job.toFleet, fleets) : 'Any runner';
  return job.runner !== null && job.runner !== job.toRunner ? `${target} · ${runnerName(job.runner, runners)}` : target;
}

/** Who sent a job: `API key <name>` for a key's (PRD 2022), else their GitHub login, or a member. */
export const senderWords = (job: Pick<Job, 'sentByLogin' | 'sentByKey'>): string =>
  job.sentByKey !== null ? `API key ${job.sentByKey}` : job.sentByLogin ? `@${job.sentByLogin}` : 'A member';

/** Under a key's name, who made the key: `made by @<login>`; nothing for a person's job. */
export const madeByWords = (job: Pick<Job, 'sentByLogin' | 'sentByKey'>): string | null =>
  job.sentByKey !== null && job.sentByLogin ? `made by @${job.sentByLogin}` : null;

/** A repository's name, without its owner. */
export const repoName = (repo: string): string => repo.slice(repo.indexOf('/') + 1);

/** The link to the PRD page of a job with an outcome (PRD 2223): `/prd/at/<owner>/<repo>/<n>`, the PRD being
 * the number its line names; null for a job without an outcome or a line that names no PRD. */
export function prdPageLink(job: Pick<Job, 'line' | 'repo' | 'outcome' | 'status'>): string | null {
  const number = /^\/omni:[a-z-]+ (\d+)$/.exec(job.line)?.[1];
  if (job.status !== 'done' || !job.outcome || number === undefined) return null;
  return `/prd/at/${job.repo.split('/').map(encodeURIComponent).join('/')}/${number}`;
}

/** A pull request link's words: `PR #1838`, or `Pull request` when the link names no number. */
export function prWords(url: string): string {
  const number = /\/pull\/(\d+)$/.exec(url)?.[1];
  return number ? `PR #${number}` : 'Pull request';
}

/** What a job's runner said of its claims once the job ended (PRD 2175): the sub-PRs it released, each with
 * its link, or why it could not release them. */
export type ReleaseNote =
  | { kind: 'released'; prs: readonly { number: number; url: string }[] }
  | { kind: 'failed'; text: string };

/** The lines under a job's status about its claims, in `--ask-red`: `Released #<n>, …`, then `Could not
 * release this job's claims: <why>`; none when its runner released nothing and nothing failed. */
export function releaseNotes(job: Pick<Job, 'repo' | 'released' | 'releaseError'>): ReleaseNote[] {
  const released = job.released ?? [];
  return [
    ...(released.length === 0 ? [] : [{ kind: 'released' as const, prs: released.map((number) => ({ number, url: `https://github.com/${job.repo}/pull/${String(number)}` })) }]),
    ...(job.releaseError ? [{ kind: 'failed' as const, text: `Could not release this job's claims: ${job.releaseError}` }] : []),
  ];
}

/** The fleet cell of a runner: a picker for a workspace owner, its label (or Shared) for everyone else. */
export function fleetCell(runner: Pick<Runner, 'fleet'>, viewer: Board['viewer'], fleets: readonly Fleet[]):
  { kind: 'picker'; value: string; options: readonly { value: string; label: string }[] } | { kind: 'text'; label: string } {
  if (!viewer.owner) return { kind: 'text', label: runner.fleet === null ? 'Shared' : fleetLabel(runner.fleet, fleets) };
  const options = [{ value: '', label: 'Shared' }, ...fleets.map((f) => ({ value: f.name, label: f.label }))];
  // A fleet the workspace no longer lists stays the picker's value until an owner changes it.
  if (runner.fleet !== null && !fleets.some((f) => f.name === runner.fleet)) options.push({ value: runner.fleet, label: runner.fleet });
  return { kind: 'picker', value: runner.fleet ?? '', options };
}

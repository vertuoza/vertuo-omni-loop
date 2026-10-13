import type { Board, Job, Runner, Target } from '../runners.contract';

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
  | { kind: 'board'; name: string; board: Board; fleets: readonly Fleet[]; now: string };

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
export function stateWords(runner: Pick<Runner, 'state' | 'lastSeenAt'>, now: Date): string {
  if (runner.state === 'online') return 'Online';
  if (runner.state === 'busy') return 'Busy';
  const ago = spanOf(since(runner.lastSeenAt, now));
  return ago === 'now' ? 'Offline' : `Offline, ${ago} ago`;
}

/** A job's status in words. */
export function statusWords(job: Pick<Job, 'status' | 'reason' | 'exitCode' | 'runningAt' | 'claimedAt'>, now: Date): string {
  switch (job.status) {
    case 'queued': return 'Queued';
    case 'claimed': return 'Starting';
    case 'running': {
      const from = job.runningAt ?? job.claimedAt;
      return from ? `Running ${spanOf(since(from, now))}` : 'Running';
    }
    case 'done': return 'Done';
    case 'cancelled': return 'Cancelled';
    case 'failed':
      if (job.reason === 'runner lost') return 'Runner lost';
      if (job.reason === 'timeout') return 'Timeout';
      if (job.exitCode !== null) return `Failed, exit ${String(job.exitCode)}`;
      return 'Failed';
  }
}

/** The tone a status is drawn in. */
export function statusTone(status: Job['status']): 'queue' | 'run' | 'done' | 'fail' | 'off' {
  if (status === 'queued') return 'queue';
  if (status === 'claimed' || status === 'running') return 'run';
  if (status === 'done') return 'done';
  return status === 'failed' ? 'fail' : 'off';
}

/** Whether a job may still be cancelled: queued or running, and no cancel asked yet. */
export const canCancel = (job: Pick<Job, 'status' | 'cancelRequested'>): boolean =>
  (job.status === 'queued' || job.status === 'claimed' || job.status === 'running') && !job.cancelRequested;

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

/** Who sent a job: their GitHub login, or a member. */
export const senderWords = (job: Pick<Job, 'sentByLogin'>): string => (job.sentByLogin ? `@${job.sentByLogin}` : 'A member');

/** A repository's name, without its owner. */
export const repoName = (repo: string): string => repo.slice(repo.indexOf('/') + 1);

/** A pull request link's words: `PR #1838`, or `Pull request` when the link names no number. */
export function prWords(url: string): string {
  const number = /\/pull\/(\d+)$/.exec(url)?.[1];
  return number ? `PR #${number}` : 'Pull request';
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

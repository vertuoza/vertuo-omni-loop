import type { Board, Job, JobQuestions, Runner, StoredOutcome, Target } from '../runners.contract';

type RunnerHealth = NonNullable<Runner['health']>;

/** What a job ended on, as the page's rules read it: the words the board sends, and the ones a bug fix's own end is stored as (PRD 2425). */
type Ended = StoredOutcome | null | undefined;

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
  // `demoQuestions` is the demo's alone (PRD 2255): the questions its Need human drawer reads and answers in the
  // browser, with no route to call. A page read from the database never carries it.
  | { kind: 'board'; name: string; board: Board; fleets: readonly Fleet[]; prds: PrdTitles; retros?: RetroPrds; now: string; answered: readonly string[]; demoQuestions?: readonly JobQuestions[] };

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

/** A done job's outcome in words (PRD 2223; `human`, PRD 2255: it ended with questions for a person). A bug fix's own end
 * (`already-fixed`, `pr-opened`…, PRD 2425) has none: it reads Done, as a bug fix's stop does, and showing it is a later change. */
const OUTCOME_WORDS: Readonly<Partial<Record<StoredOutcome, string>>> = { answers: 'Waiting on answers', held: 'Held', ready: 'Ready', human: 'Need human', stopped: 'Stopped mid-way' };

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
export function statusWords(job: Pick<Job, 'status' | 'reason' | 'exitCode' | 'runningAt' | 'claimedAt'> & { outcome?: Ended }, now: Date): string {
  switch (job.status) {
    case 'queued': return 'Queued';
    case 'claimed': return 'Starting';
    case 'running': {
      const from = job.runningAt ?? job.claimedAt;
      return from ? `Running ${spanOf(since(from, now))}` : 'Running';
    }
    case 'done': return (job.outcome ? OUTCOME_WORDS[job.outcome] : undefined) ?? 'Done';
    case 'cancelled': return 'Cancelled';
    case 'failed':
      if (job.reason === 'runner lost') return 'Runner lost';
      if (job.reason === 'timeout') return 'Timeout';
      if (job.exitCode !== null) return `Failed, exit ${String(job.exitCode)}`;
      return 'Failed';
  }
}

/** The tone a status is drawn in. */
export function statusTone(status: Job['status'], outcome?: Ended): 'queue' | 'run' | 'done' | 'fail' | 'off' | 'wait' {
  if (status === 'done' && outcome === 'stopped') return 'fail';
  if (status === 'done' && (outcome === 'answers' || outcome === 'held' || outcome === 'human')) return 'wait';
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

/** Whether a job may be resumed (PRD 2375): it ended done but stopped mid-way, before its hand-off. Resume sends
 * its line again, as Send again does, and only a person's press does it. */
export const canResume = (job: Pick<Job, 'status'> & { outcome?: Ended }): boolean => job.status === 'done' && job.outcome === 'stopped';

/** What a stopped job left (PRD 2375): `<k> / <n> slices merged`, or null when its runner could not read the board. */
export function slicesWords(job: Pick<Job, 'status'> & { outcome?: Job['outcome']; slicesMerged?: Job['slicesMerged']; slicesTotal?: Job['slicesTotal'] }): string | null {
  if (!canResume(job) || job.slicesMerged == null || job.slicesTotal == null) return null;
  return `${String(job.slicesMerged)} / ${String(job.slicesTotal)} slices merged`;
}

/** Whether a job shows the Need human button (PRD 2255): it ended done with its questions still open, which the
 * board reads as outcome `human`. Answered or dismissed, the board sends no outcome and it reads Done; a job
 * that asked and then failed or was cancelled never shows it. */
export const canAnswer = (job: Pick<Job, 'status'> & { outcome?: Ended }): boolean => job.status === 'done' && job.outcome === 'human';

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

/** Who sent a job: `Omni app` for one the app sent (PRD 2338), `API key <name>` for a key's (PRD 2022), else
 * their GitHub login, or a member. */
export const senderWords = (job: Pick<Job, 'sentByLogin' | 'sentByKey'> & { sentByApp?: Job['sentByApp'] }): string =>
  job.sentByApp === 'omni-app' ? 'Omni app' : job.sentByKey !== null ? `API key ${job.sentByKey}` : job.sentByLogin ? `@${job.sentByLogin}` : 'A member';

/** The PRD each retro pull request retells, by `<owner/repo in lower case>#<retro PR>`. */
export type RetroPrds = Readonly<Record<string, number>>;

/** The key of a retro pull request in `RetroPrds`. */
const retroKey = (repo: string, digits: string): string => `${repo.toLowerCase()}#${digits}`;

/** Under `Omni app`, what the app sent the job for (PRD 2338): `retro of PRD <n>` linked to the retro pull
 * request, or `retro PR #<pr>` when the page does not know the PRD; null for any other job. */
export function retroLineOf(job: Pick<Job, 'line' | 'repo'> & { sentByApp?: Job['sentByApp'] }, retros: RetroPrds): { words: string; href: string } | null {
  const pr = /^\/omni:retro-apply --retro (\d+)$/.exec(job.line)?.[1];
  if (job.sentByApp !== 'omni-app' || pr === undefined) return null;
  const prd = retros[retroKey(job.repo, pr)];
  return { words: prd === undefined ? `retro PR #${pr}` : `retro of PRD ${String(prd)}`, href: `https://github.com/${job.repo}/pull/${pr}` };
}

/** Under a key's name, who made the key, then whom the app said it acted for (PRD 2425): `made by @<login> · for <acting_for>`,
 * as given and never matched to a member; each part only when known, and nothing for a person's job. */
export function madeByWords(job: Pick<Job, 'sentByLogin' | 'sentByKey' | 'actingFor'>): string | null {
  if (job.sentByKey === null) return null;
  const parts = [job.sentByLogin ? `made by @${job.sentByLogin}` : null, job.actingFor ? `for ${job.actingFor}` : null];
  const known = parts.filter((part): part is string => part !== null);
  return known.length === 0 ? null : known.join(' · ');
}

/** Under Cancelled, the key that cancelled the job (PRD 2425): `by API key <name>`; nothing for a job a person cancelled, and
 * nothing for a job that is not cancelled. */
export const cancelledByWords = (job: Pick<Job, 'status' | 'cancelledByKey'>): string | null =>
  job.status === 'cancelled' && job.cancelledByKey ? `by API key ${job.cancelledByKey}` : null;

/** A repository's name, without its owner. */
export const repoName = (repo: string): string => repo.slice(repo.indexOf('/') + 1);

/** The outcomes of a PRD's hand-off (PRD 2223, 2375): the only ones whose line's number is a PRD's. */
const PRD_OUTCOMES: ReadonlySet<Ended> = new Set<Ended>(['answers', 'held', 'ready', 'stopped']);

/** The link to the PRD page of a job with an outcome (PRD 2223): `/prd/at/<owner>/<repo>/<n>`, the PRD being
 * the number its line names; null for a job without an outcome (and for Need human, or a bug fix's own end
 * (PRD 2425), whose number is a bug's issue, not a PRD) or a line that names no PRD. */
export function prdPageLink(job: Pick<Job, 'line' | 'repo' | 'status'> & { outcome?: Ended }): string | null {
  const number = /^\/omni:[a-z-]+ (\d+)$/.exec(job.line)?.[1];
  if (job.status !== 'done' || !PRD_OUTCOMES.has(job.outcome) || number === undefined) return null;
  return `/prd/at/${job.repo.split('/').map(encodeURIComponent).join('/')}/${number}`;
}

/** The PRD titles the page knows, by `<owner/repo in lower case>#<n>`: the repository's dossiers the viewer may read. */
export type PrdTitles = Readonly<Record<string, string>>;

/** The key of a PRD in `PrdTitles`. */
export const prdKey = (repo: string, number: number): string => `${repo.toLowerCase()}#${String(number)}`;

/** The PRD a job's line builds (PRD 2251), for the line under it: its number, the link to its page and its
 * title; null when the line is not `/omni:<skill> <n>` or the job's repository has no dossier of PRD n. */
export function prdLineOf(job: Pick<Job, 'line' | 'repo'>, prds: PrdTitles): { number: number; href: string; title: string } | null {
  const digits = /^\/omni:[a-z-]+ (\d+)$/.exec(job.line)?.[1];
  if (digits === undefined) return null;
  const number = Number(digits);
  const title = prds[prdKey(job.repo, number)];
  if (title === undefined) return null;
  return { number, href: `/prd/at/${job.repo.split('/').map(encodeURIComponent).join('/')}/${digits}?to=page`, title };
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

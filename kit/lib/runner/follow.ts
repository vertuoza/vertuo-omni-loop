// What `omni runner follow <n>` prints (PRD 2251): the milestones of a PRD's job, each once, in order.
// `milestones` is pure: it takes what was seen so far, the job as the app reads it, the job's new
// lines and the board's count of merged slices, and answers the new milestone lines and what is now
// seen. The command reads the job and its lines every 5 seconds and prints what this answers.
//
// The milestones, in the order they can happen: `queued`; `claimed by <runner>`; `waiting for
// approval` (while the lines show `omni wait approval` waiting); each `PR: <link>` the job writes of its own repository;
// `<k>/<total> slices merged` when the count goes up; then the ending, with the PRD page link:
// `Waiting on answers`, `Held`, `Ready`, `Need human` (PRD 2255), `Stopped mid-way · <k> / <n> slices merged`
// and the line to send again (PRD 2375) or `Done` (PRD 2223's outcome), `Failed: <reason>`,
// `Cancelled` or `Runner lost`.

/** The job, as the follow reads it: the part of the app's answer the milestones need. */
export type FollowJob = {
  status: 'queued' | 'claimed' | 'running' | 'done' | 'failed' | 'cancelled';
  /** The job's repository, as `owner/name`: only a pull request of it is the job's (bug 2567). */
  repo: string;
  runner: string | null;
  outcome: 'answers' | 'held' | 'ready' | 'human' | 'stopped' | null;
  reason: string | null;
  exitCode: number | null;
  /** The line the job ran, which a stopped job's ending gives to send again (PRD 2375). */
  line?: string;
};

/** The board's count of a PRD's slices: how many are merged of how many. */
export type MergedCount = { merged: number; total: number } | null;

/** What the follow has printed: nothing more is printed twice. */
export type Seen = { queued: boolean; claimedBy: string | null; waiting: boolean; prs: readonly string[]; merged: number; ended: boolean };

/** Nothing seen yet. */
const NOTHING_SEEN: Seen = Object.freeze({ queued: false, claimedBy: null, waiting: false, prs: [], merged: 0, ended: false });

/** The runner's `hh:mm:ss ` stamp, when a line has one. */
const STAMP = /^\d{2}:\d{2}:\d{2} /;
/** A `PR: <link>` line the runner writes itself: a step's output is indented, and never one (bug 2567). */
const PR_LINE = /^(?:\d{2}:\d{2}:\d{2} )?PR: (\S+)$/;
/** `omni wait approval`'s waiting lines (`◌ PRD <n> · waiting for …`) and the one that ends them. */
const WAITING = /^◌ PRD \d+ · waiting for /;
const APPROVED = /^✓ PRD \d+ approved /;

/** The ending's words: the same on the page, in the skills' hand-offs and in the terminal. */
const DONE_WORDS = { answers: 'Waiting on answers', held: 'Held', ready: 'Ready', human: 'Need human', stopped: 'Stopped mid-way' } as const;

/** Why a failed job failed, in words: its reason, else its exit code. */
const failure = ({ reason, exitCode }: FollowJob): string => reason ?? (exitCode === null ? 'no reason given' : `exit code ${String(exitCode)}`);

function ending(job: FollowJob, merged: MergedCount): string | null {
  if (job.status === 'cancelled') return 'Cancelled';
  if (job.status === 'failed') return job.reason === 'runner lost' ? 'Runner lost' : `Failed: ${failure(job)}`;
  if (job.status !== 'done') return null;
  if (job.outcome === 'stopped') return merged === null || merged.total === 0 ? DONE_WORDS.stopped : `${DONE_WORDS.stopped} · ${String(merged.merged)} / ${String(merged.total)} slices merged`;
  return job.outcome === null ? 'Done' : DONE_WORDS[job.outcome];
}

/** What the lines add to what was seen: whether a wait is on, and each pull request not printed yet. */
/** The job's own pull request a line names, or `undefined`: a `PR:` line the job wrote, of the job's repository. */
function ownPullRequest(raw: string, repo: string): string | undefined {
  const link = PR_LINE.exec(raw.trimEnd())?.[1];
  const [owner, name] = repo.toLowerCase().split('/');
  const parts = link === undefined ? null : /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/\d+$/i.exec(link);
  return parts !== null && parts[1]?.toLowerCase() === owner && parts[2]?.toLowerCase() === name ? link : undefined;
}

function readLines(lines: readonly string[], seen: Seen, repo: string): { waiting: boolean; waitingStarted: boolean; prs: string[] } {
  let waiting = seen.waiting;
  let waitingStarted = false;
  const prs = [...seen.prs];
  const fresh: string[] = [];
  for (const raw of lines) {
    const line = raw.trim().replace(STAMP, '');
    if (WAITING.test(line)) {
      if (!waiting) waitingStarted = true;
      waiting = true;
    } else if (APPROVED.test(line)) {
      waiting = false;
    }
    const pr = ownPullRequest(raw, repo);
    if (pr !== undefined && !prs.includes(pr)) {
      prs.push(pr);
      fresh.push(pr);
    }
  }
  return { waiting, waitingStarted, prs: fresh.length > 0 ? prs : [...seen.prs] };
}

/**
 * The new milestone lines for `job` and its new `lines`, and what is seen once they are printed.
 * `previous` is what an earlier call answered (`null`: nothing yet). `merged` is the board's count
 * (`null` when it cannot be read), and `page` the PRD's page link, which ends the ending's line.
 */
export function milestones(previous: Seen | null, job: FollowJob, lines: readonly string[], merged: MergedCount, page: string | null): { lines: string[]; seen: Seen } {
  const seen = previous ?? NOTHING_SEEN;
  const out: string[] = [];
  if (!seen.queued) out.push('queued');
  let claimedBy = seen.claimedBy;
  if (claimedBy === null && job.runner !== null) {
    claimedBy = job.runner;
    out.push(`claimed by ${job.runner}`);
  }
  const read = readLines(lines, seen, job.repo);
  if (read.waitingStarted) out.push('waiting for approval');
  for (const pr of read.prs.slice(seen.prs.length)) out.push(`PR: ${pr}`);
  let count = seen.merged;
  if (merged !== null && merged.total > 0 && merged.merged > count) {
    count = merged.merged;
    out.push(`${String(merged.merged)}/${String(merged.total)} slices merged`);
  }
  let ended = seen.ended;
  const last = ended ? null : ending(job, merged);
  if (last !== null) {
    ended = true;
    out.push(page === null ? last : `${last} · ${page}`);
    if (job.outcome === 'stopped' && job.status === 'done' && job.line !== undefined) out.push(`send it again: omni runner send '${job.line}'`);
  }
  return { lines: out, seen: { queued: true, claimedBy, waiting: read.waiting, prs: read.prs, merged: count, ended } };
}

/** Whether `job` has ended, so the follow stops: done, failed or cancelled. */
export function isEnded(job: Pick<FollowJob, 'status'>): boolean {
  return job.status === 'done' || job.status === 'failed' || job.status === 'cancelled';
}

/** The exit code of a follow that ended on `job`: `0` on done, `1` on failed, cancelled (runner lost included) or stopped mid-way (PRD 2375). */
export function exitCodeOf(job: Pick<FollowJob, 'status'> & { outcome?: FollowJob['outcome'] }): 0 | 1 {
  return job.status === 'done' && job.outcome !== 'stopped' ? 0 : 1;
}

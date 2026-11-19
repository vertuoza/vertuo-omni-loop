// The Omni Loop bug team's decisions (PRD 3088 s3, spec sections 2, 3 and 4): pure functions over what one run of an `omni-bugs`
// mission read. No database, no GitHub, no clock: ./bug-team-run.ts reads, calls these, then writes.
//
//   pick       the bugs in state `open`, most-reported first (`count` descending), then the oldest; a bug whose issue is closed,
//              has an open pull request that closes it (a person is on it), or was not read is skipped, as is one whose job is
//              still at work; up to the mandate's `parallel` bug fixes at once, the running ones counted
//   the job    `/omni:bug-fix #<issue>`, into the default branch, keyed `mission:<mission id>:bug:<issue>:run:<k>`: its only input
//              is the public issue, which holds the scrubbed report. Never a workspace, a repository or a login (AC-9)
//   its end    read into the bug's next state and tries:
//                pr-opened                       pr-opened, its fix pull request kept: it waits for a person's merge
//                already-fixed                   merged, the pull request it names kept: it waits for its release
//                need-human, needs-brainstorm,   asked: set aside, the job's own question waits for a person, the job kept; never
//                not-a-bug                       taken again (only an `open` bug is taken), so never asked twice
//                stuck, blocked, unreadable      one try spent, back `open`; the 3rd ends it `asked`, saying what was tried
//                lost                            back `open`, no try spent: a lost job's resume carries it while one is queued
//   events     bug-taken and bug-asked (role supervisor), job-ended (role engineer), one sentence each naming the issue and its
//              count, and one link, the public issue or the fix pull request; keyed by their job so a replay records none twice
import { IssueNumberSchema, PrNumberSchema, type IssueNumber, type PrNumber } from 'omni-loop/kit/lib/ids.ts';
import type { Attempt, NewEvent } from './supervisor.ts';

/** The tries a bug gets: the 3rd that ends with no pull request sets it aside (`omni_bug_reports.attempts`, 0 to 3). */
export const BUG_TRIES = 3;

/** Where the team stands on a bug (`omni_bug_reports.state`, PRD 3088 s2). */
export const BUG_STATES = ['open', 'fixing', 'pr-opened', 'asked', 'merged', 'fixed', 'wont-fix'] as const;
export type BugState = (typeof BUG_STATES)[number];

/**
 * A bug the App filed (a row of `omni_bug_reports`): its fingerprint, the key its row is moved by and never sent anywhere, its issue,
 * how often it was reported, when it was first filed, and the team's side of it.
 */
export type Bug = {
  fingerprint: string;
  issue: IssueNumber;
  count: number;
  createdAt: string;
  state: BugState;
  attempts: number;
  fixPr: PrNumber | null;
  fixedIn: string | null;
  askedJob: string | null;
};

/** One bug-fix job the team sent: its issue, its number among the bug's jobs, its id, and its attempts in order, the job's first. */
export type BugJob = { issue: IssueNumber; k: number; job: string; attempts: Attempt[] };

/** What GitHub says of a bug's issue: whether it is open, and the open pull request that closes it, when one does. */
export type IssueRead = { open: boolean; openFix: PrNumber | null };

/** A bug's row as a run moves it: its next state, its tries, its fix pull request and the job whose question set it aside. */
export type BugMove = Pick<Bug, 'state' | 'attempts' | 'fixPr' | 'askedJob'>;

/** The key a bug's k-th job is sent under: unique, so a replay or two runs at once send it once. */
export const bugKey = (mission: string, issue: IssueNumber, k: number): string => `mission:${mission}:bug:${String(issue)}:run:${String(k)}`;

const KEY = /^mission:[0-9a-f-]{36}:bug:([1-9][0-9]*):run:([1-9][0-9]*)$/;

/** The issue and number a bug job's key names; null for any other key. */
export function bugOfKey(key: string): { issue: IssueNumber; k: number } | null {
  const match = KEY.exec(key);
  const issue = IssueNumberSchema.safeParse(Number(match?.[1]));
  return match && issue.success ? { issue: issue.data, k: Number(match[2]) } : null;
}

/** The line a bug's job is sent as: the bug fix of its public issue, into the default branch. */
export const bugFixLine = (issue: IssueNumber): string => `/omni:bug-fix #${String(issue)}`;

/** The link to a bug's public issue on the Omni Loop repository `repo`. */
const issueLink = (repo: string, issue: IssueNumber): string => `https://github.com/${repo}/issues/${String(issue)}`;

// ── A job, as the team reads it ──────────────────────────────────────────────────

/** The reasons a job fails with when its runner is gone and its work resumes elsewhere (runner_resume: PRD 2809). */
const LOST = new Set(['runner lost', 'the worktree could not be made', 'the tmux session could not be started']);

/** A job's latest attempt: the resume that carries it, or the job itself. */
const lastOf = (job: BugJob): Attempt | undefined => job.attempts.at(-1);

/** Whether a job is still at work: its latest attempt queued, claimed or running. */
export const atWork = (job: BugJob): boolean => ['queued', 'claimed', 'running'].includes(lastOf(job)?.status ?? 'done');

/** A bug's latest job: the one with the highest number; undefined when none was sent. */
export const latestOf = (jobs: readonly BugJob[], issue: IssueNumber): BugJob | undefined =>
  jobs.filter((one) => one.issue === issue).reduce<BugJob | undefined>((last, one) => (last === undefined || one.k > last.k ? one : last), undefined);

/** The number the bug's next job is sent under: one past its last. */
export const nextK = (jobs: readonly BugJob[], issue: IssueNumber): number => (latestOf(jobs, issue)?.k ?? 0) + 1;

/** How a bug-fix job ended, as the team reads it. */
export type BugEnd =
  | { end: 'pr-opened'; pr: PrNumber | null }
  | { end: 'already-fixed'; pr: PrNumber | null }
  | { end: 'asked'; word: 'need-human' | 'needs-brainstorm' | 'not-a-bug' }
  | { end: 'spent'; word: string }
  | { end: 'lost' };

/** The pull request a link names; null when it names none. */
function prOf(url: string | null): PrNumber | null {
  const pr = PrNumberSchema.safeParse(Number(/\/pull\/(\d+)(?:[/#?].*)?$/.exec(url ?? '')?.[1]));
  return pr.success ? pr.data : null;
}

/** The asked endings: `human` is how the runner stores a bug fix's `need-human` (PRD 2425). */
const ASKED: Readonly<Record<string, 'need-human' | 'needs-brainstorm' | 'not-a-bug'>> = { human: 'need-human', 'need-human': 'need-human', 'needs-brainstorm': 'needs-brainstorm', 'not-a-bug': 'not-a-bug' };

/** How an attempt that ended reads: its outcome word, its runner lost, or unreadable (a failure, a cancel, no word the team knows). */
export function bugEndOf(attempt: Attempt): BugEnd {
  if (attempt.status === 'failed' && (attempt.limitedUntil != null || LOST.has(attempt.reason ?? ''))) return { end: 'lost' };
  if (attempt.status !== 'done') return { end: 'spent', word: attempt.status === 'cancelled' ? 'cancelled' : 'failed' };
  const word = attempt.outcome ?? '';
  if (word === 'pr-opened') return { end: 'pr-opened', pr: prOf(attempt.prUrl) };
  if (word === 'already-fixed') return { end: 'already-fixed', pr: prOf(attempt.prUrl) };
  const asked = ASKED[word];
  if (asked !== undefined) return { end: 'asked', word: asked };
  return { end: 'spent', word: word === 'stuck' || word === 'blocked' ? word : 'unreadable' };
}

// ── Pick ─────────────────────────────────────────────────────────────────────────

/** Most-reported first, then the oldest; the issue last, so the order never depends on how the rows were read. */
const byCount = (a: Bug, b: Bug): number => b.count - a.count || a.createdAt.localeCompare(b.createdAt) || a.issue - b.issue;

/** The open bugs a run may take, in order, none with a job at work: those whose issues it reads. */
export function candidatesOf(bugs: readonly Bug[], jobs: readonly BugJob[]): Bug[] {
  return bugs.filter((bug) => bug.state === 'open' && !jobs.some((one) => one.issue === bug.issue && atWork(one))).sort(byCount);
}

/** How many of the bugs are being fixed: a job of theirs at work, or their row `fixing`. */
export const runningOf = (bugs: readonly Bug[], jobs: readonly BugJob[]): number =>
  bugs.filter((bug) => bug.state === 'fixing' || jobs.some((one) => one.issue === bug.issue && atWork(one))).length;

/**
 * The bugs this run takes (AC-1, AC-2): the open ones, most-reported first, then the oldest, skipping a closed issue, an open pull
 * request that closes it and an issue not read, while fewer than `parallel` run.
 */
export function pickBugs({ bugs, jobs, issues, parallel }: { bugs: readonly Bug[]; jobs: readonly BugJob[]; issues: ReadonlyMap<IssueNumber, IssueRead>; parallel: number }): Bug[] {
  const slots = parallel - runningOf(bugs, jobs);
  if (slots <= 0) return [];
  return candidatesOf(bugs, jobs)
    .filter((bug) => {
      const read = issues.get(bug.issue);
      return read !== undefined && read.open && read.openFix === null;
    })
    .slice(0, slots);
}

// ── Its end ──────────────────────────────────────────────────────────────────────

/** `reported 7×`. */
const countWords = (count: number): string => `reported ${String(count)}×`;
const bugWords = (bug: Bug): string => `Omni Loop bug #${String(bug.issue)} (${countWords(bug.count)})`;

/** Why an asked ending sets a bug aside, in the room's words. */
const ASKED_WHY: Readonly<Record<Extract<BugEnd, { end: 'asked' }>['word'], string>> = {
  'need-human': 'its bug fix needs a person',
  'needs-brainstorm': 'it needs a product decision',
  'not-a-bug': 'its bug fix says it may not be a bug',
};

/** What a bug's tries ended on, in order: each of its ended jobs that spent one. */
export function triedOf(jobs: readonly BugJob[], issue: IssueNumber): string[] {
  return jobs
    .filter((one) => one.issue === issue && !atWork(one))
    .sort((a, b) => a.k - b.k)
    .flatMap((one) => {
      const last = lastOf(one);
      const read = last === undefined ? null : bugEndOf(last);
      return read?.end === 'spent' ? [read.word] : [];
    });
}

/** A bug's row and its event once its latest job ended; the event null when nothing is said. */
export type BugAfter = { move: BugMove; event: NewEvent | null };

/** The bug's row as it moves: its state, tries, fix pull request and asked job, `change` over what it holds. */
const moveOf = (bug: Bug, change: Partial<BugMove>): BugMove => ({ state: bug.state, attempts: bug.attempts, fixPr: bug.fixPr, askedJob: bug.askedJob, ...change });

/** An event of the team, on no PRD. */
const said = (kind: NewEvent['kind'], role: NewEvent['role'], job: string, link: string | null, sentence: string): NewEvent => ({ kind, role, prd: null, job, link, sentence });

/** A pull request's link on the Omni Loop repository `repo`. */
const pullLink = (repo: string, pr: PrNumber): string => `https://github.com/${repo}/pull/${String(pr)}`;

/** A try spent: back `open`, or, the last, `asked` saying what was tried (AC-4). */
function spent(bug: Bug, job: BugJob, word: string, { repo, jobs }: { repo: string; jobs: readonly BugJob[] }): BugAfter {
  const attempts = Math.min(BUG_TRIES, bug.attempts + 1);
  const link = issueLink(repo, bug.issue);
  if (attempts < BUG_TRIES) {
    const left = `${String(attempts)} of ${String(BUG_TRIES)} tries spent`;
    return { move: moveOf(bug, { state: 'open', attempts }), event: said('job-ended', 'engineer', job.job, link, `${bugWords(bug)}: its bug fix ended ${word}, ${left}; it goes back in line.`) };
  }
  const tried = triedOf(jobs, bug.issue).slice(-BUG_TRIES);
  const words = tried.length > 0 ? tried.join(', ') : word;
  return { move: moveOf(bug, { state: 'asked', attempts, askedJob: job.job }), event: said('bug-asked', 'supervisor', job.job, link, `${bugWords(bug)} is set aside after ${String(BUG_TRIES)} tries (${words}): it waits for a person.`) };
}

/**
 * A `fixing` bug once its latest job ended (AC-3, AC-4): its next state and tries, and what the room is told. Null while the job is
 * at work. No job at all (its send was lost): back `open`, no try spent.
 */
export function bugAfter(bug: Bug, { repo, jobs }: { repo: string; jobs: readonly BugJob[] }): BugAfter | null {
  const job = latestOf(jobs, bug.issue);
  if (job === undefined) return { move: moveOf(bug, { state: 'open' }), event: null };
  const last = lastOf(job);
  if (last === undefined || atWork(job)) return null;
  const read = bugEndOf(last);
  const link = issueLink(repo, bug.issue);
  switch (read.end) {
    case 'pr-opened':
      return {
        move: moveOf(bug, { state: 'pr-opened', fixPr: read.pr }),
        event: said('job-ended', 'engineer', job.job, read.pr === null ? link : pullLink(repo, read.pr), `${bugWords(bug)}: ${read.pr === null ? 'its fix pull request' : `fix PR #${String(read.pr)}`} is open; it waits for a person's merge.`),
      };
    case 'already-fixed':
      return {
        move: moveOf(bug, { state: 'merged', fixPr: read.pr ?? bug.fixPr }),
        event: said('job-ended', 'engineer', job.job, read.pr === null ? link : pullLink(repo, read.pr), `${bugWords(bug)} is already fixed${read.pr === null ? '' : ` by PR #${String(read.pr)}`}: it waits for its release.`),
      };
    case 'asked':
      return {
        move: moveOf(bug, { state: 'asked', askedJob: job.job }),
        event: said('bug-asked', 'supervisor', job.job, link, `${bugWords(bug)} is set aside: ${ASKED_WHY[read.word]}, and its question waits for a person.`),
      };
    case 'lost':
      return { move: moveOf(bug, { state: 'open' }), event: said('job-ended', 'engineer', job.job, link, `${bugWords(bug)}: its bug fix's runner was lost; it goes back in line, no try spent.`) };
    case 'spent':
      return spent(bug, job, read.word, { repo, jobs });
  }
}

/** What the room is told of a bug taken (AC-1): its job sent, the bug's issue and count, and the try it is. */
export const takenEvent = (bug: Bug, job: string, repo: string): NewEvent =>
  said('bug-taken', 'supervisor', job, issueLink(repo, bug.issue), `Took ${bugWords(bug)}: sent ${bugFixLine(bug.issue)}, try ${String(bug.attempts + 1)} of ${String(BUG_TRIES)}.`);

/** What an `omni-bugs` mission waits on a person for: each bug set aside on its question, most-reported first. */
export function askedWords(bugs: readonly Bug[]): string[] {
  return bugs.filter((bug) => bug.state === 'asked').sort(byCount).map((bug) => `Omni Loop bug #${String(bug.issue)}: answer its question`);
}

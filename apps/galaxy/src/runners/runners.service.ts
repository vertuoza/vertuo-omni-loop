// The runners' rules (PRD 1830 s1; ADR-0095): who may register, claim, report, send, cancel and give a
// runner to a fleet, and what a runner's state is. Plain functions over a repository and a clock, so
// they are tested on realistic rows with a fixed clock (./runners.service.test.ts).
//
// - A runner registers by name, in the workspace its repositories belong to for its owner; a name is
//   its owner's alone.
// - `next` counts as a check-in, then holds up to 40 s for a job the runner may claim (runner_claim()).
// - A runner silent for over 90 s leaves its claimed and running jobs failed, `runner lost`: each
//   `next`, each job update and each read of the Runners page marks them first, before it counts the
//   caller's own check-in, so a runner back from silence finds its jobs lost. A runner that registers
//   again, restarted, finds its claimed and running jobs lost too, however short its silence (#2170).
//   A job still claimed 10 minutes after its claim, never reported running, ends `runner lost` too, at
//   the same marks, though its runner checks in: the answer to its `next` never reached it (#2550).
//   Nothing is retried.
// - A job's status only goes forward: claimed, running, then done, failed or cancelled. A report on a
//   job that has ended is refused, and the runner stops it.
// - Anyone of the workspace sends to any runner, or to a runner with no fleet; only a fleet's players
//   and the workspace's owners send to a fleet, or to a runner in one. The repository is the
//   workspace's (repo_workspace()).
// - The sender or a workspace owner cancels a job: a queued or claimed one at once (a runner that
//   reports on it after is answered 409 and stops it, #2168), a running one at its runner's next
//   report. Only an owner sets a runner's fleet.
// - A job's live lines (PRD 1904): a report's `lines`, numbered from `from`, are stored once each (a
//   report sent twice adds nothing), and a job keeps its last 20,000. When a job ends, the lines of the
//   workspace's ended jobs beyond the 50 most recent (the ones the Runners page lists) are deleted. A
//   member reads them after a sequence number, 5,000 at a time; anyone else is told there is no job.
// - A runner's health (PRD 2102): its owner's runner reports its machine every 15 s. The report, with
//   the server's time, becomes the runner's last health and counts as a check-in; each adds one sample,
//   and the runner's samples older than an hour are deleted. The Runners page reads each runner's last
//   health and its samples of the hour, oldest first. A report's machine tokens of the last 5 h are
//   stored in the sample as the sum of their four counts (`tokens_5h`).
// - A job's tokens (PRD 2102): a job report may carry the tokens of its worktree; they are stored in
//   `runner_jobs.tokens` and the page reads them with the job.
// - A job's released claims (PRD 2175): its last report may carry the sub-PRs its runner released and
//   why a release failed, stored in `runner_jobs.released` and `runner_jobs.release_error`. A job
//   already ended takes one more report carrying only those two, with the status it ended on: its
//   runner releases a lost job's claims after the job ended. Nothing else of the job changes.
// - A job's outcome (PRD 2223): a done job's last report may say what its yolo hand-off ended on
//   (answers, held, ready, or stopped with its slice count, PRD 2375), stored in `runner_jobs.outcome`; a report on another status stores none.
// - A bug fix's end (PRD 2425): a done job's last report may also say how a bug fix ended (pr-opened,
//   already-fixed, needs-brainstorm, not-a-bug, stuck, blocked, or need-human, stored as the `human` the
//   server sets for open questions), the pull request it proved had fixed the bug, and every pull request it
//   opened (also on a failed report, with no outcome). The page and the terminal read those words as Done; a
//   key reads them with its job (`keyJob`): the words of the log, the proved pull request with already-fixed
//   only, the pull requests, the state of its questions, the job it continues and the one that continues it,
//   whom the app acted for, the key that cancelled it, and its log tail.
// - The terminal's reads (PRD 2251): a member of the workspace a repository belongs to reads its
//   runners, and the jobs of that repository whose line names a PRD (its first argument), among the ones
//   the Runners page lists, newest first; anyone else is refused, and another workspace is never read.
// - A job's questions (PRD 2255): a running job asks once, from the owner of its runner; any member of
//   the workspace reads them (a runner's owner or a person). A job reported done with its questions
//   still open stores the outcome `human` (a failed or cancelled one stores none, and neither does one
//   whose questions were closed meanwhile); the runner cannot report it. The first member to answer
//   queues `/omni:<skill> #<issue> --answers <job>` as themselves, to the job's repository and target,
//   checked as Send checks them; runner_job_answer() stores the answers and the resume job in one
//   transaction, so a refused queue stores nothing. A second answer reads `Already answered by <name>`
//   (or `Dismissed by <name>`) and changes nothing; a dismissal closes the row and queues nothing. Only a
//   job that ended `human` is answered or dismissed. The Runners page keeps a job waiting for an answer
//   whatever its age, and reads one whose questions are closed as Done (outcome null): the stored
//   outcome stays `human`.
// - A key's control of its job (PRD 2425 s6, s7): any key of the workspace reads and acts on any key's job,
//   never a person's or another workspace's (both read as no such job). It closes a job's questions as the
//   page does, and cancels it as the page's Cancel does (a queued or claimed job ends at once, a running one
//   is asked to stop), recording the key and whom it acted for. It relaunches a job as the page offers for
//   it: Send again for a failed or cancelled one, Resume for one stopped mid-way. The new job is the
//   first one's key's and maker's, sent to its target, `continues` it, and keeps its notify_url; the job
//   was carried on already when another job continues it, runner_jobs.continues being unique.
// - A key's job runs as the key's GitHub App (PRD 2433 s7): a runner registers `githubApp`, or never takes
//   a job that needs an App. `next` opens the key's sealed private key, finds the App's installation on the
//   job's repository, mints a token and answers the job with it and the App's bot (`github`); every claimed
//   job carries `sentByKey`, the key's name or null. The token is for the job's repository and, for a mega
//   bug fix, the other repositories of its plan repository's product that the installation holds, never one
//   outside the key's allow-list (BR-PRODUCT-63). A mint that fails, or a key that no longer works, ends the
//   job `failed`, `github app: <why>`: the job is never answered without `github`, and never runs as a person.
//   `githubToken` mints a fresh token, for the same repositories, for the job's own runner while the job is
//   claimed or running and for 10 minutes after it ends.
import type { IssueNumber, PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import {
  checkLine, checkLineShape, ENDED_JOBS_SHOWN, GITHUB_TOKEN_AFTER_END_MS, JOB_LINES_KEPT, JOB_LINES_PAGE, JOB_OUTCOMES, linePrd, LOG_TAIL_BYTES, LOG_TAIL_LINES, LOST_AFTER_MS, NEXT_HOLD_MS, SAMPLES_KEPT_MS, STARTING_LOST_AFTER_MS,
  type StoredOutcome, type AnswerRequest, type AskRequest, type Board, type GithubGrant, type GithubTokenReply, type HealthReport, type Job, type JobLines, type JobQuestions, type JobUpdate, type LineCheck, type RegisterReply, type RegisterRequest,
  type Runner, type RunnerJob, type RunnerRefusal, type RunnerSample, type KeyCloser, type KeyJob, type KeySend, type KitRunner, type Notifier, type PingEvent, type PrdJob, type RunnerState, type SendRequest, type Target,
} from './runners.contract';
import type { OutboxStand } from '../dossier/page/stage';
import type { AppCredentials, AppInstallation, MintedToken } from '../public-api/keys/github-app';
import { shouldContinue, unansweredWhy } from './continue';
import type { AppOfJob, ContinuationsRepository, JobPatch, JobRow, JobRowStatus, KeyStart, NewJob, NewRelaunch, QuestionsRefusal, QuestionsRow, RunnerRow, RunnersRepository, SampleRow } from './runners.repository';

/** The time, and a pause: real in production, fixed in tests. */
export type Clock = { now: () => Date; sleep: (ms: number) => Promise<void> };

/** A rule's answer: its value, or why not, in plain words. */
export type Served<T> = { ok: true; value: T } | { ok: false; kind: RunnerRefusal; error: string };

/** What running a key's job as its GitHub App needs beyond the database (PRD 2433 s7): the means to open the key's sealed
 * private key and to ask GitHub, which the live wiring builds (./runners.github.ts) and a test stubs. */
export interface GithubDeps {
  /** The master key a private key is sealed under, or null on a deployment with none (SECRETS_MASTER_KEY unset or malformed). */
  master: () => Buffer | null;
  /** Opens a sealed private key under the master key; throws when it cannot (a key sealed under another master, or garbled). */
  open: (sealed: { ciphertext: string; iv: string }, master: Buffer) => string;
  /** The App's installation on the repository `owner/name`, or null when it is not installed there; throws naming GitHub's status. */
  installation: (credentials: AppCredentials, repo: string) => Promise<AppInstallation | null>;
  /** The first of contents, pull_requests and issues the installation does not hold at write, or null. */
  lacks: (installation: AppInstallation) => string | null;
  /** A token for exactly these repositories (`owner/name`) of the installation; throws naming GitHub's status. */
  mint: (credentials: AppCredentials, installation: AppInstallation, repositories: readonly string[]) => Promise<MintedToken>;
}

/** What asking for a job's GitHub App came to: the job runs as no App, the App's grant, or why no token could be minted
 * (`unreachable` when GitHub could not say, so a later try may mint). The why never holds a key or a token (L-GDPR-2). */
type Minted = { kind: 'none' } | { kind: 'grant'; grant: GithubGrant } | { kind: 'failed'; why: string; unreachable: boolean };

type FailedMint = Extract<Minted, { kind: 'failed' }>;

/** The longest why a failed mint keeps: the job's reason is `github app: <why>`, at most 200 characters in all. */
const MAX_WHY = 150;
const KEY_STOPPED = 'the API key no longer works: it was revoked, or its maker left the workspace';
const APP_REMOVED = 'the GitHub App was removed from the API key';
const outsideKey = (repo: string) => `the API key may not reach ${repo}`;
const NO_MASTER = 'this Omni server has no key to open the App\'s private key';
const CANNOT_OPEN = 'the App\'s private key could not be opened';
const NO_APP = 'This job does not run as a GitHub App.';
const MEGA_BUG_FIX = 'mega-bug-fix';
const TOO_LATE = 'This job ended over 10 minutes ago: it takes no new GitHub token.';

const failedMint = (why: string, unreachable = false): FailedMint => ({ kind: 'failed', why: why.length <= MAX_WHY ? why : `${why.slice(0, MAX_WHY - 1)}…`, unreachable });

/** The App a key holds, as the database reads it for a job. */
type KeyApp = NonNullable<AppOfJob['app']>;

/** The App's private key, opened under the master key, as credentials; the why when this deployment cannot open it. */
function openApp(github: GithubDeps, app: KeyApp): AppCredentials | FailedMint {
  const master = github.master();
  if (master === null) return failedMint(NO_MASTER);
  try {
    return { appId: String(app.app_id), privateKey: github.open(app, master) };
  } catch {
    // The box's own words are about ciphers, never for a person; the key stays out of every answer.
    return failedMint(CANNOT_OPEN);
  }
}

/** The repositories of `wanted` that the App's installation holds: GitHub names the installation of each, and one the App is not installed on,
 * or whose installation is another one (another organisation's), is left out. One GitHub cannot answer for throws. */
async function heldBy(github: GithubDeps, credentials: AppCredentials, installation: AppInstallation, wanted: readonly string[]): Promise<string[]> {
  const answers = await Promise.all(wanted.map(async (repo) => ((await github.installation(credentials, repo))?.id === installation.id ? [repo] : [])));
  return answers.flat();
}

/** A token on the App's installation for the job's repository and the `also` repositories it holds; the why when GitHub gave none
 * (`unreachable` when it threw). The job's repository is the one the job needs: the App missing on it, or lacking a permission there, fails the mint. */
async function mintOn(github: GithubDeps, credentials: AppCredentials, repo: string, also: readonly string[]): Promise<MintedToken | FailedMint> {
  try {
    const installation = await github.installation(credentials, repo);
    if (installation === null) return failedMint(`the App is not installed on ${repo}`);
    const lacks = github.lacks(installation);
    if (lacks !== null) return failedMint(`the App's installation lacks write access to ${lacks}`);
    return await github.mint(credentials, installation, [repo, ...await heldBy(github, credentials, installation, also)]);
  } catch (error) {
    return failedMint(error instanceof Error && error.message !== '' ? error.message.split('\n')[0] ?? '' : 'GitHub gave no reason', true);
  }
}

/** Whether a runner's line is a mega bug fix's, which also works on the other repositories of its plan repository's product. */
function isMegaBugFix(line: string): boolean {
  const check = checkLineShape(line);
  return check.ok && check.kind === 'omni' && check.skill === MEGA_BUG_FIX;
}

/** Whether the key's allow-list lets it reach `repo`: an empty list is every repository of its workspace. */
const allows = (allowed: readonly string[], repo: string): boolean => allowed.length === 0 || allowed.includes(repo);

/** The repositories besides the job's own that its token should reach: for a mega bug fix, the other repositories of its product
 * that the key's allow-list names (or all of them, with no list). Which of them the installation holds is for GitHub to say. */
function alsoFor(job: Pick<JobRow, 'line' | 'repo'>, read: Pick<AppOfJob, 'repos' | 'product_repos'>): string[] {
  if (!isMegaBugFix(job.line)) return [];
  return [...new Set(read.product_repos)].filter((repo) => repo !== job.repo && allows(read.repos, repo));
}

/** What a minted token reaches a runner as: the token beside the App's bot, who the job's commits read as. */
const grantOf = (app: KeyApp, minted: MintedToken): GithubGrant => ({
  token: minted.token, expiresAt: minted.expiresAt, login: `${app.slug}[bot]`, email: `${String(app.bot_id)}+${app.slug}[bot]@users.noreply.github.com`,
});

/** Who sends: whether they own the workspace, and their fleet. */
type Sender = { owner: boolean; fleet: string | null };

/** Where a job goes: one runner, a fleet, or neither (any runner). */
type Addressed = { toRunner: string | null; toFleet: string | null };

/** How often a held `next` looks for a job again. */
export const NEXT_POLL_MS = 2_000;

const ok = <T>(value: T): Served<T> => ({ ok: true, value });
const no = (kind: RunnerRefusal, error: string): Served<never> => ({ ok: false, kind, error });

const ACTIVE: readonly JobRowStatus[] = ['claimed', 'running'];
const ENDED: readonly JobRowStatus[] = ['done', 'failed', 'cancelled'];

/** Where a status stands in a job's life: a report never goes back. */
const STEP: Record<JobRowStatus, number> = { queued: 0, claimed: 1, running: 2, done: 3, failed: 3, cancelled: 3 };

/** The last 200 lines of a log, and at most its last 16 KB. */
export function cutLogTail(text: string): string {
  const lines = text.split('\n').slice(-LOG_TAIL_LINES).join('\n');
  const bytes = new TextEncoder().encode(lines);
  if (bytes.length <= LOG_TAIL_BYTES) return lines;
  // Cut on a character's first byte, so no character is split.
  let start = bytes.length - LOG_TAIL_BYTES;
  while (start < bytes.length && ((bytes[start] ?? 0) & 0xc0) === 0x80) start += 1;
  return new TextDecoder().decode(bytes.slice(start));
}

/** A runner's state at `now`: offline after 90 s of silence, busy when every slot holds a job. */
export function runnerState(runner: Pick<RunnerRow, 'last_seen_at' | 'slots'>, used: number, now: Date): RunnerState {
  if (now.getTime() - Date.parse(runner.last_seen_at) > LOST_AFTER_MS) return 'offline';
  return used >= runner.slots ? 'busy' : 'online';
}

/** The API key that sends: its id and name, its workspace, and the member who made it (the sender of record). */
type KeySender = { id: string; name: string; workspace: string; maker: string };

/** A job a key sent, whichever key (PRD 2425): its row, with the key that sent it. */
type KeyedJob = JobRow & { sent_by_key: string };

/** What a relaunch carries on (PRD 2425 s7): the job it continues, whom the key acted for and the link to ping. */
type Thread = Pick<NewRelaunch, 'continues' | 'actingFor' | 'notifyUrl'>;

/** Who a runner's job reads as sent by: `@login`, `API key <name> (@login)` for a key's (PRD 2022), or `Omni app`
 * for a job the app sent (PRD 2338). */
const senderOf = (login: string | null, keyName: string | null, app: string | null = null): string | null =>
  app !== null ? 'Omni app' : keyName === null ? login : login ? `API key ${keyName} (@${login})` : `API key ${keyName}`;

/** The people who sent these jobs: an app-sent job has none. */
const sendersOf = (jobs: readonly Pick<JobRow, 'sent_by'>[]): string[] => [...new Set(jobs.flatMap((job) => (job.sent_by === null ? [] : [job.sent_by])))];

/** Who sent a job, as the browser reads it: a person, the key they made, or the Omni app (PRD 2338). */
function senderFields(row: JobRow, logins: Map<string, string>, keys: Map<string, string>): Pick<Job, 'sentBy' | 'sentByLogin' | 'sentByApp' | 'sentByKey'> {
  return {
    sentBy: row.sent_by, sentByLogin: row.sent_by === null ? null : logins.get(row.sent_by) ?? null, sentByApp: row.sent_by_app,
    sentByKey: row.sent_by_key === null ? null : keys.get(row.sent_by_key) ?? null,
  };
}

/** What the page and the terminal read of a stored outcome: the yolo hand-off's words and `human`; a bug fix's own end
 * reads as none, which the page shows as Done, as it did before PRD 2425. */
const isPageOutcome = (outcome: StoredOutcome): outcome is NonNullable<Job['outcome']> => JOB_OUTCOMES.some((word) => word === outcome);
const pageOutcome = (outcome: StoredOutcome | null | undefined): NonNullable<Job['outcome']> | null => (outcome && isPageOutcome(outcome) ? outcome : null);

/** What the page reads of a key's part in a job (PRD 2425): whom the key said it acted for, and the key that cancelled it, by its name. */
function keyActionFields(row: JobRow, keys: Map<string, string>): Pick<Job, 'actingFor' | 'cancelledByKey'> {
  return { actingFor: row.acting_for ?? null, cancelledByKey: row.cancelled_by_key ? keys.get(row.cancelled_by_key) ?? null : null };
}

function jobOf(row: JobRow, logins: Map<string, string>, keys: Map<string, string> = new Map()): Job {
  return {
    id: row.id, line: row.line, repo: row.repo, toRunner: row.to_runner, toFleet: row.to_fleet, ...senderFields(row, logins, keys), ...keyActionFields(row, keys),
    status: row.status, runner: row.runner_id, cancelRequested: row.cancel_requested,
    logTail: row.log_tail, prUrl: row.pr_url, exitCode: row.exit_code, reason: row.reason, tokens: row.tokens ?? null,
    released: row.released ?? null, releaseError: row.release_error ?? null, outcome: pageOutcome(row.outcome), slicesMerged: row.slices_merged ?? null, slicesTotal: row.slices_total ?? null, continues: row.continues ?? null, queuedAt: row.queued_at,
    claimedAt: row.claimed_at, runningAt: row.running_at, endedAt: row.ended_at,
  };
}

function runnerOf(row: RunnerRow, used: number, now: Date, samples?: RunnerSample[]): Runner {
  return {
    id: row.id, name: row.name, owner: row.owner, fleet: row.fleet, slots: row.slots, used, repos: row.repos, version: row.version,
    lastSeenAt: row.last_seen_at, state: runnerState(row, used, now), health: row.health, ...(samples ? { samples } : {}),
  };
}

/** A token count's four figures added up; null for a count the runner could not read or never sent. */
const tokenSum = (counts: { input: number; output: number; cacheRead: number; cacheWrite: number } | null | undefined): number | null =>
  counts ? counts.input + counts.output + counts.cacheRead + counts.cacheWrite : null;

const sampleOf = (row: SampleRow): RunnerSample => ({
  at: row.at, cpu: row.cpu, memUsed: row.mem_used, memTotal: row.mem_total, diskFree: row.disk_free, tokens5h: row.tokens_5h,
});

/** The samples of each runner, oldest first as they are read. */
function samplesByRunner(rows: SampleRow[]): Map<string, RunnerSample[]> {
  const byRunner = new Map<string, RunnerSample[]>();
  for (const row of rows) {
    const held = byRunner.get(row.runner_id);
    if (held) held.push(sampleOf(row));
    else byRunner.set(row.runner_id, [sampleOf(row)]);
  }
  return byRunner;
}

/** Whether a sender may use a fleet's runners: one of its players, or a workspace owner. */
const inFleet = (sender: Sender, fleet: string) => sender.owner || sender.fleet === fleet;

/** A job's ending in words: its status, and its reason when it has one. */
const endedWords = (job: JobRow) => (job.reason ? `${job.status}, ${job.reason}` : job.status);

/** The fields a report on an ended job may carry: its status, and what its runner released (PRD 2175). */
const RELEASE_ONLY: ReadonlySet<string> = new Set(['status', 'released', 'releaseError']);

/** Whether `report` only says what the runner released for a job that has ended on that status. */
const releaseOnly = (job: JobRow, report: JobUpdate): boolean =>
  ENDED.includes(job.status) && report.status === job.status && (report.released !== undefined || report.releaseError !== undefined)
  && Object.keys(report).every((key) => RELEASE_ONLY.has(key));

/** The columns a release-only report writes. */
function releasePatch(report: JobUpdate): JobPatch {
  return Object.fromEntries(Object.entries({ released: report.released, release_error: report.releaseError }).filter(([, column]) => column !== undefined));
}

/** Why this report cannot be taken on the job as it stands, or null. */
function reportRefusal(job: JobRow, report: JobUpdate): Served<never> | null {
  if (ENDED.includes(job.status)) return no('conflict', `This job has ended: ${endedWords(job)}. Stop it.`);
  if (STEP[report.status] < STEP[job.status]) return no('conflict', `This job is ${job.status} already: it cannot go back to ${report.status}.`);
  return null;
}

/** The word a report's outcome is stored as: a bug fix's `need-human` is the `human` the server sets for open questions (PRD 2425). */
const storedOutcome = (word: JobUpdate['outcome']): JobPatch['outcome'] => (word === 'need-human' ? 'human' : word);

/** The columns only a done report writes: its outcome (PRD 2223), the proved pull request (PRD 2425), the follow-ups it saw
 * and left alone (PRD 2508) and the slice count of a stopped job (PRD 2375). A failed or cancelled report's are never stored. */
function doneColumns(report: JobUpdate): JobPatch {
  if (report.status !== 'done') return {};
  return {
    outcome: storedOutcome(report.outcome), fixed_by: report.fixedBy, follow_ups: report.followUps,
    slices_merged: report.slicesMerged, slices_total: report.slicesTotal,
  };
}

/** The columns a report writes: its status, what it carries, and the time it starts or ends the run. */
function reportPatch(job: JobRow, report: JobUpdate, now: string): JobPatch {
  const carried = {
    log_tail: report.logTail === undefined ? undefined : cutLogTail(report.logTail),
    pr_url: report.prUrl, exit_code: report.exitCode, reason: report.reason, tokens: report.tokens,
    released: report.released, release_error: report.releaseError,
    // The pull requests it opened are stored whatever its end, a failed run's draft first (PRD 2425).
    prs: report.prs,
    ...doneColumns(report),
  };
  const given: JobPatch = Object.fromEntries(Object.entries(carried).filter(([, column]) => column !== undefined));
  const starts = report.status === 'running' && job.running_at === null;
  return { ...given, status: report.status, ...(starts ? { running_at: now } : {}), ...(ENDED.includes(report.status) ? { ended_at: now } : {}) };
}

/** A bug fix's words in its log, by the outcome stored for them (PRD 2425): `human` is `need-human`. */
const LOG_WORDS: Partial<Record<StoredOutcome, NonNullable<KeyJob['outcome']>>> = {
  human: 'need-human', 'pr-opened': 'pr-opened', 'already-fixed': 'already-fixed', 'needs-brainstorm': 'needs-brainstorm',
  'not-a-bug': 'not-a-bug', stuck: 'stuck', blocked: 'blocked',
};

/** How a done bug fix ended, in the words of its log: none while it runs, when it failed, when its runner reported none
 * and for a yolo hand-off's word (PRD 2425). */
const keyOutcome = (row: JobRow): KeyJob['outcome'] => (row.status === 'done' && row.outcome ? LOG_WORDS[row.outcome] ?? null : null);

/** Whether a job's questions are open, answered or dismissed. */
const questionsState = (row: QuestionsRow): JobQuestions['state'] => (row.closed_at === null ? 'open' : row.answers === null ? 'dismissed' : 'answered');

/** What a key reads of a job besides its row (PRD 2425): the runner's name, the questions it asked, the job that
 * carries it on and the names of the keys the row names. */
type KeyJobReads = { runner: string | null; questions: QuestionsRow | null; continuedBy: string | null; keys: Map<string, string> };

/** What a key reads of what a bug fix did (PRD 2425): how it ended, the pull request it proved had fixed the bug (with
 * already-fixed only), the pull requests it opened, its questions' state and its log tail. */
function keyDidOf(row: JobRow, questions: QuestionsRow | null): Pick<KeyJob, 'outcome' | 'fixedBy' | 'prs' | 'followUps' | 'questions' | 'logTail'> {
  const outcome = keyOutcome(row);
  return {
    outcome, fixedBy: outcome === 'already-fixed' ? row.fixed_by ?? null : null, prs: row.prs ?? [], followUps: row.follow_ups ?? [],
    questions: questions && questionsState(questions), logTail: row.log_tail === '' ? null : row.log_tail,
  };
}

/** Who a key's job belongs to besides the sender (PRD 2425): the job it carries on and the one that carries it on, whom the
 * app acted for, and the key that cancelled it, by its name, with whom it acted for. */
function keyThreadOf(row: JobRow, reads: KeyJobReads): Pick<KeyJob, 'continues' | 'continuedBy' | 'actingFor' | 'cancelledBy'> {
  const cancelling = row.cancelled_by_key;
  return {
    continues: row.continues ?? null, continuedBy: reads.continuedBy, actingFor: row.acting_for ?? null,
    cancelledBy: cancelling ? { key: reads.keys.get(cancelling) ?? 'unknown key', actingFor: row.cancelled_for ?? null } : null,
  };
}

function keyJobOf(row: JobRow, reads: KeyJobReads): KeyJob {
  return {
    id: row.id, line: row.line, repo: row.repo, status: row.status, runner: reads.runner, prUrl: row.pr_url, exitCode: row.exit_code,
    reason: row.reason, queuedAt: row.queued_at, claimedAt: row.claimed_at, runningAt: row.running_at, endedAt: row.ended_at,
    ...keyDidOf(row, reads.questions), ...keyThreadOf(row, reads),
  };
}

/** A runner as the terminal reads it (PRD 2251). */
const kitRunnerOf = (row: RunnerRow, used: number, now: Date): KitRunner => ({
  id: row.id, name: row.name, fleet: row.fleet, state: runnerState(row, used, now), used, slots: row.slots, repos: row.repos,
});

/** A PRD's job as the terminal follows it (PRD 2251): its runner by name. */
const prdJobOf = (row: JobRow, runnerName: string | null): PrdJob => ({
  id: row.id, line: row.line, repo: row.repo, status: row.status, runner: runnerName, prUrl: row.pr_url, exitCode: row.exit_code, reason: row.reason,
  outcome: pageOutcome(row.outcome), queuedAt: row.queued_at, claimedAt: row.claimed_at, runningAt: row.running_at, endedAt: row.ended_at,
});

const usedBy = (jobs: JobRow[], runnerId: string) => jobs.filter((job) => job.runner_id === runnerId && ACTIVE.includes(job.status)).length;

/** What the target rules read: the workspace's fleets and its runners. */
type TargetStore = Pick<RunnersRepository, 'fleetExists' | 'runner'>;

async function mayFleet(store: TargetStore, workspaceId: string, sender: Sender, fleet: string): Promise<Served<Addressed>> {
  if (!(await store.fleetExists(workspaceId, fleet))) return no('missing', `No fleet ${fleet} in this workspace.`);
  if (!inFleet(sender, fleet)) return no('forbidden', `Only the players of ${fleet} and the workspace's owners send to its runners.`);
  return ok({ toRunner: null, toFleet: fleet });
}

async function mayRunner(store: TargetStore, workspaceId: string, sender: Sender, runnerId: string): Promise<Served<Addressed>> {
  const runner = await store.runner(runnerId);
  if (runner?.workspace_id !== workspaceId) return no('missing', 'No such runner in this workspace.');
  if (runner.fleet !== null && !inFleet(sender, runner.fleet)) {
    return no('forbidden', `${runner.name} serves ${runner.fleet}: only its players and the workspace's owners send to it.`);
  }
  return ok({ toRunner: runner.id, toFleet: null });
}

/** Whether a person of the workspace may send to this target, or why not. */
async function mayTarget(store: TargetStore, workspaceId: string, sender: Sender, target: Target): Promise<Served<Addressed>> {
  if (target.kind === 'any') return ok({ toRunner: null, toFleet: null });
  return target.kind === 'fleet' ? mayFleet(store, workspaceId, sender, target.fleet) : mayRunner(store, workspaceId, sender, target.runner);
}

/** What the page and the routes read of a job's questions (PRD 2255): open until someone closed them,
 * answered when they left answers, dismissed when they did not; who closed them by id and login. */
function questionsView(row: QuestionsRow, logins: Map<string, string>, keys: Map<string, string> = new Map()): JobQuestions {
  return {
    job: row.job_id, issue: row.issue, lead: row.lead, questions: row.questions,
    state: questionsState(row),
    answers: row.answers, by: row.closed_by, byLogin: row.closed_by === null ? null : logins.get(row.closed_by) ?? null,
    byKey: row.closed_by_key ? keys.get(row.closed_by_key) ?? null : null, actingFor: row.closed_for ?? null,
    at: row.closed_at, resume: row.resume_job,
  };
}

/** The line that resumes a job's run with its answers: the same one runner_job_answer() queues. */
const resumeLine = (skill: string, issue: IssueNumber, job: string) => `/omni:${skill} #${String(issue)} --answers ${job}`;

/** Where the first job went, as a person's Send names it: its runner, its fleet, or any runner. */
const targetOf = (job: JobRow): Target => {
  if (job.to_runner !== null) return { kind: 'runner', runner: job.to_runner };
  return job.to_fleet === null ? { kind: 'any' } : { kind: 'fleet', fleet: job.to_fleet };
};

/** The line that resumes the job, checked as Send checks it; a repository's own skill (PRD 2313) is never resumed. */
function resumeOf(firstLine: string, issue: IssueNumber, jobId: string): Served<null> {
  const first = checkLineShape(firstLine);
  if (!first.ok) return no('malformed', first.reason);
  if (first.kind === 'repository') return no('malformed', `/${first.skill} is a repository's own skill: its questions can only be dismissed.`);
  const line = checkLine(resumeLine(first.skill, issue, jobId));
  return line.ok ? ok(null) : no('malformed', line.reason);
}

const NOT_OFFERED = 'This job is neither failed, cancelled nor stopped mid-way: the Runners page offers neither Send again nor Resume for it.';
const CARRIED_ON = 'This job was carried on already.';

/** Whether the Runners page offers Send again (a failed or cancelled job) or Resume (one stopped mid-way) for a job: what a key relaunches (PRD 2425 s7). */
const relaunchable = (job: Pick<JobRow, 'status' | 'outcome'>): boolean =>
  job.status === 'failed' || job.status === 'cancelled' || (job.status === 'done' && job.outcome === 'stopped');

/** The notifier of a service built without one (PRD 2425 s8): it refuses every link, so none is ever taken that no ping could reach, and pings nothing. */
const NO_NOTIFIER: Notifier = { check: () => Promise.resolve('cannot be pinged by this server'), ping: () => undefined };

/** What a change of a job's stored state tells its link, if anything (PRD 2425 s8): one ping for a change, `outcome` when the job ended
 * with one (a bug fix's end, Need human included) and `status` for every other move; a change of neither is no ping. */
function eventOf(before: Pick<JobRow, 'status' | 'outcome'>, after: Pick<JobRow, 'status' | 'outcome'>): PingEvent | null {
  if (before.status !== after.status) return (after.outcome ?? null) === null ? 'status' : 'outcome';
  return (before.outcome ?? null) === (after.outcome ?? null) ? null : 'outcome';
}

const NOT_WAITING = 'This job is not waiting for an answer.';
const NO_QUESTION = 'This job asked no question.';
const EACH_ANSWERED = 'Answer each question once, and only the ones asked.';

/** Whether the answers are one to each question asked, and nothing else. */
const answersEach = (row: Pick<QuestionsRow, 'questions'>, answers: Record<string, string>): boolean => {
  const asked = row.questions.map((question) => question.question);
  return Object.keys(answers).length === asked.length && asked.every((text) => Object.hasOwn(answers, text));
};

/** `github` is the deployment's means to open a key's App and mint its token (PRD 2433); with none, a job that needs an App fails when claimed.
 * `notifier` pings the link of a job a key sent when its status, outcome or questions change (PRD 2425 s8); with none, no link is taken. */
export function runnersService(store: RunnersRepository, clock: Clock, github: GithubDeps | null = null, notifier: Notifier = NO_NOTIFIER) {
  const iso = () => clock.now().toISOString();
  const ago = (ms: number) => new Date(clock.now().getTime() - ms).toISOString();

  /** Tells the job's link that its status, outcome or questions changed (PRD 2425 s8), once the change is stored; a job with no link tells
   * none. The notifier answers after the response and never throws, so a ping never changes what a request answers. */
  const tell = (job: Pick<JobRow, 'id' | 'notify_url'>, event: PingEvent): void => {
    if (job.notify_url) notifier.ping({ url: job.notify_url, jobId: job.id, event, at: iso() });
  };
  /** Tells the link of a job the change that took it from `before` to `after`, when it is one. */
  const tellChange = (before: JobRow, after: JobRow): void => {
    const event = eventOf(before, after);
    if (event !== null) tell(after, event);
  };
  /** Ends `runner lost` a silent runner's jobs (the database, telling none) and every job still Starting past its deadline, whose
   * runner never received it (#2550): each of those tells its link, as this process ends it. */
  const markLost = async (): Promise<void> => {
    const [, unstarted] = await Promise.all([store.markLost(ago(LOST_AFTER_MS)), store.loseUnstarted(ago(STARTING_LOST_AFTER_MS), iso())]);
    for (const job of unstarted) tell(job, 'status');
  };

  /** The runner the caller owns, or why not. */
  async function ownRunner(caller: string, runnerId: string): Promise<Served<RunnerRow>> {
    const runner = await store.runner(runnerId);
    if (!runner) return no('missing', 'No such runner. Register it again.');
    if (runner.owner !== caller) return no('forbidden', 'This runner was registered by someone else.');
    return ok(runner);
  }

  /** The one workspace all the repositories belong to for the caller, or why not. */
  async function workspaceOf(caller: string, repos: string[]): Promise<Served<string>> {
    let workspaceId: string | null = null;
    for (const repo of repos) {
      const placed = await store.place(caller, repo);
      if (!placed.workspaceId) return no('forbidden', `${repo} is not in your workspace: ${placed.refusal ?? 'no workspace of yours owns it'}.`);
      if (workspaceId !== null && placed.workspaceId !== workspaceId) return no('forbidden', `${repo} belongs to another workspace than ${repos[0] ?? ''}: a runner serves one workspace.`);
      workspaceId = placed.workspaceId;
    }
    return workspaceId === null ? no('malformed', 'A runner holds at least one repository.') : ok(workspaceId);
  }

  /** The names of the API keys that sent these jobs. */
  const keysOf = (workspaceId: string, jobs: JobRow[]) =>
    store.keyNames(workspaceId, [...new Set(jobs.flatMap((job) => [job.sent_by_key, job.cancelled_by_key]).filter((id): id is string => typeof id === 'string'))]);

  /** The name of the runner that holds the job, or null. */
  async function runnerNameOf(job: JobRow): Promise<string | null> {
    return job.runner_id === null ? null : (await store.runner(job.runner_id))?.name ?? null;
  }

  /** Whether the repository allows the skill a repository's own line names (PRD 2313); a fixed skill's line needs no allowance. */
  async function allowance(workspaceId: string, repo: string, line: LineCheck & { ok: true }): Promise<Served<null>> {
    if (line.kind === 'omni') return ok(null);
    if ((await store.allowedSkills(workspaceId, repo)).includes(line.skill)) return ok(null);
    return no('malformed', `/${line.skill} is not allowed on a runner for ${repo}: an owner allows it in Settings › Repositories.`);
  }

  /** Queues the job as `caller`, a member of the workspace the repository belongs to; for a key, that must be the key's.
   * The line's shape is checked first; a repository's own skill, once the repository is placed, against what its owner allowed.
   * A relaunch (PRD 2425 s7) names the `thread` it carries on: the job it continues, which no other job may continue. A key's start
   * (PRD 2425 s8) says whom it acts for and the link to ping, which the job stores as given. */
  async function queue(
    caller: string, request: SendRequest, key: Pick<KeySender, 'id' | 'workspace'> | null, thread: Thread | null = null, start: KeyStart = {},
  ): Promise<Served<JobRow>> {
    const line = checkLineShape(request.line);
    if (!line.ok) return no('malformed', line.reason);
    const repo = request.repo.toLowerCase();
    const placed = await senderIn(caller, repo, key?.workspace ?? null);
    if (!placed.ok) return placed;
    const { workspaceId, sender } = placed.value;
    const allowed = await allowance(workspaceId, repo, line);
    if (!allowed.ok) return allowed;
    const target = await mayTarget(store, workspaceId, sender, request.target);
    if (!target.ok) return target;
    return insert({ workspaceId, line: request.line, repo, ...target.value, sentBy: caller, sentByKey: key?.id ?? null, ...start }, thread);
  }

  /** Stores a queued job: a new one, or, with a `thread`, one that carries a job on, which another job may already (runner_jobs.continues is unique). */
  async function insert(job: NewJob & KeyStart, thread: Thread | null): Promise<Served<JobRow>> {
    if (thread === null) return ok(await store.insertJob(job));
    const relaunched = await store.insertRelaunch({ ...job, ...thread });
    return relaunched ? ok(relaunched) : no('conflict', CARRIED_ON);
  }

  /** The workspace the repository belongs to for the person, which must be `only` when that is given, and their place in it. */
  async function senderIn(caller: string, repo: string, only: string | null): Promise<Served<{ workspaceId: string; sender: Sender }>> {
    const placed = await placement(caller, repo, only);
    if (!placed.ok) return placed;
    const sender = await store.member(placed.value, caller);
    return sender ? ok({ workspaceId: placed.value, sender }) : no('forbidden', `${repo} is not in your workspace.`);
  }

  /** The workspace the repository belongs to for the person, which must be `only` when that is given. */
  async function placement(caller: string, repo: string, only: string | null): Promise<Served<string>> {
    const placed = await store.place(caller, repo);
    if (!placed.workspaceId || (only !== null && placed.workspaceId !== only)) {
      return no('forbidden', `${repo} is not in your workspace${placed.refusal ? `: ${placed.refusal}` : ''}.`);
    }
    return ok(placed.workspaceId);
  }

  /** The workspace the repository belongs to for the caller, who must be one of its members; why not otherwise. */
  async function memberPlacement(caller: string, repo: string): Promise<Served<string>> {
    const placed = await placement(caller, repo, null);
    if (!placed.ok) return placed;
    return (await store.member(placed.value, caller)) ? placed : no('forbidden', `${repo} is not in your workspace.`);
  }

  /** Stores the report's lines once each, then keeps the job's last 20,000. */
  async function appendLines(job: JobRow, report: JobUpdate): Promise<void> {
    const { from, lines } = report;
    if (from === undefined || lines === undefined || lines.length === 0) return;
    await store.appendLines(lines.map((text, i) => ({ job_id: job.id, workspace_id: job.workspace_id, seq: from + i, text })));
    const last = from + lines.length - 1;
    if (last > JOB_LINES_KEPT) await store.trimLines(job.id, last - JOB_LINES_KEPT);
  }

  /** After a job ends: the lines of the workspace's ended jobs beyond the 50 the Runners page lists go. */
  const retainLines = (job: JobRow) => (ENDED.includes(job.status) ? store.retainLines(job.workspace_id, ENDED_JOBS_SHOWN) : Promise.resolve(0));

  /** The job's runner, when the caller owns it; why not otherwise. */
  async function reporting(caller: string, jobId: string): Promise<Served<string>> {
    const found = await store.job(jobId);
    if (!found) return no('missing', 'No such job.');
    const owned = found.runner_id ? await ownRunner(caller, found.runner_id) : null;
    return owned?.ok ? ok(owned.value.id) : no('forbidden', 'This job was claimed by none of your runners.');
  }

  /**
   * The GitHub App the job runs as, with a token minted for it now (PRD 2433): a job no key sent, or a key that holds no
   * App and never did, runs as none. A job queued while its key held an App runs as that App or not at all, so a key
   * revoked or whose maker left, an App removed, an uninstalled one, a deployment with no master key, or a GitHub that
   * refuses each fail it, never run it as anyone else. The token is for the job's repository and, for a mega bug fix, the other
   * repositories of its product that the installation holds, each within the key's allow-list: a job whose own repository the
   * key may not reach fails, and the others are never even asked of GitHub (BR-PRODUCT-63). A mint is recorded for the key's `last token`.
   */
  async function mintFor(job: Pick<JobRow, 'id' | 'repo' | 'line'>): Promise<Minted> {
    const read = await store.appOfJob(job.id);
    if (read === null || !read.needs_app) return { kind: 'none' };
    if (!read.working) return failedMint(KEY_STOPPED);
    if (read.app === null) return failedMint(APP_REMOVED);
    if (!allows(read.repos, job.repo)) return failedMint(outsideKey(job.repo));
    if (github === null) return failedMint(NO_MASTER);
    const credentials = openApp(github, read.app);
    if ('kind' in credentials) return credentials;
    const minted = await mintOn(github, credentials, job.repo, alsoFor(job, read));
    if ('kind' in minted) return minted;
    await recordMint(read.key_id);
    return { kind: 'grant', grant: grantOf(read.app, minted) };
  }

  /**
   * The answer to a runner that claimed `job`, or null when the job ended failed instead. A key's job that runs as its App
   * takes its token now (PRD 2433); one whose App cannot mint ends failed and is never answered without `github`.
   */
  async function replyTo(job: JobRow): Promise<RunnerJob | null> {
    const minted = job.sent_by_key === null ? { kind: 'none' as const } : await mintFor(job);
    if (minted.kind === 'failed') {
      const failed = await store.updateJob(job.id, ACTIVE, { status: 'failed', reason: `github app: ${minted.why}`, ended_at: iso() });
      // The job ended here: its link is told, as when a runner reports its end (PRD 2425 s8).
      if (failed !== null) tellChange(job, failed);
      return null;
    }
    const logins = await store.logins(job.workspace_id, sendersOf([job]));
    const keyName = job.sent_by_key === null ? null : (await store.keyNames(job.workspace_id, [job.sent_by_key])).get(job.sent_by_key) ?? null;
    // Read at claim (PRD 2313): a skill turned off while its job waited is absent, and the runner refuses it.
    const allowedSkills = await store.allowedSkills(job.workspace_id, job.repo);
    return {
      id: job.id, line: job.line, repo: job.repo, sentBy: senderOf(job.sent_by === null ? null : logins.get(job.sent_by) ?? null, keyName, job.sent_by_app), allowedSkills,
      sentByKey: keyName, github: minted.kind === 'grant' ? minted.grant : null,
    };
  }

  /** The key's `last token` label in Settings: a mint that could not be recorded is still a mint, and the job runs. */
  async function recordMint(keyId: string): Promise<void> {
    try {
      await store.appMinted(keyId);
    } catch {
      // Left unrecorded: nothing the runner needs hangs on it.
    }
  }

  /** Ends the claimed and running jobs of a runner registering again as `runner lost`: a runner that
   * registers has just started, so it holds none of them (#2170). Each one that ends here tells its link (PRD 2425 s8); the ones the
   * database ends alone, a silent runner's (markLost), tell none: nothing in this process makes that change. */
  async function loseJobsOf(runner: RunnerRow): Promise<void> {
    const held = (await store.activeJobs(runner.workspace_id)).filter((job) => job.runner_id === runner.id && ACTIVE.includes(job.status));
    for (const job of held) {
      const lost = await store.updateJob(job.id, ACTIVE, { status: 'failed', reason: 'runner lost', ended_at: iso() });
      // A claimed or running job always moves to failed here, with no outcome: a status ping.
      if (lost) tell(lost, 'status');
    }
  }

  /** Nothing, when the caller sent the job or owns its workspace; why not otherwise. */
  async function cancelling(caller: string, jobId: string): Promise<Served<null>> {
    const found = await store.job(jobId);
    const member = found ? await store.member(found.workspace_id, caller) : null;
    if (!found || !member) return no('missing', 'No such job.');
    return found.sent_by === caller || member.owner ? ok(null) : no('forbidden', 'Only its sender or a workspace owner cancels a job.');
  }

  /** Why closed questions refuse another answer, in words: who answered, or dismissed, them: a person by their login, an API
   * key by its name (PRD 2425), the words the Runners page's drawer reads. */
  async function closedWords(row: QuestionsRow): Promise<string> {
    const verb = row.answers === null ? 'Dismissed' : 'Already answered';
    if (row.closed_by_key) return `${verb} by API key ${(await store.keyNames(row.workspace_id, [row.closed_by_key])).get(row.closed_by_key) ?? 'unknown key'}`;
    const login = row.closed_by === null ? undefined : (await store.logins(row.workspace_id, [row.closed_by])).get(row.closed_by);
    return `${verb} by ${login === undefined ? 'someone' : `@${login}`}`;
  }

  /** What the page and the routes read of a round: who closed it by login or key name, and whom a key acted for. */
  async function viewOf(row: QuestionsRow): Promise<JobQuestions> {
    const [logins, keys] = await Promise.all([
      store.logins(row.workspace_id, row.closed_by === null ? [] : [row.closed_by]),
      store.keyNames(row.workspace_id, row.closed_by_key ? [row.closed_by_key] : []),
    ]);
    return questionsView(row, logins, keys);
  }

  /** A job's questions as a member of its workspace sees them: the job, its row and the member. Why not,
   * in words: a job nobody sees, or one that asked none. */
  async function questionsFor(caller: string, jobId: string): Promise<Served<{ job: JobRow; row: QuestionsRow; member: Sender }>> {
    const job = await store.job(jobId);
    const member = job ? await store.member(job.workspace_id, caller) : null;
    if (!job || !member) return no('missing', 'No such job.');
    const row = await store.questionsOf(jobId);
    return row ? ok({ job, row, member }) : no('missing', NO_QUESTION);
  }

  /** The questions a member may answer or dismiss: the job is theirs to see, it asked, they are still open and
   * the job ended with them open. Why not otherwise, in words. */
  async function waitingFor(caller: string, jobId: string): Promise<Served<{ job: JobRow; row: QuestionsRow; member: Sender }>> {
    const found = await questionsFor(caller, jobId);
    return found.ok ? stillWaiting(found.value) : found;
  }

  /** The questions as they are, when they are still open and the job ended with them open; why not otherwise, in words. */
  async function stillWaiting<T extends { job: JobRow; row: QuestionsRow }>(found: T): Promise<Served<T>> {
    if (found.row.closed_at !== null) return no('conflict', await closedWords(found.row));
    return found.job.outcome === 'human' ? ok(found) : no('conflict', NOT_WAITING);
  }

  /** A job a key of the workspace sent, whichever key (PRD 2425): its row. A job nobody sees reads the same for a person's,
   * another workspace's and one that does not exist, so a key learns nothing of them. */
  async function keyJobRow(workspaceId: string, jobId: string): Promise<Served<KeyedJob>> {
    const job = await store.job(jobId);
    return job?.workspace_id === workspaceId && job.sent_by_key !== null ? ok({ ...job, sent_by_key: job.sent_by_key }) : no('missing', 'No such job.');
  }

  /** The questions of a job a key of the workspace sent (PRD 2425 s6): the job and its row; one that asked none says so. */
  async function questionsOfKeyJob(workspaceId: string, jobId: string): Promise<Served<{ job: JobRow; row: QuestionsRow }>> {
    const found = await keyJobRow(workspaceId, jobId);
    if (!found.ok) return found;
    const row = await store.questionsOf(jobId);
    return row ? ok({ job: found.value, row }) : no('missing', NO_QUESTION);
  }

  /** The questions of a job a key sent when they are still open and the job ended with them open: what a key may close. */
  async function stillWaitingOnKey(workspaceId: string, jobId: string): Promise<Served<{ job: JobRow; row: QuestionsRow }>> {
    const found = await questionsOfKeyJob(workspaceId, jobId);
    return found.ok ? stillWaiting(found.value) : found;
  }

  /** The resume or relaunch of a key's job is queued as that job's sender, the key's maker, as Send checks them (PRD 2425 s6, s7):
   * the maker when they are still a member and may still send to the job's target; why not otherwise. */
  async function mayResume(job: JobRow): Promise<Served<string>> {
    const placed = await memberOf(store, job.workspace_id, job.sent_by);
    if (!placed) return no('forbidden', 'The person who made the API key that sent this job is no longer a member of this workspace.');
    const target = await mayTarget(store, job.workspace_id, placed.sender, targetOf(job));
    return target.ok ? ok(placed.person) : target;
  }

  /** Runs `act` on a job a key of the workspace sent as it stands now, a lost runner's jobs ended first (PRD 2425); none, as no
   * such job, for a person's, another workspace's and one that does not exist. */
  async function onKeyJob<T>(workspaceId: string, jobId: string, act: (job: KeyedJob) => Promise<Served<T>>): Promise<Served<T>> {
    await markLost();
    const found = await keyJobRow(workspaceId, jobId);
    return found.ok ? act(found.value) : found;
  }

  /** A job a key sent, as a key reads it (PRD 2425): its runner, the questions it asked, the job that carries it on and the key
   * that cancelled it. */
  const readKeyJob = (workspaceId: string, jobId: string): Promise<Served<KeyJob>> => onKeyJob(workspaceId, jobId, async (job) => {
    const [runner, questions, continuedBy, keys] = await Promise.all([
      runnerNameOf(job), store.questionsOf(job.id), store.continuedBy(job.id),
      store.keyNames(workspaceId, job.cancelled_by_key ? [job.cancelled_by_key] : []),
    ]);
    return ok(keyJobOf(job, { runner, questions, continuedBy, keys }));
  });

  /** Cancels a job that has not ended, as the page's Cancel does and a key's does with it (PRD 2425 s7): a queued or claimed one
   * ends at once, a running one at its runner's next report. `by` is the key that cancels and whom it acted for, a person's Cancel none.
   * Why not, in words: an ended job, or one that moved on meanwhile. */
  async function stop(job: JobRow, by: Pick<JobPatch, 'cancelled_by_key' | 'cancelled_for'> = {}): Promise<Served<JobRow>> {
    if (ENDED.includes(job.status)) return no('conflict', `This job has ended: ${job.status}.`);
    // A job not running yet ends at once: a Starting one's runner may never report on it (#2168). A
    // running one waits for its runner to kill it.
    const patch: JobPatch = { ...by, ...(job.status === 'running' ? { cancel_requested: true } : { status: 'cancelled', cancel_requested: true, ended_at: iso() }) };
    const updated = await store.updateJob(job.id, [job.status], patch);
    if (!updated) return no('conflict', 'This job changed meanwhile. Try again.');
    await retainLines(updated);
    // A job asked to stop is still running: only one that ends here (queued or claimed) tells its link.
    tellChange(job, updated);
    return ok(updated);
  }

  /** The patch that ends a job from its runner's report: a job that ends with its questions still open reads
   * Need human, which the server sets and the runner never reports (PRD 2255). */
  async function endingPatch(job: JobRow, report: JobUpdate): Promise<JobPatch> {
    const patch = reportPatch(job, report, iso());
    const asked = report.status === 'done' ? await store.questionsOf(job.id) : null;
    return asked?.closed_at === null ? { ...patch, outcome: 'human' } : patch;
  }

  /** The refusal of the database's function, when two people act at once or the rules moved on, in words. */
  async function refused(refusal: QuestionsRefusal, jobId: string): Promise<Served<never>> {
    if (refusal === 'none') return no('missing', NO_QUESTION);
    if (refusal === 'stranger') return no('forbidden', 'You are not a member of this workspace.');
    if (refusal === 'key') return no('forbidden', 'This API key does not act on this job.');
    if (refusal === 'mismatch') return no('malformed', EACH_ANSWERED);
    const row = await store.questionsOf(jobId);
    return no('conflict', row?.closed_at ? await closedWords(row) : NOT_WAITING);
  }

  return {
    /** Registers the runner by its name, or registers it again with its slots, repositories and version. */
    async register(caller: string, request: RegisterRequest): Promise<Served<RegisterReply>> {
      const repos = [...new Set(request.repos.map((repo) => repo.toLowerCase()))];
      const placed = await workspaceOf(caller, repos);
      if (!placed.ok) return placed;
      const workspaceId = placed.value;
      const seen = { slots: request.slots, repos, version: request.version, last_seen_at: iso(), github_app: request.githubApp ?? false };
      const existing = await store.runnerNamed(workspaceId, request.name);
      if (existing && existing.owner !== caller) return no('forbidden', `A runner named ${request.name} was registered by someone else: pick another name.`);
      if (existing) await loseJobsOf(existing);
      const runner = existing
        ? await store.updateRunner(existing.id, seen)
        : await store.insertRunner({ workspaceId, owner: caller, name: request.name, slots: seen.slots, repos, version: seen.version, seenAt: seen.last_seen_at, githubApp: seen.github_app });
      return ok({ id: runner.id, name: runner.name, fleet: runner.fleet });
    },

    /** Counts as a check-in, then holds up to 40 s for a job the runner may claim; null when none came. */
    async next(caller: string, runnerId: string): Promise<Served<RunnerJob | null>> {
      const owned = await ownRunner(caller, runnerId);
      if (!owned.ok) return owned;
      const deadline = clock.now().getTime() + NEXT_HOLD_MS;
      for (;;) {
        await markLost();
        await store.updateRunner(runnerId, { last_seen_at: iso() });
        const job = await store.claim(runnerId);
        if (job) {
          // The claim is stored: a job with a link tells it that it is Starting (PRD 2425 s8).
          tell(job, 'status');
          const reply = await replyTo(job);
          // A job that ended failed for want of its App's token is never answered: the runner is handed the next one, if any, at once.
          if (reply !== null) return ok(reply);
          continue;
        }
        if (clock.now().getTime() + NEXT_POLL_MS > deadline) return ok(null);
        await clock.sleep(NEXT_POLL_MS);
      }
    },

    /**
     * A fresh token of the App a job runs as (PRD 2433), for the runner that claimed it: while the job is claimed or
     * running and for 10 minutes after it ends, since the runner releases the job's claims minutes after the end.
     * Another runner's owner is refused (403), a later ask is 409, as is a job that runs as no App or whose key's App
     * can no longer mint (its words say why); GitHub out of reach is 503, for a later try.
     */
    async githubToken(caller: string, jobId: string): Promise<Served<GithubTokenReply>> {
      const held = await reporting(caller, jobId);
      if (!held.ok) return held;
      const job = await store.job(jobId);
      if (!job) return no('missing', 'No such job.');
      if (ENDED.includes(job.status) && !(clock.now().getTime() - Date.parse(job.ended_at ?? '') <= GITHUB_TOKEN_AFTER_END_MS)) return no('conflict', TOO_LATE);
      const minted = await mintFor(job);
      if (minted.kind === 'none') return no('conflict', NO_APP);
      if (minted.kind === 'failed') return no(minted.unreachable ? 'unavailable' : 'conflict', minted.why);
      return ok({ token: minted.grant.token, expiresAt: minted.grant.expiresAt });
    },

    /** A runner's report on a job it claimed: answers whether a cancel waits. */
    async update(caller: string, jobId: string, report: JobUpdate): Promise<Served<{ cancel: boolean }>> {
      const runnerId = await reporting(caller, jobId);
      if (!runnerId.ok) return runnerId;
      await markLost();
      await store.updateRunner(runnerId.value, { last_seen_at: iso() });
      const job = await store.job(jobId);
      if (!job) return no('missing', 'No such job.');
      if (releaseOnly(job, report)) {
        const released = await store.updateJob(jobId, [job.status], releasePatch(report));
        return released ? ok({ cancel: false }) : no('conflict', 'This job changed meanwhile. Report again.');
      }
      const refusal = reportRefusal(job, report);
      if (refusal) return refusal;
      // The lines first: a report that fails after them is sent again, and adds nothing the second time.
      await appendLines(job, report);
      const updated = await store.updateJob(jobId, [job.status], await endingPatch(job, report));
      if (!updated) return no('conflict', 'This job changed meanwhile. Report again.');
      await retainLines(updated);
      // A report that moves the job, or ends it with an outcome, tells its link; a log tail, lines or tokens alone tell none (PRD 2425 s8).
      tellChange(job, updated);
      return ok({ cancel: !ENDED.includes(updated.status) && updated.cancel_requested });
    },

    /** A runner's health report (PRD 2102), from its owner: its last health and a check-in, one sample
     * more, and its samples older than an hour gone. Answers when the server took it. */
    async health(caller: string, runnerId: string, report: HealthReport): Promise<Served<{ at: string }>> {
      const owned = await ownRunner(caller, runnerId);
      if (!owned.ok) return owned;
      await markLost();
      const now = clock.now();
      const at = now.toISOString();
      await store.updateRunner(runnerId, { health: { ...report, at }, last_seen_at: at });
      await store.insertSample({
        runner_id: runnerId, workspace_id: owned.value.workspace_id, at,
        cpu: report.cpu, mem_used: report.memUsed, mem_total: report.memTotal, disk_free: report.diskFree, tokens_5h: tokenSum(report.tokens?.last5h),
      });
      await store.trimSamples(runnerId, new Date(now.getTime() - SAMPLES_KEPT_MS).toISOString());
      return ok({ at });
    },

    /** Whether a link may be pinged (PRD 2425 s8), in words: null when it may, why not otherwise. The notifier's own check, which a start
     * asks before it queues anything; the send itself repeats none, and every ping checks the link again before it is made. */
    notifyCheck: (url: string): Promise<string | null> => notifier.check(url),

    /** Queues a job: a listed line, for a repository of the workspace, to a target the sender may use. */
    async send(caller: string, request: SendRequest): Promise<Served<Job>> {
      const queued = await queue(caller, request, null);
      if (!queued.ok) return queued;
      return ok(jobOf(queued.value, await store.logins(queued.value.workspace_id, [caller])));
    },

    /** Queues a job for a program's API key (PRD 2022): as its maker would send it, in the key's workspace
     * only, to a runner by its name or a fleet, and marked as sent by the key. */
    async sendByKey(key: KeySender, request: KeySend): Promise<Served<KeyJob>> {
      if (request.runner !== undefined && request.fleet !== undefined) {
        return no('malformed', 'Name a runner or a fleet, not both.');
      }
      let target: Target = { kind: 'any' };
      if (request.fleet !== undefined) target = { kind: 'fleet', fleet: request.fleet };
      if (request.runner !== undefined) {
        const named = await store.runnerNamed(key.workspace, request.runner);
        if (!named) return no('missing', `No runner named ${request.runner} in this workspace.`);
        target = { kind: 'runner', runner: named.id };
      }
      const queued = await queue(key.maker, { line: request.line, repo: request.repo, target }, key, null, { actingFor: request.actingFor, notifyUrl: request.notifyUrl });
      // A job just queued asked nothing, carries nothing on and was cancelled by nobody: nothing else to read.
      return queued.ok ? ok(keyJobOf(queued.value, { runner: await runnerNameOf(queued.value), questions: null, continuedBy: null, keys: new Map() })) : queued;
    },

    /** A job a key of this workspace queued, as a key reads it, with what it did (PRD 2425): none for another
     * workspace's, or a person's. */
    keyJob: readKeyJob,

    /** Cancels a job: a queued or claimed one at once, a running one at its runner's next report. */
    async cancel(caller: string, jobId: string): Promise<Served<Job>> {
      const allowed = await cancelling(caller, jobId);
      if (!allowed.ok) return allowed;
      await markLost();
      const job = await store.job(jobId);
      if (!job) return no('missing', 'No such job.');
      const stopped = await stop(job);
      if (!stopped.ok) return stopped;
      const updated = stopped.value;
      return ok(jobOf(updated, await store.logins(updated.workspace_id, sendersOf([updated])), await keysOf(updated.workspace_id, [updated])));
    },

    /** A key cancels a job a key of its workspace sent (PRD 2425 s7), as the page's Cancel does: a queued or claimed job ends at once,
     * a running one is asked to stop, and the job records the key and whom it said it acted for. Answers the job as a key reads it. A
     * running job already asked to stop stays the first key's. An ended job is a conflict. */
    cancelByKey: (key: KeyCloser, jobId: string): Promise<Served<KeyJob>> => onKeyJob(key.workspace, jobId, async (job) => {
      const stopped = job.status === 'running' && job.cancel_requested ? ok(job) : await stop(job, { cancelled_by_key: key.id, cancelled_for: key.actingFor });
      return stopped.ok ? readKeyJob(key.workspace, jobId) : stopped;
    }),

    /** A key relaunches a job a key of its workspace sent (PRD 2425 s7), as the page offers for it: Send again for a failed or
     * cancelled job, Resume for one stopped mid-way, which both send the job's line again, to its target, as Send checks it. The new
     * job is the first one's key's and maker's, `continues` it, keeps its notify_url and acts for whom the key says now; the first job
     * reads as carried on by it. Answers the new job as a key reads a job. A job already carried on is a conflict, as is one the page
     * offers neither for. */
    relaunchByKey: (key: KeyCloser, jobId: string): Promise<Served<KeyJob>> => onKeyJob(key.workspace, jobId, async (job) => {
      if (!relaunchable(job)) return no('conflict', NOT_OFFERED);
      if ((await store.continuedBy(job.id)) !== null) return no('conflict', CARRIED_ON);
      const maker = await mayResume(job);
      if (!maker.ok) return maker;
      const thread = { continues: job.id, actingFor: key.actingFor, notifyUrl: job.notify_url ?? null };
      const queued = await queue(maker.value, { line: job.line, repo: job.repo, target: targetOf(job) }, { id: job.sent_by_key, workspace: key.workspace }, thread);
      // A job just queued asked nothing, is carried on by none and was cancelled by nobody: nothing else to read.
      return queued.ok ? ok(keyJobOf(queued.value, { runner: null, questions: null, continuedBy: null, keys: new Map() })) : queued;
    }),

    /** Gives the runner to a fleet, or makes it shared: a workspace owner only. */
    async setFleet(caller: string, runnerId: string, fleet: string | null): Promise<Served<Runner>> {
      const runner = await store.runner(runnerId);
      const member = runner ? await store.member(runner.workspace_id, caller) : null;
      if (!runner || !member) return no('missing', 'No such runner.');
      if (!member.owner) return no('forbidden', 'Only a workspace owner gives a runner to a fleet.');
      if (fleet !== null && !(await store.fleetExists(runner.workspace_id, fleet))) return no('missing', `No fleet ${fleet} in this workspace.`);
      const updated = await store.updateRunner(runnerId, { fleet });
      const active = await store.activeJobs(runner.workspace_id);
      return ok(runnerOf(updated, usedBy(active, runnerId), clock.now()));
    },

    /** A job's live lines after `after`, for a member of its workspace: at most 5,000 in order, whether
     * more follow, the first it holds, and its log tail only when it holds no line. */
    async lines(caller: string, jobId: string, after: number): Promise<Served<JobLines>> {
      const job = await store.job(jobId);
      const member = job ? await store.member(job.workspace_id, caller) : null;
      if (!job || !member) return no('missing', 'No such job.');
      const [read, first] = await Promise.all([store.lines(jobId, after, JOB_LINES_PAGE + 1), store.firstLine(jobId)]);
      const logTail = first === null && job.log_tail !== '' ? job.log_tail : null;
      return ok({ status: job.status, lines: read.slice(0, JOB_LINES_PAGE), more: read.length > JOB_LINES_PAGE, first, logTail });
    },

    /** The terminal's read of the runners (PRD 2251): every runner of the workspace the repository belongs
     * to for the caller, with its state and slots, by name. A member only. */
    async runnersFor(caller: string, repo: string): Promise<Served<KitRunner[]>> {
      const workspace = await memberPlacement(caller, repo.toLowerCase());
      if (!workspace.ok) return workspace;
      await markLost();
      const [runners, active] = await Promise.all([store.runners(workspace.value), store.activeJobs(workspace.value)]);
      const now = clock.now();
      return ok(runners.map((runner) => kitRunnerOf(runner, usedBy(active, runner.id), now)));
    },

    /** The repository's own skills its owner allowed, for Send to terminal's choice of line (PRD 2313): a
     * member of the workspace reads them, sorted, however the repository is spelt. */
    async allowedSkills(caller: string, workspaceId: string, repo: string): Promise<Served<string[]>> {
      if (!(await store.member(workspaceId, caller))) return no('forbidden', 'You are not a member of this workspace.');
      return ok(await store.allowedSkills(workspaceId, repo.toLowerCase()));
    },

    /** The terminal's read of a PRD's jobs (PRD 2251): the jobs of the repository whose line names the PRD,
     * among the ones the Runners page lists (queued and running, then the last 50 that ended), newest
     * first. A member of the workspace the repository belongs to only. */
    async prdJobs(caller: string, repo: string, prd: PrdNumber): Promise<Served<PrdJob[]>> {
      const named = repo.toLowerCase();
      const workspace = await memberPlacement(caller, named);
      if (!workspace.ok) return workspace;
      await markLost();
      const [runners, active, ended] = await Promise.all([store.runners(workspace.value), store.activeJobs(workspace.value), store.endedJobs(workspace.value, ENDED_JOBS_SHOWN)]);
      const names = new Map(runners.map((runner) => [runner.id, runner.name]));
      return ok([...active, ...ended]
        .filter((job) => job.repo === named && linePrd(job.line) === prd)
        .sort((a, b) => b.queued_at.localeCompare(a.queued_at) || b.id.localeCompare(a.id))
        .map((job) => prdJobOf(job, job.runner_id === null ? null : names.get(job.runner_id) ?? null)));
    },

    /** A running job asks its questions (PRD 2255), once: from the owner of its runner. Answers them open. */
    async ask(caller: string, jobId: string, request: AskRequest): Promise<Served<JobQuestions>> {
      const runnerId = await reporting(caller, jobId);
      if (!runnerId.ok) return runnerId;
      const job = await store.job(jobId);
      if (!job) return no('missing', 'No such job.');
      if (job.status !== 'running') return no('conflict', `This job is ${job.status}: only a running job asks.`);
      const stored = await store.insertQuestions({ jobId, workspaceId: job.workspace_id, issue: request.issue, lead: request.lead, questions: request.questions });
      if (!stored) return no('conflict', 'This job asked its questions already.');
      tell(job, 'questions');
      return ok(questionsView(stored, new Map()));
    },

    /** A job's questions, with the answers once someone closed them, for a member of its workspace: a
     * person, or the owner of a runner (the resume job reads them). */
    async questions(caller: string, jobId: string): Promise<Served<JobQuestions>> {
      const found = await questionsFor(caller, jobId);
      if (!found.ok) return found;
      return ok(await viewOf(found.value.row));
    },

    /** The questions of a job a key of this workspace sent, as that key reads them (PRD 2425 s6): the lead and the questions,
     * the state, the answers once given, and who closed them, a person by login or a key by name with whom it acted for. A
     * person's job, another workspace's and one that asked none are none. */
    async questionsByKey(workspaceId: string, jobId: string): Promise<Served<JobQuestions>> {
      const found = await questionsOfKeyJob(workspaceId, jobId);
      return found.ok ? ok(await viewOf(found.value.row)) : found;
    },

    /** The first member to answer a job's questions queues the run that resumes it, as themselves: one answer
     * to each question, the line and the target checked as Send checks them, the answers and the resume job
     * stored together (runner_job_answer()). Answers the resume job. */
    async answer(caller: string, jobId: string, request: AnswerRequest): Promise<Served<Job>> {
      const waiting = await waitingFor(caller, jobId);
      if (!waiting.ok) return waiting;
      const { job, row, member } = waiting.value;
      if (!answersEach(row, request.answers)) return no('malformed', EACH_ANSWERED);
      const resumed = resumeOf(job.line, row.issue, jobId);
      if (!resumed.ok) return resumed;
      const placed = await placement(caller, job.repo, job.workspace_id);
      if (!placed.ok) return placed;
      const target = await mayTarget(store, job.workspace_id, member, targetOf(job));
      if (!target.ok) return target;
      const answered = await store.answer(jobId, request.answers, caller);
      if (!answered.ok) return refused(answered.refusal, jobId);
      // The questions of the job that asked are closed: its link is told, whoever closed them (PRD 2425 s8).
      tell(job, 'questions');
      // The resume of a key's job stays the key's and its maker's, whoever answered (PRD 2425): the reply names them.
      const resume = answered.value;
      return ok(jobOf(resume, await store.logins(resume.workspace_id, sendersOf([resume])), await keysOf(resume.workspace_id, [resume])));
    },

    /** A key answers the questions of a job a key of its workspace sent (PRD 2425 s6): one answer to each question and the line
     * checked as for a person; the resume is queued as the job's key and maker, to its target, `continues` the job, and the
     * round closes as the key, with whom it said it acted for, in one transaction (runner_job_answer()). Answers the resume job,
     * as a key reads a job. The first close, a key's or a person's, wins. */
    async answerByKey(key: KeyCloser, jobId: string, answers: Record<string, string>): Promise<Served<KeyJob>> {
      const waiting = await stillWaitingOnKey(key.workspace, jobId);
      if (!waiting.ok) return waiting;
      const { job, row } = waiting.value;
      if (!answersEach(row, answers)) return no('malformed', EACH_ANSWERED);
      const resumed = resumeOf(job.line, row.issue, jobId);
      if (!resumed.ok) return resumed;
      const allowed = await mayResume(job);
      if (!allowed.ok) return allowed;
      const answered = await store.answerByKey(jobId, answers, key.id, key.actingFor);
      if (!answered.ok) return refused(answered.refusal, jobId);
      tell(job, 'questions');
      // A job just queued asked nothing, is carried on by none and was cancelled by nobody: nothing else to read.
      return ok(keyJobOf(answered.value,{ runner: null, questions: null, continuedBy: null, keys: new Map() }));
    },

    /** A key closes the questions of a job a key of its workspace sent with no answer and no job queued (PRD 2425 s6), as the
     * key, with whom it said it acted for. Answers the job as a key reads it, its questions dismissed. */
    async dismissByKey(key: KeyCloser, jobId: string): Promise<Served<KeyJob>> {
      const waiting = await stillWaitingOnKey(key.workspace, jobId);
      if (!waiting.ok) return waiting;
      const dismissed = await store.dismissByKey(jobId, key.id, key.actingFor);
      if (!dismissed.ok) return refused(dismissed.refusal, jobId);
      tell(waiting.value.job, 'questions');
      return readKeyJob(key.workspace, jobId);
    },

    /** Any member closes a job's questions with no answers and no job queued: they leave the badge. */
    async dismiss(caller: string, jobId: string): Promise<Served<JobQuestions>> {
      const waiting = await waitingFor(caller, jobId);
      if (!waiting.ok) return waiting;
      const dismissed = await store.dismiss(jobId, caller);
      if (!dismissed.ok) return refused(dismissed.refusal, jobId);
      tell(waiting.value.job, 'questions');
      return ok(questionsView(dismissed.value, await store.logins(dismissed.value.workspace_id, [caller])));
    },

    /** The Runners page's read: the workspace's runners with their state, their last health and their
     * samples of the last hour, its jobs (queued and running first, then the last 50 that ended), and what
     * the viewer may do. A member only. */
    async board(caller: string, workspaceId: string): Promise<Served<Board>> {
      const viewer = await store.member(workspaceId, caller);
      if (!viewer) return no('forbidden', 'You are not a member of this workspace.');
      await markLost();
      const [runners, active, ended, openIds] = await Promise.all([
        store.runners(workspaceId), store.activeJobs(workspaceId), store.endedJobs(workspaceId, ENDED_JOBS_SHOWN), store.openQuestionJobs(workspaceId),
      ]);
      // A job waiting for an answer stays on the board whatever its age (PRD 2255): the ones past the last 50 are added…
      const listed = new Set([...active, ...ended].map((job) => job.id));
      const waiting = (await store.jobsById(workspaceId, openIds.filter((id) => !listed.has(id)))).filter((job) => job.status === 'done' && job.outcome === 'human');
      const finished = [...ended, ...waiting].sort((a, b) => (b.ended_at ?? '').localeCompare(a.ended_at ?? ''));
      // …and one whose questions were answered or dismissed reads Done: the outcome `human` is only for open ones.
      const open = new Set(openIds);
      const jobs = [...active, ...finished].map((job) => (job.outcome === 'human' && !open.has(job.id) ? { ...job, outcome: null } : job));
      const logins = await store.logins(workspaceId, sendersOf(jobs));
      const keys = await keysOf(workspaceId, jobs);
      const now = clock.now();
      const samples = samplesByRunner(await store.samples(runners.map((runner) => runner.id), new Date(now.getTime() - SAMPLES_KEPT_MS).toISOString()));
      // Whether a queued key's job needs its key's GitHub App (PRD 2482): one batched read of who holds an App, never the App's sealed key.
      const needing = await store.jobsNeedingApp(jobs.flatMap((job) => (job.status === 'queued' && job.sent_by_key !== null ? [{ id: job.id, keyId: job.sent_by_key }] : [])));
      return ok({
        runners: runners.map((runner) => ({ ...runnerOf(runner, usedBy(active, runner.id), now, samples.get(runner.id) ?? []), githubApp: runner.github_app })),
        jobs: jobs.map((job) => ({ ...jobOf(job, logins, keys), ...(needing.has(job.id) ? { needsApp: true } : {}) })),
        viewer: { id: caller, owner: viewer.owner, fleet: viewer.fleet },
      });
    },
  };
}

export type RunnersService = ReturnType<typeof runnersService>;

/** What a continuation asks (PRD 2270): the PRD of a repository of the workspace, and where its asked
 * questions stand after the touch's read. */
type ContinueRequest = {
  workspaceId: string; repo: string; prd: PrdNumber; stand: OutboxStand | null;
  /** A person pressing Fix with answers (PRD 2270 s2): the fix is sent in their name and the repository's switch is not asked. */
  by?: string | undefined;
};

/** The fix queued, or why none was. */
type Continued = { queued: Job; why: null } | { queued: null; why: string };

/** Why a continuation has no sender: the Omni app sent the job and no person pressed (PRD 2338), the job's sender left
 * the workspace, or the person pressing never joined it. */
const senderGone = (by: string | undefined): string =>
  by === undefined ? 'its sender is no longer a member of the workspace, or the Omni app sent it' : 'you are not a member of this workspace';

/** The person and their place in the workspace; none for an app-sent job (no person), or a person who left. */
async function memberOf(store: RunnersRepository, workspaceId: string, person: string | null): Promise<{ person: string; sender: Sender } | null> {
  const sender = person === null ? null : await store.member(workspaceId, person);
  return person !== null && sender ? { person, sender } : null;
}

/** The API key a continuation is sent by: the job's own, unless a person pressed Fix with answers. */
const keyOf = (job: Pick<JobRow, 'sent_by_key'>, by: string | undefined): string | null => (by === undefined ? job.sent_by_key : null);

/** The link a continuation pings (PRD 2425 s8): its job's, and only while the fix stays a key's job: a person pressing Fix sends none of a key's, so its changes ping none. */
const linkOf = (job: Pick<JobRow, 'notify_url'>, sentByKey: string | null): { notifyUrl?: string } =>
  sentByKey !== null && job.notify_url ? { notifyUrl: job.notify_url } : {};

/** The continuation's rules (PRD 2270 s1): once every asked item of a PRD has a counted reply, its newest
 * runner job, which waited on answers, is continued by `/omni:yolo-fix <n>`, queued to the same runner or
 * fleet in its sender's name (the API key that sent it, too), and linked to it. The decision is
 * ./continue.ts's; the sender must still be a member who may send there, as when they sent it; and the
 * database's unique runner_jobs.continues refuses a second continuation, so two touches at once queue one. */
export function continuationsService(store: RunnersRepository, continuations: ContinuationsRepository) {
  const none = (why: string): Continued => ({ queued: null, why });
  return {
    async continueAnswered({ workspaceId, repo, prd, stand, by }: ContinueRequest): Promise<Continued> {
      // Nothing is read until every asked item is answered: most touches stop here.
      const unanswered = unansweredWhy(stand);
      if (unanswered !== null) return none(unanswered);
      const repoKey = repo.toLowerCase();
      const [switchOn, rows] = await Promise.all([continuations.fixWhenAnswered(workspaceId, repoKey), continuations.prdJobs(workspaceId, repoKey, prd)]);
      // A bug fix's own end (PRD 2425) is no hand-off to continue from: it reads as none here, as it does on the page.
      const jobs = rows.map((row) => ({ ...row, outcome: pageOutcome(row.outcome) }));
      const decision = shouldContinue({ prd, stand, jobs, switchOn: by !== undefined || switchOn === true });
      if (!decision.continue) return none(decision.why);
      const job = decision.job;
      const placed = await memberOf(store, workspaceId, by ?? job.sent_by);
      if (!placed) return none(senderGone(by));
      const { person: sentBy, sender } = placed;
      const target = await mayTarget(store, workspaceId, sender, targetOf(job));
      if (!target.ok) return none(target.error);
      const sentByKey = keyOf(job, by);
      const row = await continuations.insertContinuation({
        workspaceId, line: `/omni:yolo-fix ${String(prd)}`, repo: job.repo, ...target.value, sentBy, sentByKey, continues: job.id, ...linkOf(job, sentByKey),
      });
      if (!row) return none(`job ${job.id} was continued already`);
      const keys = row.sent_by_key === null ? new Map<string, string>() : await store.keyNames(workspaceId, [row.sent_by_key]);
      return { queued: jobOf(row, await store.logins(workspaceId, sendersOf([row])), keys), why: null };
    },
  };
}

// The runners' shapes (PRD 1830 s1; ADR-0095), as zod schemas the routes, the Runners page, Send to
// terminal and the kit's `omni runner` share. Browser-safe: zod and the kit's branded ids only.
//
//   POST  /api/runners/register            runner  {name, slots, repos, version}            → {id, name, fleet}
//   GET   /api/runners/next?runner=<id>    runner  held up to 40 s                          → RunnerJob | 204
//   POST  /api/runners/jobs/<id>           runner  {status, logTail?, from?, lines?, prUrl?, exitCode?, reason?, tokens?, released?, releaseError?, outcome?, slicesMerged?, slicesTotal?} → {cancel}
//   POST  /api/runners/<id>/health         runner  HealthReport, every 15 s (PRD 2102)       → {at}
//   POST  /api/runners/jobs/<id>/github-token  runner, the job's own, while it is claimed or running and for 10 minutes after it ends (PRD 2433) → {token, expiresAt}
//   GET   /api/runners/jobs/<id>/lines?after=<seq>  browser or terminal (PRD 2251)        → JobLines
//   GET   /api/runners?repo=<owner/name>   terminal (PRD 2251)                              → {runners: [KitRunner]}
//   GET   /api/runners/jobs?repo=<owner/name>&prd=<n>  terminal (PRD 2251)                 → {jobs: [PrdJob]}, newest first
//   POST  /api/runners/jobs                browser {line, repo, target}                      → {job}
//   POST  /api/runners/jobs/<id>/cancel    browser                                           → {job}
//   POST  /api/runners/jobs/<id>/questions runner {issue, lead, questions} (PRD 2255)        → JobQuestions
//   GET   /api/runners/jobs/<id>/questions runner or browser, of the job's workspace (PRD 2255) → JobQuestions
//   POST  /api/runners/jobs/<id>/answers   browser, a person's session only {answers}        → {job}
//   POST  /api/runners/jobs/<id>/dismiss   browser, a person's session only                  → JobQuestions
//   PATCH /api/runners/<id>                browser {fleet}                                   → {runner}
//
// A runner's routes take the kit's sign-in (a bearer access token, `omni signin` or a traded
// OMNI_TOKEN); the browser's take the session; the terminal's reads take the kit's sign-in. A refusal is `{error}` in plain words (ADR-0029): 400 a
// malformed request or a line off the list, 401 signed out, 403 not allowed (a target outside the
// sender's fleet, a repository outside the workspace, a fleet set by a non-owner, a runner of someone
// else, a token on a route that takes a person's session), 404 no such runner or job (or no question
// on it), 409 a job that has ended (a runner stops it) or a status that goes back, or questions already
// asked, answered or dismissed, or a GitHub token asked of a job that ended over 10 minutes ago, that
// runs as no App, or whose key's App no longer works (its words say which), 503 no database here
// (or GitHub could not be reached for a token), 500 the database failed.
import { z } from 'zod';
import { IssueNumberSchema, PrdNumberSchema, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';

/** The skills a runner may run: the ones the app copies that need no person typing and end on their own. */
export const RUNNER_SKILLS = ['yolo', 'yolo-fix', 'pr-care', 'do-work', 'wave', 'bug-fix', 'mega-bug-fix', 'visual-fix', 'plan', 'pitch', 'prove', 'retro-apply'] as const;
export type RunnerSkill = (typeof RUNNER_SKILLS)[number];

/** The longest line a runner runs, skill included: the kit's own `LINE_MAX`, which `omni runner` checks
 * again before it runs a job. */
const MAX_LINE = 200;

/** How long a runner stays online after its last check-in. */
export const LOST_AFTER_MS = 90_000;

/** How long `next` holds before it answers 204: well under the route's 60 s limit, with the database calls
 * around each look, so the platform never cuts it off with a 504. */
export const NEXT_HOLD_MS = 40_000;

/** The log tail a job keeps: its last lines, and at most this many bytes of them. */
export const LOG_TAIL_LINES = 200;
export const LOG_TAIL_BYTES = 16 * 1024;

/** How many ended jobs the Runners page shows; the lines of an ended job beyond them are deleted (PRD 1904). */
export const ENDED_JOBS_SHOWN = 50;

/** A job's live log (PRD 1904): the most lines one report carries, the longest line, the lines a job
 * keeps (its last ones), and the most lines one read answers. */
const REPORT_LINES_MAX = 2_000;
const JOB_LINE_CHARS = 600;
export const JOB_LINES_KEPT = 20_000;
export const JOB_LINES_PAGE = 5_000;

/** The longest name of a repository's own skill (PRD 2313): the kit's own `SKILL_NAME_MAX`, and the
 * database's limit on `repository_runner_skills.skill`. */
const MAX_SKILL_NAME = 64;

const ARGS = /^[A-Za-z0-9 ._/:#-]*$/;
const LINE = /^\/omni:([a-z][a-z-]*)(?: (.*))?$/s;
const OWN_LINE = /^\/([a-z][a-z0-9-]*)(?: (.*))?$/s;
const BAD_ARGS = 'A line\'s arguments are letters, digits, spaces and . _ / : # - only.';

/** A line of a fixed skill: `/omni:<skill> <args>`. */
type FixedLine = { ok: true; kind: 'omni'; skill: RunnerSkill; args: string };
/** A line of a skill of the repository's own (PRD 2313): `/<name> <args>`. */
type OwnLine = { ok: true; kind: 'repository'; skill: string; args: string };
type Refused = { ok: false; reason: string };

/** A line's verdict: its kind, skill and arguments, or why it is refused, in plain words. */
export type LineCheck = FixedLine | OwnLine | Refused;

/** Whether a name is allowed: one of the repository's allowed skills, or any name for the shape alone. */
type Allows = (name: string) => boolean;

function verdict(line: string, allows: Allows): LineCheck {
  if (line.length > MAX_LINE) return { ok: false, reason: `A line is ${String(MAX_LINE)} characters at most, the skill included.` };
  const fixed = LINE.exec(line);
  if (fixed) return fixedVerdict(fixed[1] ?? '', fixed[2] ?? '');
  const own = OWN_LINE.exec(line);
  if (!own) return { ok: false, reason: 'A line reads `/omni:<skill> <arguments>` or `/<skill> <arguments>`.' };
  return ownVerdict(own[1] ?? '', own[2] ?? '', allows);
}

function fixedVerdict(name: string, args: string): FixedLine | Refused {
  const skill = RUNNER_SKILLS.find((listed) => listed === name);
  if (!skill) return { ok: false, reason: `/omni:${name} is not a skill a runner runs: only ${RUNNER_SKILLS.join(', ')}.` };
  if (!ARGS.test(args)) return { ok: false, reason: BAD_ARGS };
  return { ok: true, kind: 'omni', skill, args };
}

function ownVerdict(skill: string, args: string, allows: Allows): OwnLine | Refused {
  if (skill.length > MAX_SKILL_NAME) return { ok: false, reason: `A skill's name is ${String(MAX_SKILL_NAME)} characters at most.` };
  if (!ARGS.test(args)) return { ok: false, reason: BAD_ARGS };
  if (RUNNER_SKILLS.some((listed) => listed === skill)) return { ok: false, reason: `/${skill} is the loop's own skill: send /omni:${skill}.` };
  if (!allows(skill)) return { ok: false, reason: `/${skill} is not allowed on a runner for this repository.` };
  return { ok: true, kind: 'repository', skill, args };
}

/** Whether `line` is one a runner may run: 200 characters at most, skill included, reading
 * `/omni:<skill> <args>` with the skill on the list, or `/<name> <args>` with the name one of `allowed`,
 * the repository's own skills (PRD 2313), never a fixed skill's; the arguments letters, digits, spaces
 * and `._/:#-` only. The route checks it, and the runner checks it again before it runs, in the same
 * order. With no `allowed`, only a fixed skill's line passes. */
export function checkLine(line: string): FixedLine | Refused;
export function checkLine(line: string, allowed: readonly string[]): LineCheck;
export function checkLine(line: string, allowed: readonly string[] = []): LineCheck {
  return verdict(line, (name) => allowed.includes(name));
}

/** A line's shape alone, every name but a fixed skill's counted allowed: what Send checks before it
 * knows the repository, and what names a PRD (PRD 2313). */
export function checkLineShape(line: string): LineCheck {
  return verdict(line, () => true);
}

/** The PRD a line names (PRD 2251): its first argument, when it is a PRD number (`/omni:yolo 2251`,
 * `/omni:do-work 2251 s1`, a repository skill's `/validate-prd 347`, PRD 2313); null for a line no
 * runner runs, or whose first argument is anything else. */
export function linePrd(line: string): PrdNumber | null {
  const check = checkLineShape(line);
  const first = check.ok ? /^(\d+)(?: |$)/.exec(check.args)?.[1] : undefined;
  const prd = PrdNumberSchema.safeParse(first === undefined ? null : Number(first));
  return prd.success ? prd.data : null;
}

/** The name of a repository's own skill (PRD 2313), as `repository_runner_skills.skill` holds it. */
const SkillNameSchema = z.string().max(MAX_SKILL_NAME).regex(/^[a-z][a-z0-9-]*$/);

/** A repository, as `owner/name`. */
const RepoSchema = z.string().max(200).regex(/^[\w.-]+\/[\w.-]+$/);

/** A runner's name: unique in its workspace. */
const RunnerNameSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/);

/** A fleet, by its key (`public.teams.name`). */
const FleetSchema = z.string().min(1).max(40);

const IdSchema = z.uuid();

// ── The runner's routes ─────────────────────────────────────────────────────────

/** A runner registering, or registering again, by its name. `githubApp` says it can run a job as an API key's
 * GitHub App (PRD 2433): the app hands such a job only to a runner that said so, and a runner that says
 * nothing (an older kit) cannot. */
export const RegisterRequestSchema = z.object({
  name: RunnerNameSchema,
  slots: z.number().int().min(1).max(8),
  repos: z.array(RepoSchema).min(1).max(50),
  version: z.string().max(40),
  githubApp: z.boolean().optional(),
}).strict();
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const RegisterReplySchema = z.object({ id: IdSchema, name: RunnerNameSchema, fleet: FleetSchema.nullable() });
export type RegisterReply = z.infer<typeof RegisterReplySchema>;

/** `next`'s query: the runner asking. */
export const NextQuerySchema = z.object({ runner: IdSchema }).strict();

/** The GitHub App a key's job runs as (PRD 2433): an installation token for the job's repositories and when it
 * stops working, and the App's bot as git and GitHub name it, `<slug>[bot]` and `<bot id>+<slug>[bot]@users.noreply.github.com`. */
const GithubGrantSchema = z.object({
  token: z.string().min(1), expiresAt: z.string().min(1), login: z.string().min(1), email: z.string().min(1),
});
export type GithubGrant = z.infer<typeof GithubGrantSchema>;

/** A job, as the runner that claimed it receives it: the sender's GitHub login, when they have one, goes
 * to the run as OMNI_SENT_BY. `allowedSkills` are the repository's own skills its owner allowed, read
 * when the job was claimed (PRD 2313): the runner checks the line against them again before it runs.
 * `sentByKey` is the name of the API key that sent it, or null (PRD 2433); `github` is the App it runs as,
 * only for a key that holds one, and null otherwise: a job that needs an App is never answered without it. */
export const RunnerJobSchema = z.object({
  id: IdSchema, line: z.string().max(MAX_LINE), repo: RepoSchema, sentBy: z.string().nullable(), allowedSkills: z.array(SkillNameSchema),
  sentByKey: z.string().nullable(), github: GithubGrantSchema.nullable(),
}).refine((job) => checkLine(job.line, job.allowedSkills).ok, { message: 'not a line a runner runs', path: ['line'] });
export type RunnerJob = z.infer<typeof RunnerJobSchema>;

/** How long after a job ends its runner may still ask for a fresh token (PRD 2433): its release of the job's
 * claims comes minutes after the end. */
export const GITHUB_TOKEN_AFTER_END_MS = 10 * 60 * 1000;

/** What `POST /api/runners/jobs/<id>/github-token` answers: a fresh token of the job's App, and when it stops working. */
export const GithubTokenReplySchema = GithubGrantSchema.pick({ token: true, expiresAt: true });
export type GithubTokenReply = z.infer<typeof GithubTokenReplySchema>;

/** The statuses a job goes through, in order; the last three end it. */
const JOB_STATUSES = ['queued', 'claimed', 'running', 'done', 'failed', 'cancelled'] as const;

/** A pull request's link. */
const PrUrlSchema = z.string().max(300).regex(/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+$/);

/** The tokens a transcript holds, as four counts (PRD 2102): input, output, cache read and cache write. Numbers only. */
const TokenCountsSchema = z.object({
  input: z.number().int().nonnegative(),
  output: z.number().int().nonnegative(),
  cacheRead: z.number().int().nonnegative(),
  cacheWrite: z.number().int().nonnegative(),
}).strict();
export type TokenCounts = z.infer<typeof TokenCountsSchema>;

/** What a done job ended on: a yolo hand-off (PRD 2223), the run ended on `/omni:yolo-fix` (answers), `/omni:yolo` (held)
 * or `/omni:pr-care` (ready); `human` (PRD 2255), the run ended with the questions it asked a person still open; or `stopped` (PRD 2375), a
 * `/omni:yolo` or `/omni:yolo-fix` run that exited with no hand-off line, so it is not done. */
export const JOB_OUTCOMES = ['answers', 'held', 'ready', 'human', 'stopped'] as const;

/** What a runner's report may say: the server alone sets `human`, from the questions a job stored. */
const REPORTED_OUTCOMES = ['answers', 'held', 'ready', 'stopped'] as const;

/** The most claims a job's report says its runner released, and the longest reason a release failed (PRD 2175). */
const RELEASED_MAX = 50;
const RELEASE_ERROR_CHARS = 200;

/** A runner's report on a job it claimed. The log tail is cut to its last 200 lines and 16 KB here.
 * `from` and `lines` come together or not at all (PRD 1904): the readable log's lines after the
 * runner's cursor, the first of them numbered `from` (its 1-based line number in the log). */
export const JobUpdateSchema = z.object({
  status: z.enum(['running', 'done', 'failed', 'cancelled']),
  logTail: z.string().max(256 * 1024).optional(),
  from: z.number().int().positive().optional(),
  lines: z.array(z.string().max(JOB_LINE_CHARS)).max(REPORT_LINES_MAX).optional(),
  prUrl: PrUrlSchema.nullable().optional(),
  exitCode: z.number().int().nullable().optional(),
  reason: z.string().max(200).nullable().optional(),
  /** The tokens of the job's worktree and every folder below it (PRD 2102), stored in `runner_jobs.tokens`. */
  tokens: TokenCountsSchema.optional(),
  /** The claims (sub-PR numbers) its runner released once it ended (PRD 2175), stored in `runner_jobs.released`. */
  released: z.array(z.number().int().positive()).max(RELEASED_MAX).optional(),
  /** Why the release failed, or null when nothing did (PRD 2175), stored in `runner_jobs.release_error`. */
  releaseError: z.string().max(RELEASE_ERROR_CHARS).nullable().optional(),
  /** What a done yolo job's hand-off ended on (PRD 2223), stored in `runner_jobs.outcome`; an unknown value, and `human`, are refused. */
  outcome: z.enum(REPORTED_OUTCOMES).nullable().optional(),
  /** The PRD's slices merged and its slices in all, read when a job ended `stopped` (PRD 2375), stored in `runner_jobs.slices_merged` and `slices_total`. */
  slicesMerged: z.number().int().nonnegative().optional(),
  slicesTotal: z.number().int().nonnegative().optional(),
}).strict()
  .refine((report) => (report.from === undefined) === (report.lines === undefined), { message: 'from and lines come together' })
  .refine((report) => (report.slicesMerged === undefined) === (report.slicesTotal === undefined), { message: 'slicesMerged and slicesTotal come together' })
  .refine((report) => report.slicesMerged === undefined || report.slicesTotal === undefined || report.slicesMerged <= report.slicesTotal, { message: 'slicesMerged is at most slicesTotal' });
export type JobUpdate = z.infer<typeof JobUpdateSchema>;

/** What a report answers: whether a cancel waits, and the runner kills the job. */
export const JobUpdateReplySchema = z.object({ cancel: z.boolean() });

/** A runner's samples are kept one hour (PRD 2102): about 240 at one per 15 s. */
export const SAMPLES_KEPT_MS = 60 * 60 * 1000;

/** A figure of the machine: a finite non-negative number, or null when the runner could not read it. */
const FigureSchema = z.number().nonnegative().nullable();
/** A count of bytes, or of cores. */
const CountSchema = z.number().int().nonnegative().nullable();

/** The limits a runner pauses at: memory used above (percent), disk free below (GB), load above (× cores). */
const HealthLimitsSchema = z.object({
  maxMemory: z.number().gt(0).max(100),
  minDiskGb: z.number().nonnegative(),
  maxLoad: z.number().positive(),
}).strict();

/** A runner's health report (PRD 2102): its machine's sample, numbers only, and, from a runner that pauses,
 * why it is paused (80 characters at most, or null) and the limits it pauses at. */
export const HealthReportSchema = z.object({
  cpu: z.number().min(0).max(100).nullable(),
  load1: FigureSchema,
  cores: CountSchema,
  memUsed: CountSchema,
  memTotal: CountSchema,
  diskFree: CountSchema,
  diskTotal: CountSchema,
  paused: z.string().min(1).max(80).nullable().optional(),
  limits: HealthLimitsSchema.optional(),
  /** The machine's tokens of the last 5 hours and since midnight UTC; a count the runner could not read is null. */
  tokens: z.object({ last5h: TokenCountsSchema.nullable(), today: TokenCountsSchema.nullable() }).strict().optional(),
}).strict();
export type HealthReport = z.infer<typeof HealthReportSchema>;

/** What a health report answers: when the server took it. */
export const HealthReplySchema = z.object({ at: z.string() });

/** A runner's last health report, as stored and read: the report and when the server took it. */
export const RunnerHealthSchema = HealthReportSchema.extend({ at: z.string() });

/** One of a runner's samples of the last hour, for the page's sparklines. */
const RunnerSampleSchema = z.object({
  at: z.string(),
  cpu: z.number().nullable(),
  memUsed: z.number().nullable(),
  memTotal: z.number().nullable(),
  diskFree: z.number().nullable(),
  tokens5h: z.number().nullable(),
});
export type RunnerSample = z.infer<typeof RunnerSampleSchema>;

// ── The browser's routes ────────────────────────────────────────────────────────

/** Where a job goes: any runner of the workspace, a fleet's, or one runner. */
export const TargetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('any') }).strict(),
  z.object({ kind: z.literal('fleet'), fleet: FleetSchema }).strict(),
  z.object({ kind: z.literal('runner'), runner: IdSchema }).strict(),
]);
export type Target = z.infer<typeof TargetSchema>;

export const SendRequestSchema = z.object({ line: z.string().max(400), repo: RepoSchema, target: TargetSchema }).strict();
export type SendRequest = z.infer<typeof SendRequestSchema>;

/** A runner's fleet, set or cleared by a workspace owner. */
export const FleetRequestSchema = z.object({ fleet: FleetSchema.nullable() }).strict();

/** A job, as the browser reads it. */
const JobSchema = z.object({
  id: IdSchema,
  line: z.string(),
  repo: RepoSchema,
  toRunner: IdSchema.nullable(),
  toFleet: FleetSchema.nullable(),
  /** The person who sent it (or made the key that did); null for a job the Omni app sent (PRD 2338). */
  sentBy: IdSchema.nullable(),
  sentByLogin: z.string().nullable(),
  /** The app that sent it when no person did (PRD 2338): only `omni-app`; null for a person's or a key's job. */
  sentByApp: z.enum(['omni-app']).nullable().optional(),
  /** The name of the API key that sent it (PRD 2022), or null for a person's; sentBy is then the key's maker. */
  sentByKey: z.string().nullable(),
  status: z.enum(JOB_STATUSES),
  runner: IdSchema.nullable(),
  cancelRequested: z.boolean(),
  logTail: z.string(),
  prUrl: z.string().nullable(),
  exitCode: z.number().int().nullable(),
  reason: z.string().nullable(),
  /** The tokens its runner reported (PRD 2102); null until one did. */
  tokens: TokenCountsSchema.nullable().optional(),
  /** The claims its runner released once it ended (PRD 2175); null when its report said none. */
  released: z.array(z.number().int()).nullable().optional(),
  /** Why its runner could not release its claims (PRD 2175); null when nothing failed. */
  releaseError: z.string().nullable().optional(),
  /** What it ended on (PRD 2223, 2255); null for a job without one, and for one whose questions were answered or dismissed. */
  outcome: z.enum(JOB_OUTCOMES).nullable().optional(),
  /** The PRD's slices merged out of all when it ended `stopped` (PRD 2375); null when its runner could not read the board. */
  slicesMerged: z.number().int().nullable().optional(),
  slicesTotal: z.number().int().nullable().optional(),
  /** The job it continues (PRD 2270): a `/omni:yolo-fix` queued once that job's answers were in; null for any other. */
  continues: IdSchema.nullable().optional(),
  queuedAt: z.string(),
  claimedAt: z.string().nullable(),
  runningAt: z.string().nullable(),
  endedAt: z.string().nullable(),
});
export type Job = z.infer<typeof JobSchema>;

/** A job a program's API key queued, as that key reads it (PRD 2022): the runner by its name. */
export type KeyJob = {
  id: string; line: string; repo: string; status: Job['status']; runner: string | null; prUrl: string | null;
  exitCode: number | null; reason: string | null; queuedAt: string; claimedAt: string | null; runningAt: string | null; endedAt: string | null;
};

/** What a key asks to send: a bug-fix line, for a repository, to a runner by name or a fleet, or to any. */
export type KeySend = { repo: string; line: string; runner?: string | undefined; fleet?: string | undefined };

export const JobReplySchema = z.object({ job: JobSchema });

/** `lines`' query: the lines after this sequence number (none: from the first). */
export const JobLinesQuerySchema = z.object({ after: z.coerce.number().int().min(0).default(0) }).strict();

/** One line of a job's live log, by its sequence number. */
const JobLineSchema = z.object({ seq: z.number().int().positive(), text: z.string() });

/** A read of a job's live log (PRD 1904): its status, at most 5,000 lines after `after` in order, `more`
 * when more follow, `first` the smallest sequence number the job still holds (null: none), and
 * `logTail` the job's tail only when it holds no line and has a tail (a runner from before PRD 1904),
 * null otherwise. */
export const JobLinesSchema = z.object({
  status: z.enum(JOB_STATUSES),
  lines: z.array(JobLineSchema).max(JOB_LINES_PAGE),
  more: z.boolean(),
  first: z.number().int().positive().nullable(),
  logTail: z.string().nullable(),
});
export type JobLines = z.infer<typeof JobLinesSchema>;

// ── A job's questions (PRD 2255) ────────────────────────────────────────────────

/** What a job may ask: 1 to 4 questions, each with 2 to 4 options, and a lead of at most 4,000 characters. */
const QUESTIONS_MAX = 4;
const OPTIONS_MIN = 2;
const OPTIONS_MAX = 4;
const LEAD_CHARS = 4_000;

/** The longest answer to one question, a free one included. */
export const ANSWER_CHARS = 2_000;

/** One option of a question: what it is, and what it changes. */
const QuestionOptionSchema = z.strictObject({ label: z.string().min(1).max(200), description: z.string().max(1_000) });

/** One question, in the file shape `omni ask question --file` reads (`kit/lib/ask/schema.ts`), with its limits. */
export const QuestionSchema = z.strictObject({
  question: z.string().min(1).max(1_000),
  header: z.string().min(1).max(200),
  options: z.array(QuestionOptionSchema).min(OPTIONS_MIN).max(OPTIONS_MAX),
  multiSelect: z.boolean(),
});
export type Question = z.infer<typeof QuestionSchema>;

/** What a running job asks (`omni runner ask`): the issue it works on, why it stopped, and its questions, each asked once. */
export const AskRequestSchema = z.strictObject({
  issue: IssueNumberSchema,
  lead: z.string().min(1).max(LEAD_CHARS),
  questions: z.array(QuestionSchema).min(1).max(QUESTIONS_MAX),
}).refine((asked) => new Set(asked.questions.map((question) => question.question)).size === asked.questions.length, { message: 'each question is asked once' });
export type AskRequest = z.infer<typeof AskRequestSchema>;

/** The answers a person sends: each question's text to its answer, a pick or a free one. The service checks that
 * every question has one. */
export const AnswerRequestSchema = z.strictObject({
  answers: z.record(z.string().min(1), z.string().min(1).max(ANSWER_CHARS)).refine((answers) => {
    const count = Object.keys(answers).length;
    return count >= 1 && count <= QUESTIONS_MAX;
  }, { message: 'one answer per question' }),
});
export type AnswerRequest = z.infer<typeof AnswerRequestSchema>;

/** Where a job's questions stand: open, answered (the resume job queued) or dismissed. */
const QUESTION_STATES = ['open', 'answered', 'dismissed'] as const;

/** A job's questions, as the routes answer them: the questions, and once someone acted, the answers, who closed
 * them (by id and GitHub login), when, and the job that resumes the run. */
export const JobQuestionsSchema = z.object({
  job: IdSchema,
  issue: IssueNumberSchema,
  lead: z.string(),
  questions: z.array(QuestionSchema),
  state: z.enum(QUESTION_STATES),
  answers: z.record(z.string(), z.string()).nullable(),
  by: IdSchema.nullable(),
  byLogin: z.string().nullable(),
  at: z.string().nullable(),
  resume: IdSchema.nullable(),
});
export type JobQuestions = z.infer<typeof JobQuestionsSchema>;

/** A runner's state: online, busy when every slot holds a job, offline after 90 s of silence. */
const RunnerStateSchema = z.enum(['online', 'busy', 'offline']);
export type RunnerState = z.infer<typeof RunnerStateSchema>;

/** A runner, as the browser reads it. */
const RunnerSchema = z.object({
  id: IdSchema,
  name: RunnerNameSchema,
  owner: IdSchema,
  fleet: FleetSchema.nullable(),
  slots: z.number().int(),
  used: z.number().int(),
  repos: z.array(RepoSchema),
  version: z.string(),
  lastSeenAt: z.string(),
  state: RunnerStateSchema,
  /** Its last health report (PRD 2102); null for a runner that never sent one. */
  health: RunnerHealthSchema.nullable().optional(),
  /** Its samples of the last hour, oldest first: on the Runners page's read only. */
  samples: z.array(RunnerSampleSchema).optional(),
});
export type Runner = z.infer<typeof RunnerSchema>;

export const RunnerReplySchema = z.object({ runner: RunnerSchema });

// ── The terminal's reads (PRD 2251) ─────────────────────────────────────────────

/** The runners' query: the repository the terminal is in, whose workspace's runners are read. */
export const RunnersQuerySchema = z.object({ repo: RepoSchema }).strict();

/** A PRD's jobs' query: the repository, and the PRD its jobs' lines name. */
export const PrdJobsQuerySchema = z.object({ repo: RepoSchema, prd: z.coerce.number().pipe(PrdNumberSchema) }).strict();

/** A runner, as the terminal reads it: what it needs to pick one and count its free slots. */
const KitRunnerSchema = RunnerSchema.pick({ id: true, name: true, fleet: true, state: true, used: true, slots: true, repos: true });
export type KitRunner = z.infer<typeof KitRunnerSchema>;

export const KitRunnersSchema = z.object({ runners: z.array(KitRunnerSchema) });

/** A PRD's job, as the terminal follows it: its status, its runner by name, its PR link, how it ended and when. */
const PrdJobSchema = JobSchema.pick({
  id: true, line: true, repo: true, status: true, prUrl: true, exitCode: true, reason: true, queuedAt: true, claimedAt: true, runningAt: true, endedAt: true,
}).extend({ runner: RunnerNameSchema.nullable(), outcome: z.enum(JOB_OUTCOMES).nullable() });
export type PrdJob = z.infer<typeof PrdJobSchema>;

export const PrdJobsSchema = z.object({ jobs: z.array(PrdJobSchema) });

/** The Runners page's read: the workspace's runners, each with its health and its last hour of samples,
 * its jobs (queued and running first, then the last 50 that ended), and what the viewer may do there. */
export type Board = { runners: Runner[]; jobs: Job[]; viewer: { id: string; owner: boolean; fleet: string | null } };

/** Why a call was refused, each with its status. */
export const RUNNER_REFUSALS = { malformed: 400, 'signed-out': 401, forbidden: 403, missing: 404, conflict: 409, unavailable: 503, database: 500 } as const;
export type RunnerRefusal = keyof typeof RUNNER_REFUSALS;

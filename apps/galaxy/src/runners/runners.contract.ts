// The runners' shapes (PRD 1830 s1; ADR-0095), as zod schemas the routes, the Runners page, Send to
// terminal and the kit's `omni runner` share. Browser-safe: zod only.
//
//   POST  /api/runners/register            runner  {name, slots, repos, version}            → {id, name, fleet}
//   GET   /api/runners/next?runner=<id>    runner  held up to 40 s                          → RunnerJob | 204
//   POST  /api/runners/jobs/<id>           runner  {status, logTail?, from?, lines?, prUrl?, exitCode?, reason?, tokens?} → {cancel}
//   POST  /api/runners/<id>/health         runner  HealthReport, every 15 s (PRD 2102)       → {at}
//   GET   /api/runners/jobs/<id>/lines?after=<seq>  browser                               → JobLines
//   POST  /api/runners/jobs                browser {line, repo, target}                      → {job}
//   POST  /api/runners/jobs/<id>/cancel    browser                                           → {job}
//   PATCH /api/runners/<id>                browser {fleet}                                   → {runner}
//
// A runner's routes take the kit's sign-in (a bearer access token, `omni signin` or a traded
// OMNI_TOKEN); the browser's take the session. A refusal is `{error}` in plain words (ADR-0029): 400 a
// malformed request or a line off the list, 401 signed out, 403 not allowed (a target outside the
// sender's fleet, a repository outside the workspace, a fleet set by a non-owner, a runner of someone
// else), 404 no such runner or job, 409 a job that has ended (a runner stops it) or a status that goes
// back, 503 no database here, 500 the database failed.
import { z } from 'zod';

/** The skills a runner may run: the ones the app copies that need no person typing and end on their own. */
export const RUNNER_SKILLS = ['yolo', 'yolo-fix', 'pr-care', 'do-work', 'wave', 'bug-fix', 'visual-fix', 'plan', 'pitch', 'prove'] as const;
export type RunnerSkill = (typeof RUNNER_SKILLS)[number];

/** The longest arguments a line may carry. */
const MAX_LINE_ARGS = 200;

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

const ARGS = /^[A-Za-z0-9 ._/:#-]*$/;
const LINE = /^\/omni:([a-z][a-z-]*)(?: (.*))?$/s;

/** A line's verdict: its skill and arguments, or why it is refused, in plain words. */
export type LineCheck = { ok: true; skill: RunnerSkill; args: string } | { ok: false; reason: string };

/** Whether `line` is one a runner may run: `/omni:<skill> <args>`, the skill on the list, the arguments
 * letters, digits, spaces and `._/:#-` only, 200 characters at most. The route checks it, and the runner
 * checks it again before it runs. */
export function checkLine(line: string): LineCheck {
  const match = LINE.exec(line);
  if (!match) return { ok: false, reason: 'A line reads `/omni:<skill> <arguments>`.' };
  const skill = RUNNER_SKILLS.find((listed) => listed === match[1]);
  if (!skill) return { ok: false, reason: `/omni:${match[1] ?? ''} is not a skill a runner runs: only ${RUNNER_SKILLS.join(', ')}.` };
  const args = match[2] ?? '';
  if (args.length > MAX_LINE_ARGS) return { ok: false, reason: `A line's arguments are ${String(MAX_LINE_ARGS)} characters at most.` };
  if (!ARGS.test(args)) return { ok: false, reason: 'A line\'s arguments are letters, digits, spaces and . _ / : # - only.' };
  return { ok: true, skill, args };
}

/** A line a runner may run, as a schema. */
const LineSchema = z.string().max(MAX_LINE_ARGS + 40).refine((line) => checkLine(line).ok, { message: 'not a line a runner runs' });

/** A repository, as `owner/name`. */
const RepoSchema = z.string().max(200).regex(/^[\w.-]+\/[\w.-]+$/);

/** A runner's name: unique in its workspace. */
const RunnerNameSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/);

/** A fleet, by its key (`public.teams.name`). */
const FleetSchema = z.string().min(1).max(40);

const IdSchema = z.uuid();

// ── The runner's routes ─────────────────────────────────────────────────────────

/** A runner registering, or registering again, by its name. */
export const RegisterRequestSchema = z.object({
  name: RunnerNameSchema,
  slots: z.number().int().min(1).max(8),
  repos: z.array(RepoSchema).min(1).max(50),
  version: z.string().max(40),
}).strict();
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const RegisterReplySchema = z.object({ id: IdSchema, name: RunnerNameSchema, fleet: FleetSchema.nullable() });
export type RegisterReply = z.infer<typeof RegisterReplySchema>;

/** `next`'s query: the runner asking. */
export const NextQuerySchema = z.object({ runner: IdSchema }).strict();

/** A job, as the runner that claimed it receives it: the sender's GitHub login, when they have one, goes
 * to the run as OMNI_SENT_BY. */
export const RunnerJobSchema = z.object({ id: IdSchema, line: LineSchema, repo: RepoSchema, sentBy: z.string().nullable() });
export type RunnerJob = z.infer<typeof RunnerJobSchema>;

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
}).strict().refine((report) => (report.from === undefined) === (report.lines === undefined), { message: 'from and lines come together' });
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
  sentBy: IdSchema,
  sentByLogin: z.string().nullable(),
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

/** The Runners page's read: the workspace's runners, each with its health and its last hour of samples,
 * its jobs (queued and running first, then the last 50 that ended), and what the viewer may do there. */
export type Board = { runners: Runner[]; jobs: Job[]; viewer: { id: string; owner: boolean; fleet: string | null } };

/** Why a call was refused, each with its status. */
export const RUNNER_REFUSALS = { malformed: 400, 'signed-out': 401, forbidden: 403, missing: 404, conflict: 409, unavailable: 503, database: 500 } as const;
export type RunnerRefusal = keyof typeof RUNNER_REFUSALS;

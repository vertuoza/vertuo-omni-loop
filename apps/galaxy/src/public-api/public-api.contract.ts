import { PrNumberSchema } from 'omni-loop/kit/lib/ids.ts';
import type { BugFixOutcome } from 'omni-loop/kit/lib/runner/log.ts';
import { z } from 'zod';
import { AnswerRequestSchema } from '../runners/runners.contract';

// The public API's contract (PRD 2022 s2, spec "The routes"; ADR-0095): what a program outside the loop
// sends /api/v1 with its workspace's key, and what it is answered. Each route validates with these zod 4
// schemas, described with `.meta()` for the OpenAPI reference. Safe for the browser.
//
//   GET /api/v1/prds?limit=&cursor=        200 {data: Prd[], next_cursor}
//   GET /api/v1/bug-fixes?limit=&cursor=   200 {data: BugFix[], next_cursor}
//   POST /api/v1/bug-fixes                 202 Job: queues `/omni:bug-fix <description>` on the runners (s4)
//   POST /api/v1/mega-bug-fixes            202 Job: queues `/omni:mega-bug-fix <description>` in a plan repository
//   GET /api/v1/jobs/{id}                  200 Job: a job a key of this workspace queued (s4), with what it did (PRD 2425 s3)
//   GET /api/v1/jobs/{id}/lines?limit=&cursor=  200 {data: {seq, text}[], next_cursor}: that job's lines, oldest first (PRD 2425 s4)
//   GET /api/v1/jobs/{id}/questions        200 Questions: the lead, the questions, the state, the answers once given, who closed them (PRD 2425 s6)
//   POST /api/v1/jobs/{id}/answers         202 Job: the resume job, queued as the job's key; 409 when the round is closed (PRD 2425 s6)
//   POST /api/v1/jobs/{id}/dismiss         200 Job: the questions closed with no answer and no job queued; 409 when closed (PRD 2425 s6)
//
// Every refusal answers one shape, `{error: {code, message}}`, with the status PUBLIC_API_ERRORS names.

const LIMIT_DEFAULT = 50;
export const LIMIT_MAX = 100;

/** A list's query: how many rows, and where the last page ended. */
export const ListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(LIMIT_MAX).default(LIMIT_DEFAULT)
    .meta({ description: `How many rows to answer, 1 to ${LIMIT_MAX}.`, example: 20 }),
  cursor: z.string().min(1).optional()
    .meta({ description: 'The `next_cursor` of the page before, to read the page after it.', example: 'WyJwcmRzIiwiMjAyNi0xMC0xNVQxMzo0MTo1MC40ODEyMzQrMDA6MDAiLCIwYjRjMWQyZS0zZjQwLTRhNWItOGM2ZC03ZThmOTBhMWIyYzMiXQ' }),
});
export type ListQuery = z.infer<typeof ListQuerySchema>;

const TimeSchema = z.string().meta({ description: 'When it was made, ISO 8601.', example: '2026-10-15T13:41:50.481+00:00' });

const LinksSchema = z.object({
  page: z.url().meta({ description: 'Its page on the Omni app.', example: 'https://www.omni-loop.xyz/prd/0b4c1d2e-3f40-4a5b-8c6d-7e8f90a1b2c3' }),
  issue: z.url().nullable().meta({ description: 'Its GitHub issue, or null when it has none.', example: 'https://github.com/acme/backend/issues/42' }),
});

/** Where a PRD is, the latest stage on its track; the stored stages of supabase/migrations/20261009090000_prd_stages.sql. */
export const PRD_STAGES = ['prd', 'inbox', 'building', 'outbox', 'shipped', 'retro'] as const;

export const PrdSchema = z.object({
  id: z.uuid(),
  ref: z.string().meta({ description: 'How the loop names it: `"42"` for a repository PRD, `"<product key>-<n>"` for a product PRD.', example: '42' }),
  number: z.number().int().positive().meta({ description: 'Its number: its issue on its repository, or its number on its product.', example: 42 }),
  title: z.string(),
  repo: z.string().nullable().meta({ description: 'Its home repository, `owner/name`; null for a product PRD.', example: 'acme/backend' }),
  product: z.object({ key: z.string().nullable(), name: z.string() }).nullable()
    .meta({ description: 'The product it is for, or null.', example: { key: 'mobile', name: 'Mobile app' } }),
  stage: z.enum(PRD_STAGES).nullable().meta({ description: 'Its latest stage, or null when none is known yet.', example: 'building' }),
  created_at: TimeSchema,
  links: LinksSchema,
}).meta({ description: 'A PRD of the workspace.' });
export type Prd = z.infer<typeof PrdSchema>;

export const BugFixSchema = z.object({
  id: z.uuid(),
  number: z.number().int().positive().meta({ description: 'Its GitHub issue’s number.', example: 548 }),
  title: z.string(),
  repo: z.string().meta({ description: 'Its repository, `owner/name`.', example: 'acme/backend' }),
  created_at: TimeSchema,
  links: LinksSchema,
}).meta({ description: 'A bug fix of the workspace.' });
export type BugFix = z.infer<typeof BugFixSchema>;

const NextCursorSchema = z.string().nullable()
  .meta({ description: 'Pass it as `cursor` to read the next page; null on the last page.' });

export const PrdListSchema = z.object({ data: z.array(PrdSchema), next_cursor: NextCursorSchema });
export type PrdList = z.infer<typeof PrdListSchema>;

export const BugFixListSchema = z.object({ data: z.array(BugFixSchema), next_cursor: NextCursorSchema });
export type BugFixList = z.infer<typeof BugFixListSchema>;

/** The skill a bug fix runs. */
export const BUG_FIX = '/omni:bug-fix';

/** The longest description a bug fix starts with: what the runners' 200-character line leaves after
 * `/omni:bug-fix `, so a line the app queues is always one a runner runs. */
export const DESCRIPTION_MAX = 200 - BUG_FIX.length - 1;

/** What starts a bug fix: the repository, what is wrong, and optionally where it runs. */
export const StartBugFixSchema = z.object({
  repo: z.string().max(200).regex(/^[\w.-]+\/[\w.-]+$/, 'owner/name')
    .meta({ description: 'The repository to fix, `owner/name`. It must be one of the workspace and on the key’s allow-list.', example: 'acme/backend' }),
  description: z.string().min(1).max(DESCRIPTION_MAX)
    .meta({ description: `What is wrong, 1 to ${DESCRIPTION_MAX} characters of letters, digits, spaces and . _ / : # - only: after \`/omni:bug-fix \`, the runners’ 200-character line.`, example: 'Issue 548 the invoice total is off by a cent' }),
  runner: z.string().min(1).max(40).optional()
    .meta({ description: 'The name of the runner to run it on. Send at most one of `runner` and `fleet`; neither means any runner of the workspace.', example: 'mac-mini-office' }),
  fleet: z.string().min(1).max(40).optional()
    .meta({ description: 'The key of the fleet whose runners may run it.', example: 'comets' }),
});
export type StartBugFix = z.infer<typeof StartBugFixSchema>;

/** The skill a mega bug fix runs, in the plan repository. */
export const MEGA_BUG_FIX = '/omni:mega-bug-fix';

/** The longest description a mega bug fix starts with: what the runners' 200-character line leaves after
 * `/omni:mega-bug-fix `, so a line the app queues is always one a runner runs. */
export const MEGA_DESCRIPTION_MAX = 200 - MEGA_BUG_FIX.length - 1;

/** A word that starts with `--` is a flag of the skill (`--product` would make it a product's bug, `--prd`
 * would link a PRD): the route starts the bug fix of a plan repository, and nothing else. */
const FLAG = /(?:^|\s)--/;

/** What starts a mega bug fix: the plan repository, the bug or its issue there, and optionally where it
 * runs. Strict: a field this server does not know is refused, never ignored. */
export const StartMegaBugFixSchema = z.strictObject({
  repo: z.string().max(200).regex(/^[\w.-]+\/[\w.-]+$/, 'owner/name')
    .meta({ description: 'The plan repository, `owner/name`: one a product of the workspace names as its plan repository, and on the key’s allow-list.', example: 'acme/plan' }),
  description: z.string().min(1).max(MEGA_DESCRIPTION_MAX).refine((text) => !FLAG.test(text), 'no --flag')
    .meta({
      description: `The bug’s issue in the plan repository (its URL, \`#612\` or \`612\`), or what is wrong, 1 to ${String(MEGA_DESCRIPTION_MAX)} characters of letters, digits, spaces and . _ / : # - only, and no word starting with \`--\`.`,
      example: 'https://github.com/acme/plan/issues/612',
    }),
  runner: z.string().min(1).max(40).optional()
    .meta({ description: 'The name of the runner to run it on: one that holds a checkout of the plan repository. Send at most one of `runner` and `fleet`; neither means any runner of the workspace.', example: 'mac-mini-office' }),
  fleet: z.string().min(1).max(40).optional()
    .meta({ description: 'The key of the fleet whose runners may run it.', example: 'comets' }),
});
export type StartMegaBugFix = z.infer<typeof StartMegaBugFixSchema>;

const JOB_STATUSES = ['queued', 'claimed', 'running', 'done', 'failed', 'cancelled'] as const;

const MaybeTimeSchema = z.string().nullable().meta({ description: 'When it happened, ISO 8601, or null while it has not.', example: '2026-10-15T13:42:10.000+00:00' });

type Underscored<S extends string> = S extends `${infer Head}-${infer Tail}` ? `${Head}_${Underscored<Tail>}` : S;

/** How a bug fix or a mega bug fix ended, in the words of its log with an underscore for each hyphen (PRD 2425). */
export const API_OUTCOMES = ['pr_opened', 'already_fixed', 'need_human', 'needs_brainstorm', 'not_a_bug', 'stuck', 'blocked'] as const satisfies readonly Underscored<BugFixOutcome>[];

/** A pull request a job opened: its link, the repository it is in and its number there. */
const PullRequestSchema = z.object({
  url: z.url().meta({ description: 'The pull request’s link.', example: 'https://github.com/acme/backend/pull/549' }),
  repo: z.string().meta({ description: 'The repository it is in, `owner/name`.', example: 'acme/backend' }),
  number: PrNumberSchema.meta({ description: 'Its number in that repository.', example: 549 }),
});

const JOB_ID_EXAMPLE = '0b4c1d2e-3f40-4a5b-8c6d-7e8f90a1b2c3';

/** A runner job a key queued, as the key follows it. */
export const JobSchema = z.object({
  id: z.uuid(),
  line: z.string().meta({ description: 'The line the runner runs.', example: '/omni:bug-fix Issue 548 the invoice total is off by a cent' }),
  repo: z.string().meta({ example: 'acme/backend' }),
  status: z.enum(JOB_STATUSES).meta({ description: 'queued, claimed, running, then done, failed or cancelled.', example: 'running' }),
  runner: z.string().nullable().meta({ description: 'The name of the runner that took it, or null while it is queued.', example: 'mac-mini-office' }),
  pr_url: z.string().nullable().meta({ description: 'The pull request it opened, or null. A person merges it; the job never does.', example: 'https://github.com/acme/backend/pull/549' }),
  exit_code: z.number().int().nullable().meta({ description: 'How the run ended, 0 on success, or null while it runs.', example: 0 }),
  reason: z.string().nullable().meta({ description: 'Why it failed or ended, or null.', example: 'runner lost' }),
  queued_at: TimeSchema,
  claimed_at: MaybeTimeSchema,
  running_at: MaybeTimeSchema,
  ended_at: MaybeTimeSchema,
  outcome: z.enum(API_OUTCOMES).nullable().meta({
    description: 'How a bug fix or a mega bug fix ended: `pr_opened`, `already_fixed`, `need_human`, `needs_brainstorm`, `not_a_bug`, `stuck` or `blocked`. null while it runs, when it failed, and when its runner reported none (a runner from before it did).',
    example: 'pr_opened',
  }),
  fixed_by: z.url().nullable().meta({ description: 'With `already_fixed` only: the pull request the bug fix proved had already fixed the bug. null otherwise.', example: 'https://github.com/acme/backend/pull/512' }),
  prs: z.array(PullRequestSchema).meta({ description: 'Every pull request the job opened, in the order it opened them (a mega bug fix: its target pull requests, then its record). Empty when it opened none; a failed or stuck job lists its draft here.' }),
  questions: z.object({
    state: z.enum(['open', 'answered', 'dismissed']).meta({ description: 'open until the questions are answered or dismissed.', example: 'open' }),
  }).nullable().meta({ description: 'The questions the job asked, or null when it asked none.' }),
  continues: z.uuid().nullable().meta({ description: 'The job this one carries on: the answer to its questions, or its relaunch. null for a job that carries none on.', example: JOB_ID_EXAMPLE }),
  continued_by: z.uuid().nullable().meta({ description: 'The newest job that carries this one on, or null when none does.', example: JOB_ID_EXAMPLE }),
  acting_for: z.string().nullable().meta({ description: 'Whom the key said it acted for when it queued the job, or null.', example: 'Jane D.' }),
  cancelled_by: z.object({
    key: z.string().meta({ description: 'The name of the API key that cancelled it.', example: 'QA dashboard' }),
    acting_for: z.string().nullable().meta({ description: 'Whom that key said it acted for, or null.', example: 'Jane D.' }),
  }).nullable().meta({ description: 'The API key that cancelled the job, or null when no key did.' }),
  log_tail: z.string().nullable().meta({ description: 'The last lines of the job’s log, or null while it holds none.', example: '13:49:58 PR: https://github.com/acme/backend/pull/549' }),
}).meta({ description: 'A runner job a key queued.' });
export type ApiJob = z.infer<typeof JobSchema>;

/** One line of a job's log. */
const JobLineSchema = z.object({
  seq: z.number().int().positive().meta({ description: 'Its number in the job’s log, from 1, in the order the job wrote it.', example: 12 }),
  text: z.string().meta({ description: 'The line, as the job wrote it.', example: '13:49:58 PR: https://github.com/acme/backend/pull/549' }),
});

/** A page of a job's lines, oldest first (PRD 2425 s4). */
export const JobLineListSchema = z.object({ data: z.array(JobLineSchema), next_cursor: NextCursorSchema })
  .meta({ description: 'A page of a job’s lines, oldest first.' });
export type JobLineList = z.infer<typeof JobLineListSchema>;

// ── A job's questions (PRD 2425 s6) ─────────────────────────────────────────────

/** The longest `acting_for`, in characters (the database's `char_length` bound). */
export const ACTING_FOR_MAX = 80;

/** Letters of any alphabet (with their marks, which a name in most of them needs), digits, spaces and `. _ ' @ - ·`. */
const ACTING_FOR_CHARS = /^[\p{L}\p{M}\p{Nd} ._'@·-]+$/u;

/** Whom a key says it acts for when it answers or dismisses: stored as given, shown beside the key's name. */
const ActingForSchema = z.string().min(1).max(ACTING_FOR_MAX).regex(ACTING_FOR_CHARS, 'letters of any alphabet, digits, spaces and . _ \' @ - · only');

const ACTING_FOR_META = {
  description: `Whom the key acts for, 1 to ${String(ACTING_FOR_MAX)} characters of letters of any alphabet, digits, spaces and . _ ' @ - · only. It is stored as given, never trimmed or changed, and the Runners page shows it beside the key’s name. Leave it out when the key acts for no one.`,
  example: 'Jane D.',
};

/** What a key answers a job's questions with: the answers as the page takes them, and whom it acts for. Strict: a field this server does not know is refused, never ignored. */
export const AnswerJobSchema = z.strictObject({
  answers: AnswerRequestSchema.shape.answers.meta({
    description: 'One answer to each question the job asked, and no other: each question’s text to its answer, a pick (an option’s label) or a free one of 1 to 2,000 characters. One to four answers.',
    example: { 'Which fix?': 'Guard the input' },
  }),
  acting_for: ActingForSchema.optional().meta(ACTING_FOR_META),
});
export type AnswerJob = z.infer<typeof AnswerJobSchema>;

/** What a key dismisses a job's questions with: nothing, or whom it acts for. Strict, as the answers are. */
export const DismissJobSchema = z.strictObject({ acting_for: ActingForSchema.optional().meta(ACTING_FOR_META) });
export type DismissJob = z.infer<typeof DismissJobSchema>;

/** One option of a question the job asked. */
const QuestionOptionSchema = z.object({
  label: z.string().meta({ description: 'What the option is: the text to answer with to pick it.', example: 'Guard the input' }),
  description: z.string().meta({ description: 'What it changes.', example: 'Check the tenant before the query' }),
});

/** One question a job asked. */
const QuestionSchema = z.object({
  question: z.string().meta({ description: 'The question. It is also the key of its answer.', example: 'Which fix?' }),
  header: z.string().meta({ description: 'Its short heading.', example: 'Fix' }),
  multi_select: z.boolean().meta({ description: 'Whether the question allows more than one pick.', example: false }),
  options: z.array(QuestionOptionSchema).meta({ description: 'Its two to four options. A free answer is allowed beside them.' }),
});

/** Who closed a round: an API key, by its name, and whom it said it acted for. */
const ClosedByKeySchema = z.strictObject({
  key: z.string().meta({ description: 'The name of the API key that closed the questions.', example: 'Support bot' }),
  acting_for: z.string().nullable().meta({ description: 'Whom that key said it acted for, or null.', example: 'Jane D.' }),
});

/** Who closed a round: a person, by their GitHub login (null when they have none). */
const ClosedByPersonSchema = z.strictObject({
  login: z.string().nullable().meta({ description: 'The GitHub login of the person who closed the questions, or null when they have none.', example: 'mo' }),
});

/** The questions a job asked, as a key reads them. */
export const QuestionsSchema = z.object({
  lead: z.string().meta({ description: 'Why the job stopped to ask.', example: 'The planning query fails for 31 tenants.' }),
  questions: z.array(QuestionSchema).meta({ description: 'The questions, one to four.' }),
  state: z.enum(['open', 'answered', 'dismissed']).meta({ description: 'open until someone answers or dismisses them.', example: 'open' }),
  answers: z.record(z.string(), z.string()).nullable().meta({ description: 'The answers, each question’s text to its answer, once given; null while the questions are open and when they were dismissed.', example: { 'Which fix?': 'Guard the input' } }),
  closed_by: z.union([ClosedByKeySchema, ClosedByPersonSchema]).nullable()
    .meta({ description: 'Who answered or dismissed them: `{key, acting_for}` for an API key, `{login}` for a person on the Runners page; null while they are open.' }),
}).meta({ description: 'The questions a job asked.' });
export type ApiQuestions = z.infer<typeof QuestionsSchema>;

/** Each error's status. */
export const PUBLIC_API_ERRORS = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  invalid_request: 422,
  internal: 500,
} as const;
export type PublicApiErrorCode = keyof typeof PUBLIC_API_ERRORS;

const ERROR_CODES = ['unauthorized', 'forbidden', 'not_found', 'conflict', 'invalid_request', 'internal'] as const satisfies readonly PublicApiErrorCode[];

export const PublicApiErrorSchema = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES),
    message: z.string().meta({ description: 'What went wrong, in plain words; a refused field is named first.', example: 'limit: a whole number from 1 to 100.' }),
  }),
}).meta({ description: 'Every refusal.' });

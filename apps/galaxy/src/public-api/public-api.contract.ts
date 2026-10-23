import { z } from 'zod';

// The public API's contract (PRD 2022 s2, spec "The routes"; ADR-0095): what a program outside the loop
// sends /api/v1 with its workspace's key, and what it is answered. Each route validates with these zod 4
// schemas, described with `.meta()` for the OpenAPI reference. Safe for the browser.
//
//   GET /api/v1/prds?limit=&cursor=        200 {data: Prd[], next_cursor}
//   GET /api/v1/bug-fixes?limit=&cursor=   200 {data: BugFix[], next_cursor}
//   POST /api/v1/bug-fixes                 202 Job: queues `/omni:bug-fix <description>` on the runners (s4)
//   POST /api/v1/mega-bug-fixes            202 Job: queues `/omni:mega-bug-fix <description>` in a plan repository
//   GET /api/v1/jobs/{id}                  200 Job: a job a key of this workspace queued (s4)
//
// Every refusal answers one shape, `{error: {code, message}}`, with the status PUBLIC_API_ERRORS names.
// A key that holds a GitHub App (PRD 2433) is also refused at send, nothing queued, with 422
// `github_app_not_installed` (its App is not installed on the repository) or `github_app_permissions` (its
// installation holds no write access to contents, pull_requests or issues).

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
}).meta({ description: 'A runner job a key queued.' });
export type ApiJob = z.infer<typeof JobSchema>;

/** Each error's status. */
export const PUBLIC_API_ERRORS = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  invalid_request: 422,
  github_app_not_installed: 422,
  github_app_permissions: 422,
  internal: 500,
} as const;
export type PublicApiErrorCode = keyof typeof PUBLIC_API_ERRORS;

const ERROR_CODES = [
  'unauthorized', 'forbidden', 'not_found', 'invalid_request', 'github_app_not_installed', 'github_app_permissions', 'internal',
] as const satisfies readonly PublicApiErrorCode[];

export const PublicApiErrorSchema = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES).meta({
      description: 'Why it was refused: `unauthorized`, `forbidden`, `not_found`, `invalid_request`, `github_app_not_installed` (the GitHub App attached to the key is not installed on the repository) `github_app_permissions` (its installation holds no write access to `contents`, `pull_requests` or `issues`) or `internal`.',
      example: 'github_app_not_installed',
    }),
    message: z.string().meta({ description: 'What went wrong, in plain words; a refused field is named first.', example: 'limit: a whole number from 1 to 100.' }),
  }),
}).meta({ description: 'Every refusal.' });

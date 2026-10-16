import { z } from 'zod';

// The public API's contract (PRD 2022 s2, spec "The routes"; ADR-0095): what a program outside the loop
// sends /api/v1 with its workspace's key, and what it is answered. Each route validates with these zod 4
// schemas, described with `.meta()` for the OpenAPI reference. Safe for the browser.
//
//   GET /api/v1/prds?limit=&cursor=        200 {data: Prd[], next_cursor}
//   GET /api/v1/bug-fixes?limit=&cursor=   200 {data: BugFix[], next_cursor}
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

/** Each error's status. */
export const PUBLIC_API_ERRORS = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  invalid_request: 422,
  internal: 500,
} as const;
export type PublicApiErrorCode = keyof typeof PUBLIC_API_ERRORS;

const ERROR_CODES = ['unauthorized', 'forbidden', 'not_found', 'invalid_request', 'internal'] as const satisfies readonly PublicApiErrorCode[];

export const PublicApiErrorSchema = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES),
    message: z.string().meta({ description: 'What went wrong, in plain words; a refused field is named first.', example: 'limit: a whole number from 1 to 100.' }),
  }),
}).meta({ description: 'Every refusal.' });

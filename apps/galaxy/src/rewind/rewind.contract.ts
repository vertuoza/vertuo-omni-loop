// The rewind's two calls and what the Main tab shows of a finding (PRD 2410, s5), as zod schemas the
// controller reads and answers with, and the kit's `omni rewind` sends. Browser-safe: zod only.
//
//   GET  /api/rewind/facts?repo=<owner/name>&prd=<n>
//     → 200 {watches, breaks, findings}: the PRD's watch on main per repository, each break, and the
//       findings already proposed, as the signed-in caller reads them
//   POST /api/rewind/findings {repo, prd, findings: [{check, origin, happened, evidence, fix}]}
//     → 200 {added}: each finding proposed, for a member to approve or reject
//
// Both answer a signed-in member of the PRD's workspace only (the terminal's sign-in). A refusal is
// `{error}` in plain words (ADR-0029): 400 a malformed body or query, naming the finding, 401 signed out,
// 403 not a member, 404 no watch for the PRD, 409 a finding already proposed, 413 too large, 500 the
// database failed, 503 no database here.
import { z } from 'zod';
import { PrdNumberSchema } from 'omni-loop/kit/lib/ids.ts';
import { RewindFindingSchema, REWIND_CHECKS, REWIND_ORIGINS } from 'omni-loop/kit/lib/rewind/findings.ts';

const REPO = /^[\w.-]+\/[\w.-]+$/;

export const FactsQuerySchema = z.strictObject({
  repo: z.string().trim().max(200).regex(REPO, 'the repository as owner/name'),
  prd: z.coerce.number().pipe(PrdNumberSchema),
});

export const PushBodySchema = z.strictObject({
  repo: z.string().trim().max(200).regex(REPO, 'the repository as owner/name'),
  prd: PrdNumberSchema,
  findings: z.array(RewindFindingSchema).min(1).max(50),
});

/** The largest push: fifty findings of a few KiB each. */
export const MAX_PUSH_BYTES = 256 * 1024;

export const REWIND_REFUSALS = {
  malformed: 400, 'signed-out': 401, 'not-allowed': 403, missing: 404, duplicate: 409, database: 500, unavailable: 503,
} as const;
export type RewindRefusal = keyof typeof REWIND_REFUSALS;

/** A finding as the Main tab shows it. */
export const FindingStateSchema = z.enum(['proposed', 'approved', 'rejected']);
export type FindingState = z.infer<typeof FindingStateSchema>;

export type FindingView = {
  id: string;
  check: string;
  origin: string;
  happened: string;
  evidence: string[];
  fix: string;
  state: FindingState;
  reason: string | null;
};

/** What each check is called on the page. */
export const CHECK_LABELS: Readonly<Record<(typeof REWIND_CHECKS)[number], string>> = {
  main: 'The break itself', reviews: 'Reviews', ci: 'CI', bodies: 'Pull request bodies', waves: 'Waves', plan: 'Plan', spec: 'Spec and answers', knowledge: 'Knowledge',
};

/** Where each origin is named on the page. */
export const ORIGIN_LABELS: Readonly<Record<(typeof REWIND_ORIGINS)[number], string>> = {
  repository: 'The repository', 'omni-setup': 'The Omni setup', knowledge: 'Knowledge nobody wrote down',
};

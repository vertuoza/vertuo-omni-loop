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
import { PrdNumberSchema, PrNumberSchema, type PrdNumber, type PrNumber } from 'omni-loop/kit/lib/ids.ts';
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
  malformed: 400, 'signed-out': 401, 'not-allowed': 403, missing: 404, duplicate: 409, decided: 409, recorded: 409, unapproved: 409, unshareable: 422, database: 500, unavailable: 503,
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
  /** Who decided it, by their GitHub login (PRD 2410, s7); null while proposed, or when the login is unknown. */
  decidedBy: string | null;
  /** When it was decided; null while proposed. */
  decidedAt: string | null;
  /** What `/omni:rewind-apply` did with it once approved (PRD 2498, s2); null until recorded, and never rewritten. */
  outcome: FindingOutcome | null;
};

/** An approved finding's outcome: the pull request that proposes the rule (`url` null when it cannot be linked),
 * the rule that already says it, or the question asked. */
export type FindingOutcome =
  | { kind: 'proposed'; pr: PrNumber; url: string | null }
  | { kind: 'already'; rule: string }
  | { kind: 'asks'; question: string };

// ── A member's decision (PRD 2410, s7) ──────────────────────────────────────────────────────────────────
//
//   POST /api/rewind/findings/<id>/approve            → 200 {state, followUp}: approved, and what Approve sent
//   POST /api/rewind/findings/<id>/reject {reason?}   → 200 {state, followUp: null}: rejected, with its reason
//
// The page's session only: a request carrying a bearer token is refused 403, since a decision is a
// member's on the PRD page. 400 a malformed body, 401 signed out, 403 not a member, 404 no such finding,
// 409 already decided, 422 an Omni-setup finding that names the workspace's repository, 500, 503.

/** A finding's decision: approve, or reject. */
export type Verdict = 'approve' | 'reject';

/** The route that decides finding `id`. */
export const findingRoute = (id: string, verdict: Verdict): string => `/api/rewind/findings/${encodeURIComponent(id)}/${verdict}`;

/** A finding's id, as the route names it. */
export const FindingIdSchema = z.uuid();

/** The longest decision body, in bytes: a reason of one line. */
export const MAX_DECIDE_BYTES = 4 * 1024;

/** A decision's body: a Reject's optional reason, one line of at most 500 characters; an Approve's is empty. */
export const DecideBodySchema = z.strictObject({
  reason: z.string().trim().max(500).regex(/^[^\n\r]*$/, 'one line').optional(),
});

/** A finding a member may decide: what the card shows, and whose it is. */
export type DecidableFinding = FindingView & { workspace: string; repository: string; prd: PrdNumber };

/** Why the database refused a decision: no such finding, already decided, or not a member. */
export type DecisionRefusal = 'missing' | 'decided' | 'not-member';

/** What Approve sent, in the words the card shows: done, or why not and what to run instead. */
export type FollowUp = { done: boolean; words: string; link: string | null };

/** A decision's answer: the finding's state, and what Approve sent (none on a Reject). */
export type DecisionReply = { state: 'approved' | 'rejected'; followUp: FollowUp | null };

/** What each check is called on the page. */
export const CHECK_LABELS: Readonly<Record<(typeof REWIND_CHECKS)[number], string>> = {
  main: 'The break itself', reviews: 'Reviews', ci: 'CI', bodies: 'Pull request bodies', waves: 'Waves', plan: 'Plan', spec: 'Spec and answers', knowledge: 'Knowledge',
};

/** Where each origin is named on the page. */
export const ORIGIN_LABELS: Readonly<Record<(typeof REWIND_ORIGINS)[number], string>> = {
  repository: 'The repository', 'omni-setup': 'The Omni setup', knowledge: 'Knowledge nobody wrote down',
};

// ── An approved finding's outcome (PRD 2498, s2) ───────────────────────────────────────────────────────
//
//   POST /api/rewind/findings/<id>/outcome {outcome, pr?, note?} → 200 {outcome}: recorded, once
//
// `omni rewind outcome` sends it with the terminal's sign-in: an agent link or a member of the finding's
// workspace; the database function checks which. `proposed` carries the pull request, `already` the rule
// (one line), `asks` the question. 400 a malformed body or a value out of shape, 401 signed out, 403 not a
// member, 404 no such finding, 409 the finding is not approved or already has an outcome (never rewritten,
// BR-PRODUCT-12), 500, 503.

const OUTCOMES = ['proposed', 'already', 'asks'] as const;

/** The longest note: a question. A rule that already says it is one line of 200 at most. */
const OUTCOME_NOTE_MAX = 2000;

export const OutcomeBodySchema = z.strictObject({
  outcome: z.enum(OUTCOMES),
  pr: PrNumberSchema.optional(),
  note: z.string().trim().min(1).max(OUTCOME_NOTE_MAX).optional(),
});
export type OutcomeBody = z.infer<typeof OutcomeBodySchema>;

/** The largest outcome body, in bytes. */
export const MAX_OUTCOME_BYTES = 8 * 1024;

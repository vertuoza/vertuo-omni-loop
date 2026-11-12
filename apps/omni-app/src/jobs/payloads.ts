// The shapes of the data the App's jobs run on, and the check ids the webhook tells a re-run by. `/api/github`
// adds a job to the ledger for what a delivery asks, and the job's worker parses its payload through the schema
// here before it reads it (a payload comes back from the database), so a malformed one fails by the name of its
// field. One schema each; the check ids sit beside them, so the webhook, which reads no config, can tell a
// re-run of one check from another's.
import { z } from 'zod';
import { PrNumberSchema, PrdNumberSchema, type PrNumber } from 'omni-loop/kit/lib/ids.ts';

/**
 * The `external_id` every inbox check run carries, so the webhook, which reads no config, tells a
 * re-run of it from a re-run of the outbox check, whatever `ci.inboxContext` names it.
 */
export const INBOX_EXTERNAL_ID = 'omni-loop/inbox';

/** The `external_id` every approved check run carries, so the webhook tells a re-run of it, whatever `ci.approvedContext` names it. */
export const APPROVED_EXTERNAL_ID = 'omni-loop/approved';

/** The `external_id` every budgets check run carries, so the webhook tells a re-run of it. */
export const BUDGETS_EXTERNAL_ID = 'omni-loop/budgets';

/** The name of the retro request `/api/github` builds for a merged pull request (PRD 72). */
export const RETRO_EVENT = 'omni-loop/retro.requested';

/** The installation and repository every payload carries. */
const SourceSchema = z.looseObject({
  installationId: z.number(),
  owner: z.string(),
  repo: z.string(),
  repository: z.string(),
});

/** A check's request: the pull request a check's job of the ledger runs on, at its head (PRD 2688). */
export const CheckRequestDataSchema = SourceSchema.extend({
  prNumber: PrNumberSchema,
  headSha: z.string(),
  trigger: z.string().optional(),
});

/** What the inbox and budgets checks read of a check's request: the installation, the pull request and its head. */
export const PullAtSchema = z.object({
  installationId: z.number(),
  owner: z.string().min(1),
  repo: z.string().min(1),
  prNumber: PrNumberSchema,
  headSha: z.string().min(1),
});

/** A check's job's payload, read through `schema`; or the error naming the job's kind and its first malformed field. */
export function checkPayloadOf<T>(schema: z.ZodType<T>, kind: string, raw: unknown): T {
  const parsed = schema.safeParse(raw);
  if (parsed.success) return parsed.data;
  const [issue] = parsed.error.issues;
  throw new Error(`The ${kind} job is malformed: ${issue?.path.join('.') || '(payload)'}: ${issue?.message ?? parsed.error.message}`);
}

/** The facts a red canon check run hides in its summary (./inbox-check/canon-actions.ts). */
const CanonFactsSchema = z.object({
  prd: PrdNumberSchema,
  persona: z.string().nullable(),
  claims: z.array(z.string()),
});

/** A click of a canon button (PRD 839). */
export const CanonActionRequestDataSchema = SourceSchema.extend({
  prNumber: PrNumberSchema,
  headSha: z.string().optional(),
  checkRunId: z.number().optional(),
  action: z.string(),
  facts: CanonFactsSchema,
});

export type CheckRequestData = z.infer<typeof CheckRequestDataSchema>;
/** A merged pull request, for the retro: a type only, as the retro parses its payload itself. */
export type RetroRequestData = z.infer<typeof SourceSchema> & { prNumber: PrNumber; mergeSha: string; mergedAt: string };
export type CanonFacts = z.infer<typeof CanonFactsSchema>;
export type CanonActionRequestData = z.infer<typeof CanonActionRequestDataSchema>;

export type RetroRequest = { name: string; data: RetroRequestData };

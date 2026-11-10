// The one Inngest client the omni-loop app sends and serves its events through. `/api/github` sends
// on it, the `retro` and `knowledge-harvest` functions, among others, are created on it, and `/api/inngest`
// serves it. The event key and the signing key come from the environment (`INNGEST_EVENT_KEY`,
// `INNGEST_SIGNING_KEY`), which the SDK reads itself; nothing here names a secret.
//
// Beside the client, the shape of the data of every event the webhook sends: one schema each, which
// a function parses `event.data` through before it reads it (an event comes back from Inngest over
// the network), so a malformed event fails by the name of its field.
//
// The pull-request checks are no longer Inngest's (PRD 2688): they run on the App's job ledger
// (./jobs/pr-checks.ts), whose payload is the check request below. Their shared event is sent no more.
import { Inngest } from 'inngest';
import { z } from 'zod';
import { PrNumberSchema, PrdNumberSchema, type PrNumber } from 'omni-loop/kit/lib/ids.ts';

export const APP_ID = 'omni-loop';

/**
 * The event the pull-request checks ran on until PRD 2688, sent by nothing now: a test proves no
 * function listens to it.
 */
export const OUTBOX_CHECK_EVENT = 'omni-loop/outbox.check.requested';

/**
 * The `external_id` every inbox check run carries, so the webhook, which reads no config, tells a
 * re-run of it from a re-run of the outbox check, whatever `ci.inboxContext` names it.
 */
export const INBOX_EXTERNAL_ID = 'omni-loop/inbox';

/** The `external_id` every approved check run carries, so the webhook tells a re-run of it, whatever `ci.approvedContext` names it. */
export const APPROVED_EXTERNAL_ID = 'omni-loop/approved';

/** The `external_id` every budgets check run carries, so the webhook tells a re-run of it. */
export const BUDGETS_EXTERNAL_ID = 'omni-loop/budgets';

/** The event `/api/github` sends for a merged pull request; the `retro` function qualifies it (PRD 72). */
export const RETRO_EVENT = 'omni-loop/retro.requested';

/**
 * The event `/api/github` sends for a merged pull request, beside the retro's; the `knowledge-harvest`
 * function qualifies it (PRD 82).
 */
export const HARVEST_EVENT = 'omni-loop/knowledge.harvest.requested';

export const inngest = new Inngest({ id: APP_ID });

/** The installation and repository every event carries. */
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
/** A merged pull request, for the retro: a type only, as the retro parses its event itself. */
export type RetroRequestData = z.infer<typeof SourceSchema> & { prNumber: PrNumber; mergeSha: string; mergedAt: string };
/** A merged pull request, for the knowledge harvest: a type only, as the harvest parses its event itself. */
export type HarvestRequestData = z.infer<typeof SourceSchema> & { prNumber: PrNumber };
export type CanonFacts = z.infer<typeof CanonFactsSchema>;
export type CanonActionRequestData = z.infer<typeof CanonActionRequestDataSchema>;

export type RetroRequest = { name: string; data: RetroRequestData };
export type HarvestRequest = { name: string; data: HarvestRequestData };
export type CanonActionRequest = { name: string; data: CanonActionRequestData };
/** Every event the webhook sends. */
export type AppEvent = RetroRequest | HarvestRequest | CanonActionRequest;

// The one Inngest client the omni-loop app sends and serves its events through. `/api/github` sends
// on it, the `outbox-check`, `inbox-check`, `retro` and `knowledge-harvest` functions are created on it, and `/api/inngest` serves it. The event key and
// the signing key come from the environment (`INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`), which the
// SDK reads itself; nothing here names a secret.
//
// Beside the client, the shape of the data of every event the webhook sends: one schema each, which
// a function parses `event.data` through before it reads it (an event comes back from Inngest over
// the network), so a malformed event fails by the name of its field.
import { Inngest } from 'inngest';
import { z } from 'zod';

export const APP_ID = 'omni-loop';

/** The event `/api/github` sends for a handled pull request or a check run's re-run. */
export const OUTBOX_CHECK_EVENT = 'omni-loop/outbox.check.requested';

/**
 * The event `/api/github` sends when a person re-runs an inbox check run (PRD 675). Every other time,
 * the `inbox-check` function runs on the outbox check's own event, which it also listens to.
 */
export const INBOX_CHECK_EVENT = 'omni-loop/inbox.check.requested';

/**
 * The `external_id` every inbox check run carries, so the webhook, which reads no config, tells a
 * re-run of it from a re-run of the outbox check, whatever `ci.inboxContext` names it.
 */
export const INBOX_EXTERNAL_ID = 'omni-loop/inbox';

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

/** A check's event data: the outbox check's, and the inbox check's re-run. */
export const CheckRequestDataSchema = SourceSchema.extend({
  prNumber: z.number(),
  headSha: z.string(),
  trigger: z.string().optional(),
});

/** A merged pull request, for the retro. */
const RetroRequestDataSchema = SourceSchema.extend({
  prNumber: z.number(),
  mergeSha: z.string(),
  mergedAt: z.string(),
});

/** A merged pull request, for the knowledge harvest. */
const HarvestRequestDataSchema = SourceSchema.extend({ prNumber: z.number() });

/** The facts a red canon check run hides in its summary (./inbox-check/canon-actions.ts). */
const CanonFactsSchema = z.object({
  prd: z.number(),
  persona: z.string().nullable(),
  claims: z.array(z.string()),
});

/** A click of a canon button (PRD 839). */
export const CanonActionRequestDataSchema = SourceSchema.extend({
  prNumber: z.number(),
  headSha: z.string().optional(),
  checkRunId: z.number().optional(),
  action: z.string(),
  facts: CanonFactsSchema,
});

/**
 * What a failure handler is handed: the original event under `event.data.event`, the final error
 * under `event.data.error`. Only what the handlers read of it.
 */
export const FailureEventDataSchema = z.looseObject({
  event: z.looseObject({ data: z.unknown() }),
  error: z.looseObject({ message: z.unknown() }).nullish(),
});

export type CheckRequestData = z.infer<typeof CheckRequestDataSchema>;
export type RetroRequestData = z.infer<typeof RetroRequestDataSchema>;
export type HarvestRequestData = z.infer<typeof HarvestRequestDataSchema>;
export type CanonFacts = z.infer<typeof CanonFactsSchema>;
export type CanonActionRequestData = z.infer<typeof CanonActionRequestDataSchema>;

export type CheckRequest = { name: string; data: CheckRequestData };
export type RetroRequest = { name: string; data: RetroRequestData };
export type HarvestRequest = { name: string; data: HarvestRequestData };
export type CanonActionRequest = { name: string; data: CanonActionRequestData };
/** Every event the webhook sends. */
export type AppEvent = CheckRequest | RetroRequest | HarvestRequest | CanonActionRequest;

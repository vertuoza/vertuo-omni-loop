// The one Inngest client the omni-loop app sends and serves its events through. `/api/github` sends
// on it, the `outbox-check`, `inbox-check`, `retro` and `knowledge-harvest` functions are created on it, and `/api/inngest` serves it. The event key and
// the signing key come from the environment (`INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`), which the
// SDK reads itself; nothing here names a secret.
import { Inngest } from 'inngest';

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

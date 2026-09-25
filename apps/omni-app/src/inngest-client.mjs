// The one Inngest client the omni-loop app sends and serves its events through. `/api/github` sends
// on it, the `outbox-check` function is created on it, and `/api/inngest` serves it. The event key and
// the signing key come from the environment (`INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`), which the
// SDK reads itself; nothing here names a secret.
import { Inngest } from 'inngest';

export const APP_ID = 'omni-loop';

/** The event `/api/github` sends for a handled pull request or a check run's re-run. */
export const OUTBOX_CHECK_EVENT = 'omni-loop/outbox.check.requested';

export const inngest = new Inngest({ id: APP_ID });

import { receiveOutbox } from '../../../src/outbox/api';
import { outboxDeps } from '../../../src/outbox/api-live';

// POST /api/outbox <the outbox the omni-loop App evaluated> → 200 {id, url, stale}: the latest outbox of
// a PRD's feature pull request, signed by the App (src/outbox/api.ts).
export const maxDuration = 60;

export function POST(request: Request) {
  return receiveOutbox(request, outboxDeps());
}

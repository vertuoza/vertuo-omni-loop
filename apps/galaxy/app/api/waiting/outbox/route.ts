import { waitingDeps } from '../../../../src/outbox-waiting/live';
import { waitingOutbox } from '../../../../src/outbox-waiting/outbox';

// GET /api/waiting/outbox → 200 {items, unread} | 401 {error}: the open human-action and high outbox
// items of the numbered dossiers the signed-in person opened (src/outbox-waiting/outbox.ts, PRD 499).
export const maxDuration = 60;

export function GET() {
  return waitingOutbox(waitingDeps());
}

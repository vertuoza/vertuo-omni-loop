import { startSend } from '../../../../src/outbox/send';
import { sendDeps } from '../../../../src/outbox/send-live';

// POST /api/outbox/send {dossier, picks} → 200 {send, authorize, dropped}: the reply the signed-in person's
// picks write, recorded as a send, and the address of GitHub's authorisation that posts it
// (src/outbox/send.ts).
export function POST(request: Request) {
  return startSend(request, sendDeps());
}

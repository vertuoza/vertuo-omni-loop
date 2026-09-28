import { readSend, startSend } from '../../../../src/outbox/send';
import { sendDeps } from '../../../../src/outbox/send-live';

// POST /api/outbox/send {dossier, picks} → 200 {send, authorize, dropped}: the reply the signed-in
// person's picks write, checked against a fresh read of the outbox, recorded as a send, and the address
// of GitHub's authorisation that posts it. GET /api/outbox/send?id=<send> → the send's outcome, for its
// owner's Outbox tab (src/outbox/send.ts, PRD 251 s11).
export function POST(request: Request) {
  return startSend(request, sendDeps());
}

export function GET(request: Request) {
  return readSend(request, sendDeps());
}

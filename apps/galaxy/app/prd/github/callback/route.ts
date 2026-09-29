import { finishSend } from '../../../../src/outbox/send';
import { sendDeps } from '../../../../src/outbox/send-live';

// Where GitHub sends the person back after authorising the omni-loop App to post their reply: the send
// is checked, the reply posted once as the person, the token dropped, the dossier's cached summary
// cleared, then back to the dossier's Outbox tab (src/outbox/send.ts, PRD 251 s11).
export function GET(request: Request) {
  return finishSend(request, sendDeps());
}

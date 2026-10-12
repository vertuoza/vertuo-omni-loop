import { finishSend } from '../../../../src/outbox/send';
import { sendDeps } from '../../../../src/outbox/send-live';
import { finishTick, isTickState } from '../../../../src/roadmap/tick/tick';
import { tickDeps } from '../../../../src/roadmap/tick/tick-live';

// Where GitHub sends the person back after authorising the omni-loop App to post their reply: the send
// is checked, the reply posted once as the person, the token dropped, the dossier's cached summary
// cleared, then back to the dossier's Outbox tab (src/outbox/send.ts, PRD 251 s11). A roadmap's Mark as
// done comes back here too, the one callback the App lists: its state is a tick's, so the tick is posted
// instead, then back to the roadmap's Prerequisites tab (src/roadmap/tick/tick.ts, PRD 1218 s7).
export function GET(request: Request) {
  return isTickState(request) ? finishTick(request, tickDeps()) : finishSend(request, sendDeps());
}

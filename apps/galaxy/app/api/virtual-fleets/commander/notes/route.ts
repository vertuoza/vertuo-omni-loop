import { postCommanderNote } from '../../../../../src/virtual-fleets/commander/commander.controller';
import { commanderDeps } from '../../../../../src/virtual-fleets/commander/commander.live';

// POST /api/virtual-fleets/commander/notes {workspace, fleet, note} → 200 {note}: a member deletes a line of a Virtual Fleet's
// notebooks, as themselves; the record keeps who and when, and the line leaves the Commander's memory
// (src/virtual-fleets/commander/commander.controller.ts, PRD 3107 s4). No model is asked.
export const maxDuration = 30;

export function POST(request: Request) {
  return postCommanderNote(request, commanderDeps());
}

import { supervisorDeps } from '../../../../src/supervisor/api/supervisor.live';
import { supervisorForget, supervisorMemory, supervisorRemember } from '../../../../src/supervisor/api/supervisor.controller';

// GET /api/supervisor/memory → 200 {notes}; POST → the seat writes a note; DELETE → an owner deletes a note or clears a
// scope (src/supervisor/api/supervisor.controller.ts, PRD omni-loop-34 s3).
export const maxDuration = 30;

export function GET(request: Request) {
  return supervisorMemory(request, supervisorDeps());
}

export function POST(request: Request) {
  return supervisorRemember(request, supervisorDeps());
}

export function DELETE(request: Request) {
  return supervisorForget(request, supervisorDeps());
}

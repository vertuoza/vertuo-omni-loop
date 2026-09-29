import { syncDeps } from '../../../../src/stages/sync/live';
import { syncStages } from '../../../../src/stages/sync/sync';

// POST /api/stages/sync, `Authorization: Bearer <STAGES_SYNC_SECRET>` → 200 {synced_at, repositories,
// skipped} | 401 | 500: every stage the workspaces' repositories show, recorded (src/stages/sync/sync.ts,
// PRD 587). Called every 15 minutes by .github/workflows/stages.yml. It reads every repository of every
// workspace, so it is given longer than the other routes.
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export function POST(request: Request) {
  return syncStages(request, syncDeps());
}

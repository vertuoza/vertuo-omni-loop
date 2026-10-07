import { syncDeps } from '../../../../src/stages/sync/live';
import { syncStages } from '../../../../src/stages/sync/sync';

// GET or POST /api/stages/sync, `Authorization: Bearer <STAGES_SYNC_SECRET>` → 200 {synced_at,
// repositories, skipped} | 401 | 500: every stage the workspaces' repositories show, recorded
// (src/stages/sync/sync.ts, PRD 587). Vercel Cron calls GET every 15 minutes (vercel.json), sending
// CRON_SECRET, which is set to the same value; POST is for a call by hand. It reads every repository of
// every workspace, so it is given longer than the other routes.
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return syncStages(request, syncDeps());
}

export const POST = GET;

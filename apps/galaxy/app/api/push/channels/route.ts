import { setChannelsRoute } from '../../../../src/push/api';
import { alertRouteDeps } from '../../../../src/push/live';

// POST /api/push/channels {push, email} → 200 {channels}: the signed-in person's two alert switches,
// Phone alerts and Email, saved from their profile page (src/push/api.ts, PRD 1322 s9).

export function POST(request: Request) {
  return setChannelsRoute(request, alertRouteDeps());
}

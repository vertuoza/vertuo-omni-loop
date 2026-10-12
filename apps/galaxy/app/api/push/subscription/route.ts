import { subscribeRoute, unsubscribeRoute } from '../../../../src/push/api';
import { alertRouteDeps } from '../../../../src/push/live';

// POST /api/push/subscription {endpoint, keys, label} → 200 {subscribed: true}: this device, subscribed
// to Web Push for the signed-in person; DELETE /api/push/subscription {endpoint} → 200 {subscribed:
// false}: removed. The profile page's Phone alerts switch (src/push/api.ts, PRD 1322 s9).

export function POST(request: Request) {
  return subscribeRoute(request, alertRouteDeps());
}

export function DELETE(request: Request) {
  return unsubscribeRoute(request, alertRouteDeps());
}

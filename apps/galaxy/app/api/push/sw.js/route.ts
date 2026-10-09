import { workerResponse } from '../../../../src/push/worker';

// GET /api/push/sw.js → the Omni page's service worker, allowed the whole site, which the Phone alerts
// switch registers so this device receives Web Push (src/push/worker.ts, PRD 1322 s9). The same for
// everyone, signed in or not: it holds nothing of anyone.

export const dynamic = 'force-static';

export function GET() {
  return workerResponse();
}

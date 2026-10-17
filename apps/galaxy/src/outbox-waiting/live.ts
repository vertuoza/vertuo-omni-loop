import 'server-only';
import { supabaseServer } from '../data/supabase-server';
import { loginOf } from '../nav/viewer';
import { prdOutboxStore } from '../stages/outbox/store';
import type { WaitingDeps } from './outbox';

// The outbox route's real deps: the signed-in person's own cookie session, which also reads the stored
// outboxes (prd_outbox, PRD 657 s5), so row-level security keeps them to the person's workspaces. PRD
// 1794 (s5): their GitHub login, as the app shell reads it, finds what the escalation record asks them.
export function waitingDeps(): WaitingDeps {
  return { db: supabaseServer, outbox: (db) => prdOutboxStore(db), login: loginOf };
}

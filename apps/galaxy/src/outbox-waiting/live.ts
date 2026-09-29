import 'server-only';
import { supabaseServer } from '../data/supabase-server';
import { prdOutboxStore } from '../stages/outbox/store';
import type { WaitingDeps } from './outbox';

// The outbox route's real deps: the signed-in person's own cookie session, which also reads the stored
// outboxes (prd_outbox, PRD 657 s5), so row-level security keeps them to the person's workspaces.
export function waitingDeps(): WaitingDeps {
  return { db: supabaseServer, outbox: (db) => prdOutboxStore(db) };
}

import 'server-only';
import { supabaseAs, supabaseEnv } from '../data/supabase-server';
import type { OutboxItemsDeps } from './outbox-items.controller';
import { outboxItemsRepository } from './outbox-items.repository';
import { outboxItemsService } from './outbox-items.service';

// A product PRD's outbox routes' real dependencies (PRD 1548 s7), for /api/outbox/items and
// /api/outbox/items/settle: a Supabase client per call, acting as the caller's access token (never a
// service key), so row-level security and the outbox RPCs decide what they read and write. Without
// Supabase configured (the demo galaxy) every call answers 503.

/** The outbox as the person whose access token `token` is. */
function asCaller(token: string) {
  const client = supabaseAs(token);
  return { auth: client.auth, service: outboxItemsService(outboxItemsRepository(client)) };
}

export function outboxItemsDeps(): OutboxItemsDeps {
  return { connect: supabaseEnv() ? asCaller : null, log: (line) => { console.error(line); } };
}

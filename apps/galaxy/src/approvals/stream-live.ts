import 'server-only';
import { supabaseAs, supabaseEnv } from '../data/supabase-server';
import { historyRepository } from './approvals.repository';
import type { StreamDeps } from './stream.controller';
import { PING_EVERY_MS } from './stream.service';

// The approval stream's real dependencies (PRD 1322 s3). It reads and follows as the caller's access
// token, never a service key, so row-level security decides what they see, Realtime included. It lives
// until 15 seconds before the function's limit, then says `reconnect`. Without Supabase configured (the
// demo galaxy) it answers 503.

const MARGIN_SECONDS = 15;

/** The stream's dependencies, for a function allowed `limitSeconds`. */
export function streamDeps(limitSeconds: number): StreamDeps {
  return {
    connect: supabaseEnv()
      ? (token) => {
          const client = supabaseAs(token);
          return { auth: client.auth, history: historyRepository(client, token) };
        }
      : null,
    pingMs: PING_EVERY_MS,
    lifetimeMs: Math.max(limitSeconds - MARGIN_SECONDS, 1) * 1000,
    log: (line) => { console.error(line); },
  };
}

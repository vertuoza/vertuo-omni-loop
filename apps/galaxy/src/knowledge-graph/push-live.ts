import 'server-only';
import { log } from 'vertuo-omni-plan/kit/lib/log/log.ts';
import { supabaseAs, supabaseEnv } from '../data/supabase-server';
import type { GraphPushDeps } from './push.controller';
import { graphPushRepository } from './push.repository';
import { graphPushService } from './push.service';

// The knowledge graph push's real dependencies (PRD 1798), for POST /api/knowledge/graphs: a Supabase
// client per call, acting as the caller's access token (never a service key), so the database decides
// who may push. Without Supabase configured (the demo galaxy) every call answers 503. A failure is one
// JSON log line (ADR-0102).

/** The push as the person whose access token `token` is. */
function asCaller(token: string) {
  const client = supabaseAs(token);
  return { auth: client.auth, service: graphPushService(graphPushRepository(client)) };
}

export function graphPushDeps(): GraphPushDeps {
  return {
    connect: supabaseEnv() ? asCaller : null,
    log: (message) => { log.error({ event: 'knowledge-graphs', outcome: 'failed', message }); },
  };
}

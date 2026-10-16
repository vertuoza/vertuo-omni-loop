import 'server-only';
import { log } from 'vertuo-omni-plan/kit/lib/log/log.ts';
import { supabaseAs, supabaseEnv } from '../data/supabase-server';
import type { KnowledgePacksDeps } from './knowledge-packs.controller';
import { knowledgePacksRepository } from './knowledge-packs.repository';
import { knowledgePacksService } from './knowledge-packs.service';

// The knowledge pack read's real dependencies (PRD 2011), for /api/knowledge-packs: a Supabase client per
// call, acting as the caller's access token (never a service key), so row-level security decides which
// packs they read. Without Supabase configured (the demo galaxy) every call answers 503. A failure is one
// JSON log line (ADR-0102).

/** The packs as the person whose access token `token` is. */
function asCaller(token: string) {
  const client = supabaseAs(token);
  return { auth: client.auth, service: knowledgePacksService(knowledgePacksRepository(client)) };
}

export function knowledgePacksDeps(): KnowledgePacksDeps {
  return {
    connect: supabaseEnv() ? asCaller : null,
    log: (message) => { log.error({ event: 'knowledge-packs', outcome: 'failed', message }); },
  };
}

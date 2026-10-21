import 'server-only';
import { log } from 'omni-loop/kit/lib/log/log.ts';
import { supabaseAs, supabaseEnv } from '../data/supabase-server';
import { knowledgeReads } from '../product-knowledge/product-knowledge.service';
import type { KnowledgeChangesDeps } from './knowledge-api.controller';
import { knowledgeApiRepository } from './knowledge-api.repository';
import { knowledgeApiService } from './knowledge-api.service';

// A terminal's knowledge change, its real dependencies (PRD 2268 s1), for /api/knowledge/changes: one
// Supabase client per call, acting as the caller's access token (never a service key, law N-PRODUCT-17),
// behind both this route's repository and the Knowledge tab's service, so the database checks who may and
// records each change as theirs. Without Supabase configured (the demo galaxy) every call answers 503. A
// failure is one JSON log line (ADR-0102).

/** The change as the person whose access token `token` is. */
function asCaller(token: string) {
  const client = supabaseAs(token);
  return { auth: client.auth, service: knowledgeApiService(knowledgeApiRepository(client), knowledgeReads(client)) };
}

export function knowledgeChangesDeps(): KnowledgeChangesDeps {
  return {
    connect: supabaseEnv() ? asCaller : null,
    log: (message) => { log.error({ event: 'knowledge-changes', outcome: 'failed', message }); },
  };
}

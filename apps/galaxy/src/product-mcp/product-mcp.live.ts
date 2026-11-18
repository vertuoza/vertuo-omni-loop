import 'server-only';
import { after } from 'next/server';
import { log } from 'omni-loop/kit/lib/log/log.ts';
import { serviceDb } from '../data/sign-in-live';
import { supabaseAs, supabaseEnv } from '../data/supabase-server';
import { serverEnv } from '../env';
import { queryEmbedClient } from './embed/client';
import type { ProductMcpDeps } from './product-mcp.controller';
import { knowledgeVectorsRepository, productMcpRepository, searchLogRepository, type MemberAccessRow } from './product-mcp.repository';
import { productMcpService } from './product-mcp.service';
import { accessCache } from './access-cache';

/** The accesses this server keeps, shared by every request it answers: the keys', and the members' (PRD 3007 s1). */
const kept = accessCache();
const members = accessCache<MemberAccessRow>();

// A product's MCP server's real dependencies (PRD 2707 s3), for /api/products/<key>/mcp: the rules over the
// service role's client (SUPABASE_SERVICE_ROLE_KEY, server only), since an API key is no person's session and
// product_mcp_for_key() is the service role's alone, as api_key_of() is for /api/v1 (public-api.live.ts).
// A client per request. Without Supabase or the service role key (the demo galaxy) every request answers 503.
// A failure is one JSON log line (ADR-0102), never the key.
//
// One cache for the whole server (bug #2954): a key's served access is kept a minute per key and product, by the
// key's hash, and checked against the database on every call before it is served (product-mcp.service.ts).
//
// The meaning search (PRD 2728 s5) calls the project's `embed` Edge Function with the same service role key,
// and reads the workspace's vectors on the same client.
//
// Each answered call is logged to mcp_search_log on the same client, through Next's after(): once the answer
// is sent (PRD omni-loop-6 s1).
//
// A member's kit sign-in (PRD 3007 s1) is checked at the Auth server by a client acting as its token, as every
// kit call is (src/ask/auth.ts); what they read is then asked on the service role's client, as a key's is.
export function productMcpDeps(): ProductMcpDeps {
  const supabase = supabaseEnv();
  const serviceRole = serverEnv().serviceRole;
  if (supabase === null || serviceRole === null) {
    return { service: null, signIn: null, log: (message) => { log.error({ event: 'product-mcp', outcome: 'failed', message }); } };
  }
  const db = serviceDb();
  return {
    service: productMcpService(productMcpRepository(db), kept, members),
    signIn: (token) => ({ auth: supabaseAs(token).auth }),
    log: (message) => { log.error({ event: 'product-mcp', outcome: 'failed', message }); },
    meaning: { embedder: queryEmbedClient({ url: supabase.url, serviceRoleKey: serviceRole.key }), vectors: knowledgeVectorsRepository(db) },
    searchLog: searchLogRepository(db),
    later: (task) => { after(task); },
  };
}

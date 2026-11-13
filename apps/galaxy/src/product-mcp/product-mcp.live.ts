import 'server-only';
import { after } from 'next/server';
import { log } from 'omni-loop/kit/lib/log/log.ts';
import { serviceDb } from '../data/sign-in-live';
import { supabaseEnv } from '../data/supabase-server';
import { serverEnv } from '../env';
import { queryEmbedClient } from './embed/client';
import type { ProductMcpDeps } from './product-mcp.controller';
import { knowledgeVectorsRepository, productMcpRepository, searchLogRepository } from './product-mcp.repository';
import { productMcpService } from './product-mcp.service';

// A product's MCP server's real dependencies (PRD 2707 s3), for /api/products/<key>/mcp: the rules over the
// service role's client (SUPABASE_SERVICE_ROLE_KEY, server only), since an API key is no person's session and
// product_mcp_for_key() is the service role's alone, as api_key_of() is for /api/v1 (public-api.live.ts).
// A client per request, nothing cached. Without Supabase or the service role key (the demo galaxy) every
// request answers 503. A failure is one JSON log line (ADR-0102), never the key.
//
// The meaning search (PRD 2728 s5) calls the project's `embed` Edge Function with the same service role key,
// and reads the workspace's vectors on the same client.
//
// Each answered call is logged to mcp_search_log on the same client, through Next's after(): once the answer
// is sent (PRD omni-loop-6 s1).
export function productMcpDeps(): ProductMcpDeps {
  const supabase = supabaseEnv();
  const serviceRole = serverEnv().serviceRole;
  if (supabase === null || serviceRole === null) {
    return { service: null, log: (message) => { log.error({ event: 'product-mcp', outcome: 'failed', message }); } };
  }
  const db = serviceDb();
  return {
    service: productMcpService(productMcpRepository(db)),
    log: (message) => { log.error({ event: 'product-mcp', outcome: 'failed', message }); },
    meaning: { embedder: queryEmbedClient({ url: supabase.url, serviceRoleKey: serviceRole.key }), vectors: knowledgeVectorsRepository(db) },
    searchLog: searchLogRepository(db),
    later: (task) => { after(task); },
  };
}

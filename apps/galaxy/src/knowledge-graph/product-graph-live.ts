import 'server-only';
import { log } from 'omni-loop/kit/lib/log/log.ts';
import { supabaseAs, supabaseEnv } from '../data/supabase-server';
import type { ProductGraphDeps } from './product-graph.controller';
import { productGraphRepository } from './product-graph.repository';
import { productGraphService } from './product-graph.service';

// The product graph's real dependencies (PRD 1798 s3), for GET /api/products/<key>/knowledge/graph: a
// Supabase client per call, acting as the caller's access token (never a service key), so row-level
// security decides which product, links, graphs and knowledge they read. Without Supabase configured (the
// demo galaxy) every call answers 503. A failure is one JSON log line (ADR-0102).

/** The read as the person whose access token `token` is. */
function asCaller(token: string) {
  const client = supabaseAs(token);
  return { auth: client.auth, service: productGraphService(productGraphRepository(client)) };
}

export function productGraphDeps(): ProductGraphDeps {
  return {
    connect: supabaseEnv() ? asCaller : null,
    log: (message) => { log.error({ event: 'knowledge-graphs', outcome: 'failed', message }); },
  };
}

import 'server-only';
import { log } from 'omni-loop/kit/lib/log/log.ts';
import { serviceDb } from '../data/sign-in-live';
import { supabaseEnv } from '../data/supabase-server';
import { serverEnv } from '../env';
import type { ProductMcpDeps } from './product-mcp.controller';
import { productMcpRepository } from './product-mcp.repository';
import { productMcpService } from './product-mcp.service';

// A product's MCP server's real dependencies (PRD 2707 s3), for /api/products/<key>/mcp: the rules over the
// service role's client (SUPABASE_SERVICE_ROLE_KEY, server only), since an API key is no person's session and
// product_mcp_for_key() is the service role's alone, as api_key_of() is for /api/v1 (public-api.live.ts).
// A client per request, nothing cached. Without Supabase or the service role key (the demo galaxy) every
// request answers 503. A failure is one JSON log line (ADR-0102), never the key.
export function productMcpDeps(): ProductMcpDeps {
  const configured = supabaseEnv() !== null && serverEnv().serviceRole !== null;
  return {
    service: configured ? productMcpService(productMcpRepository(serviceDb())) : null,
    log: (message) => { log.error({ event: 'product-mcp', outcome: 'failed', message }); },
  };
}

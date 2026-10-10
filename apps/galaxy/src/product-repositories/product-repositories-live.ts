import 'server-only';
import { supabaseAs, supabaseEnv } from '../data/supabase-server';
import type { ProductTargetsDeps } from './product-repositories.controller';
import { productRepositoriesRepository } from './product-repositories.repository';
import { productRepositoriesService } from './product-repositories.service';

// The product links' real dependencies (PRD 1364, s4), for /api/products/targets: a Supabase client per
// call, acting as the caller's access token (never a service key), so row-level security decides which
// repositories, products and links they read. Without Supabase configured (the demo galaxy) every call
// answers 503.
export function productTargetsDeps(): ProductTargetsDeps {
  const log = (line: string) => { console.error(line); };
  if (!supabaseEnv()) return { connect: null, log };
  return {
    connect: (token) => {
      const client = supabaseAs(token);
      return { auth: client.auth, service: productRepositoriesService(productRepositoriesRepository(client)) };
    },
    log,
  };
}

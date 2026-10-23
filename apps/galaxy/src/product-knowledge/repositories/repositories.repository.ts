import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { parseRows } from '../../data/parse-rows';

// The Repositories section's storage (PRD 2419 s1; ADR-0095), on the client it is given, the signed-in
// person's, so row-level security decides what it returns: the product's plan repository and the
// repositories linked to it (product_repositories), each as owner/name, lower case, as they are kept.
// No rule lives here.

const StoredProduct = z.object({ plan_repository: z.string().nullable() });
const StoredLink = z.object({ repository: z.string() });

/** What the product holds of repositories. */
export interface ProductRepositories {
  plan: string | null;
  repositories: string[];
}

/** The product's plan repository and repositories; null when the product cannot be read or is none of the caller's. */
export async function productRepositoriesOf(db: Pick<SupabaseClient, 'from'>, product: string): Promise<ProductRepositories | null> {
  const where = 'product-knowledge/repositories.repository';
  const [stored, links] = await Promise.all([
    db.from('products').select('plan_repository').eq('id', product),
    db.from('product_repositories').select('repository').eq('product_id', product).order('repository'),
  ]);
  if (stored.error || links.error) return null;
  const products = parseRows(StoredProduct, stored.data, `${where}: products`);
  const rows = parseRows(StoredLink, links.data, `${where}: product_repositories`);
  if (!products.ok || !rows.ok) return null;
  const [found] = products.value;
  if (!found) return null;
  return { plan: found.plan_repository, repositories: rows.value.map((row) => row.repository) };
}

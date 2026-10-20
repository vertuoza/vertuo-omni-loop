import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CONSTITUENT_COLUMNS, StoredConstituent } from '../../constituents/model';
import { parseRows } from '../../data/parse-rows';

// The product's constituents, read as the signed-in person (PRD 2240 s4): every line, removed ones
// included, with who created it and when.

/** Every line of the product, parsed; null when they cannot be read. */
export async function storedRowsOf(db: Pick<SupabaseClient, 'from'>, product: string): Promise<StoredConstituent[] | null> {
  const stored = await db.from('constituents').select(CONSTITUENT_COLUMNS).eq('product_id', product);
  if (stored.error) console.error(`product-knowledge: could not read the constituents (${stored.error.message})`);
  const parsed = parseRows(StoredConstituent, stored.data, 'product-knowledge/constituents-load: constituents');
  return parsed.ok && !stored.error ? parsed.value : null;
}

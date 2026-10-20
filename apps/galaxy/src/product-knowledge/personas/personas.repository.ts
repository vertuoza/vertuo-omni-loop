import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { PERSONA_COLUMNS, StoredPersona } from '../../business/personas';
import { parseRows } from '../../data/parse-rows';
import type { StoredAuthoredPersona } from './personas-section';

// The product's personas, read as the signed-in person (PRD 2240 s4): every persona, oldest first, with
// who created it and when.

const AuthoredPersona = StoredPersona.extend({ created_by: z.string().nullable(), created_at: z.string() });

const AUTHORED_COLUMNS = `${PERSONA_COLUMNS}, created_by, created_at`;

/** Every persona of the product, parsed; null when they cannot be read. */
export async function storedPersonasOf(db: Pick<SupabaseClient, 'from'>, product: string): Promise<StoredAuthoredPersona[] | null> {
  const stored = await db.from('personas').select(AUTHORED_COLUMNS).eq('product_id', product).order('ordinal');
  if (stored.error) console.error(`product-knowledge: could not read the personas (${stored.error.message})`);
  const parsed = parseRows(AuthoredPersona, stored.data, 'product-knowledge/personas-load: personas');
  return parsed.ok && !stored.error ? parsed.value : null;
}

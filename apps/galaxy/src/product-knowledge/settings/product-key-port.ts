import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '../../../../../supabase/database.types.ts';
import type { WriteSource } from '../constituents/knowledge-reader';
import { setKey } from './mcp-server.repository';
import type { KeyRefusal } from './product-key';

// The Product key card's write in the browser (PRD 2784 s1): product_set_key() called as the signed-in person,
// with the publishable key only; in the demo, nothing is written and the card only moves.

/** Sets the product's key; null when accepted, else why not. */
export const setProductKey = (source: WriteSource, product: string, key: string): Promise<KeyRefusal | null> =>
  source.kind === 'demo' ? Promise.resolve(null) : setKey(createBrowserClient<Database>(source.url, source.key), product, key);

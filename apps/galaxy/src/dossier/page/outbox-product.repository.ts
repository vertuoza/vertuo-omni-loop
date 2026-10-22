import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { orThrow, parseRows } from '../../data/parse-rows';
import { StoredProductItem, type ProductOutboxRows } from './outbox-product';

// The rows a product PRD's Outbox tab reads (PRD 2011 s15), as the signed-in member, so row-level security
// has the last word: the PRD's own product and number (dossiers, products) and its items with their
// settlements (outbox_items, outbox_settlements). A repository PRD has no product number: it reads none.

type Db = Pick<SupabaseClient, 'from'>;

const ITEM_COLUMNS = 'item, rank, repository, body, raised_at, outbox_settlements(verdict, basis, answer, channel, settler_login, settled_at)';
const WHERE = 'dossier/page/outbox-product.repository';

export const PrdKey = z.object({ product_seq: z.number().int().positive().nullable(), product_id: z.string().nullable() });
const ProductKey = z.object({ key: z.string().nullable() });

/** The PRD's number in its product and the product, by dossier. */
export const prdKeyOf = (db: Db, dossier: string) => db.from('dossiers').select('product_seq, product_id').eq('id', dossier);
/** A product's key. */
const productKeyOf = (db: Db, id: string) => db.from('products').select('key').eq('id', id);
/** The items of a dossier, oldest first, with their settlements. */
export const itemsOfDossier = (db: Db, dossier: string) =>
  db.from('outbox_items').select(ITEM_COLUMNS).eq('dossier_id', dossier).order('raised_at').order('item');

/** The rows of the tab of product PRD `dossier`; null when it is no product PRD, or they could not be read. */
export async function readProductOutbox(db: Db, dossier: string, title: string): Promise<ProductOutboxRows | null> {
  try {
    const prd = await prdKeyOf(db, dossier);
    if (prd.error) throw new Error(prd.error.message);
    const [key] = orThrow(parseRows(PrdKey, prd.data, `${WHERE}: dossiers`));
    if (key?.product_seq == null || key.product_id === null) return null;
    const [product, items] = await Promise.all([productKeyOf(db, key.product_id), itemsOfDossier(db, dossier)]);
    if (product.error) throw new Error(product.error.message);
    if (items.error) throw new Error(items.error.message);
    const productKey = orThrow(parseRows(ProductKey, product.data, `${WHERE}: products`))[0]?.key ?? null;
    if (productKey === null) return null;
    return {
      dossier, prdId: `${productKey}-${String(key.product_seq)}`, title, items: orThrow(parseRows(StoredProductItem, items.data, `${WHERE}: outbox_items`)),
    };
  } catch (error) {
    console.error(error);
    return null;
  }
}

// The Concepts list's product filter (PRD 2011 s16): the cards narrowed by the product the address
// asks for, each kept card carrying its product's name. The filter itself is src/product-filter/'s:
// it reads the cards as dossiers, so it is handed `{ id, workspace_id }` of each.
import type { ReactNode } from 'react';
import type { ProductFilterDb } from '../product-filter/product-filter.repository';
import type { ProductLabels } from '../product-filter/product-filter.service';
import type { ConceptCard, ConceptScope } from './list';

type Query = Readonly<Record<string, string | string[] | undefined>>;

type ListScope = (
  db: ProductFilterDb, rows: { id: string; workspace_id: string; kind: 'concept' }[], query: Query,
) => Promise<{ rows: { id: string }[]; above: ReactNode; labels: ProductLabels }>;

/** `scope`, the product filter of the list at /concepts, as the Concepts list takes it. */
export const withProducts = (scope: ListScope, query: Query): ConceptScope => async (db, cards) => {
  const { rows, above, labels } = await scope(db as ProductFilterDb, cards.map((c) => ({ id: c.id, workspace_id: c.workspaceId, kind: 'concept' as const })), query);
  const kept = new Set(rows.map((r) => r.id));
  return { cards: cards.filter((c) => kept.has(c.id)).map((c): ConceptCard => ({ ...c, product: labels.get(c.id)?.product ?? null })), above };
};

import type { ReactNode } from 'react';
import type { IdeasView } from '../ideas/source';
import type { ProductFilterDb } from './product-filter.repository';
import { PRODUCT_FILTER_WORDS, productFilterReads, scopeBoard, scopeDossiers, type ProductFilterView } from './product-filter.service';

// The product filter (PRD 1364 s12), drawn above /prd, /ideas, /bugs and /visual: a labelled row of
// links, All, each product, No product, the chosen one current. Plain links, no script: each one is the
// list's address with its other filters kept (product-filter.service.ts). Nothing at all when the list
// has no filter to draw; one muted line when the products could not be read. Its look:
// ./product-filter.css, imported by each list's page.

export function ProductFilter({ filter, unreadable }: { filter: ProductFilterView | null; unreadable: boolean }) {
  if (unreadable) return <p className="ask-hint product-filter-unreadable">{PRODUCT_FILTER_WORDS.unreadable}</p>;
  if (!filter) return null;
  return (
    <nav className="product-filter" aria-label={PRODUCT_FILTER_WORDS.label}>
      <span className="product-filter-label">{PRODUCT_FILTER_WORDS.label}</span>
      {filter.options.map((option) => (
        <a key={option.href} className="product-filter-pick" aria-current={option.current ? 'page' : undefined} href={option.href}>{option.label}</a>
      ))}
    </nav>
  );
}

type Query = Readonly<Record<string, string | string[] | undefined>>;

/** A list of dossiers at `path`, narrowed by the product its address asks for, as the signed-in person
 * reads it on `db`, with the filter to draw above it. */
export const productListScope = (path: string) =>
  async <T extends { id: string; workspace_id: string }>(db: ProductFilterDb, rows: T[], query: Query): Promise<{ rows: T[]; above: ReactNode }> => {
    const { rows: kept, filter, unreadable } = await scopeDossiers(productFilterReads(db), rows, query, path);
    return { rows: kept, above: <ProductFilter filter={filter} unreadable={unreadable} /> };
  };

/** A repository's ideas board at `path`, narrowed by product for a member of its workspace, as they read
 * it on `db`, with the filter to draw above it. */
export async function productBoardScope(db: ProductFilterDb, view: IdeasView, query: Query, path: string): Promise<{ view: IdeasView; above: ReactNode }> {
  const scoped = await scopeBoard(productFilterReads(db), view, query, path);
  return { view: scoped.view, above: <ProductFilter filter={scoped.filter} unreadable={scoped.unreadable} /> };
}

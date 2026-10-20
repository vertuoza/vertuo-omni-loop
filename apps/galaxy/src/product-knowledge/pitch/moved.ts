import { knowledgeTabHref } from '../product-knowledge.contract';

// Settings › Products moved into the product's Knowledge home (PRD 2240 s5): a product's Pitch settings
// are at /app/products/<id>/knowledge/pitch, and the two old addresses answer with a permanent redirect,
// the query kept (app/app/settings/products/route.ts and [id]/route.ts).

/** Where the products are listed. */
const PRODUCTS_LIST_PATH = '/app/products';

/** Where `/app/settings/products` goes: the same origin and query at the products list. */
export function productsMovedTo(url: URL): URL {
  const to = new URL(PRODUCTS_LIST_PATH, url);
  to.search = url.search;
  return to;
}

/** Where `/app/settings/products/<id>` goes: the product's Knowledge › Pitch, the query kept. */
export function pitchMovedTo(url: URL, id: string): URL {
  const to = new URL(`${knowledgeTabHref(id)}/pitch`, url);
  to.search = url.search;
  return to;
}

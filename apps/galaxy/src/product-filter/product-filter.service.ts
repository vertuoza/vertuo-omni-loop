import { lanesOf } from '../ideas/model';
import type { IdeasView } from '../ideas/source';
import { productFilterRepository, type ProductFilterDb, type ProductFilterRepository } from './product-filter.repository';

// The product filter of /prd, /ideas, /bugs and /visual (PRD 1364 s12, spec §4: "all, one product, no
// product"). `?product=` reads the choice: absent (or anything but `none` and an id) is all, `none` is
// no product, an id is that product. A list's rows are narrowed by the product their dossier or idea
// carries (dossiers.product_id, ideas.product_id, s2); a row whose product is not read carries none.
// Products are optional: a list whose workspaces have no product draws no filter, and narrows nothing
// unless the address asks for it. The filter is a row of links, All, each product, No product, each
// keeping the list's other filters. A board's filter is a member's only: a visitor never reads the
// workspace's products. A read that fails leaves the list whole and says so: never an error page.

type Query = Readonly<Record<string, string | string[] | undefined>>;

/** What a list is filtered by. */
export type ProductChoice = { kind: 'all' } | { kind: 'none' } | { kind: 'product'; id: string };

/** The query parameter, and its value for no product. */
const PRODUCT_PARAM = 'product';
const NO_PRODUCT = 'none';

/** The filter's words. */
export const PRODUCT_FILTER_WORDS = {
  label: 'Product',
  all: 'All',
  none: 'No product',
  unreadable: 'The products could not be read: this list is not narrowed by product.',
} as const;

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? '';

/** The choice the address asks for. */
export function readProductChoice(query: Query): ProductChoice {
  const value = one(query[PRODUCT_PARAM]).trim();
  if (value === NO_PRODUCT) return { kind: 'none' };
  if (ID.test(value)) return { kind: 'product', id: value.toLowerCase() };
  return { kind: 'all' };
}

/** The rows the choice keeps: `productOf` names the product of each row that carries one. */
export function narrowByProduct<T extends { id: string }>(rows: readonly T[], productOf: ReadonlyMap<string, string>, choice: ProductChoice): T[] {
  if (choice.kind === 'all') return [...rows];
  if (choice.kind === 'none') return rows.filter((row) => !productOf.has(row.id));
  return rows.filter((row) => productOf.get(row.id) === choice.id);
}

/** One link of the filter. */
export interface ProductOption {
  label: string;
  href: string;
  current: boolean;
}

/** The filter as the list draws it. */
export interface ProductFilterView {
  options: ProductOption[];
}

/** The list's address with `product` set to `value`, or left out; every other filter kept, in its order. */
function addressWith(path: string, query: Query, value: string | null): string {
  const params = new URLSearchParams();
  for (const [key, raw] of Object.entries(query)) {
    if (key === PRODUCT_PARAM || raw === undefined) continue;
    const kept = one(raw);
    if (kept !== '') params.set(key, kept);
  }
  if (value !== null) params.set(PRODUCT_PARAM, value);
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

const same = (a: ProductChoice, b: ProductChoice) => a.kind === b.kind && (a.kind !== 'product' || (b.kind === 'product' && a.id === b.id));

/** The filter's links: All, each product in order, No product; the chosen one current. */
export function productFilterOf(products: readonly { id: string; name: string }[], choice: ProductChoice, path: string, query: Query): ProductFilterView {
  const option = (label: string, value: string | null, of: ProductChoice): ProductOption => ({
    label, href: addressWith(path, query, value), current: same(choice, of),
  });
  return {
    options: [
      option(PRODUCT_FILTER_WORDS.all, null, { kind: 'all' }),
      ...products.map((p) => option(p.name, p.id, { kind: 'product', id: p.id.toLowerCase() })),
      option(PRODUCT_FILTER_WORDS.none, NO_PRODUCT, { kind: 'none' }),
    ],
  };
}

/** The reads the filter needs, as the repository answers them. */
export type ProductFilterReads = Pick<ProductFilterRepository, 'products' | 'dossierProducts' | 'dossierNumbers' | 'boardWorkspaces' | 'ideaProducts'>;

/** What a row shows of its product (PRD 2011): the product's name, and, for a product item, its id
 * (`mobile-12` a PRD, `mobile-B74` a bug, `mobile-R3` a roadmap); null for a row born in a repository. */
export interface ProductLabel {
  product: string;
  itemId: string | null;
}

/** The labels by dossier id: each row that carries a product. */
export type ProductLabels = ReadonlyMap<string, ProductLabel>;

const ITEM_PREFIX = { prd: '', bug: 'B', roadmap: 'R' } as const;

/** The id of a product item: `<key>-<n>`, `<key>-B<n>` or `<key>-R<n>`; null for any other kind, or without a key or a number. */
function itemIdOf(kind: string | undefined, key: string | null, seq: number | undefined): string | null {
  const k = kind ?? 'prd';
  if (key === null || seq === undefined || !(k in ITEM_PREFIX)) return null;
  return `${key}-${ITEM_PREFIX[k as keyof typeof ITEM_PREFIX]}${seq}`;
}

/** The label of each row that carries a product: the product's name and, when the row is numbered on it, its id. */
export function labelsOf(
  rows: readonly { id: string; kind?: string | undefined }[], products: readonly { id: string; name: string; key?: string | null }[],
  carriers: ReadonlyMap<string, string>, numbers: ReadonlyMap<string, number>,
): Map<string, ProductLabel> {
  const labels = new Map<string, ProductLabel>();
  for (const row of rows) {
    const product = products.find((p) => p.id.toLowerCase() === carriers.get(row.id)?.toLowerCase());
    if (product) labels.set(row.id, { product: product.name, itemId: itemIdOf(row.kind, product.key ?? null, numbers.get(row.id)) });
  }
  return labels;
}

/** A list once filtered: its rows, the filter to draw (null: none), and whether the products could not be read. */
export interface ProductScope<T> {
  rows: T[];
  /** Each kept row's product (PRD 2011). */
  labels: ProductLabels;
  filter: ProductFilterView | null;
  unreadable: boolean;
}

type Log = (line: string) => void;

const why = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** The rows narrowed and the filter, once the products and their carriers are read. */
function scoped<T extends { id: string; kind?: string | undefined }>(
  rows: readonly T[], products: readonly { id: string; name: string }[], carriers: ReadonlyMap<string, string>, query: Query, path: string,
  numbers: ReadonlyMap<string, number> = new Map(),
): ProductScope<T> {
  const choice = readProductChoice(query);
  if (products.length === 0 && choice.kind === 'all') return { rows: [...rows], labels: new Map(), filter: null, unreadable: false };
  const kept = narrowByProduct(rows, carriers, choice);
  return { rows: kept, labels: labelsOf(kept, products, carriers, numbers), filter: productFilterOf(products, choice, path, query), unreadable: false };
}

/** A list of dossiers (/prd, /bugs, /visual) filtered by product: the products and the dossiers that carry
 * one are read for the listed rows' workspaces, once each. */
export async function scopeDossiers<T extends { id: string; workspace_id: string; kind?: string | undefined }>(
  reads: Pick<ProductFilterReads, 'products' | 'dossierProducts' | 'dossierNumbers'>, rows: readonly T[], query: Query, path: string, log: Log = console.error,
): Promise<ProductScope<T>> {
  const workspaces = [...new Set(rows.map((r) => r.workspace_id))].sort();
  if (workspaces.length === 0) return { rows: [...rows], labels: new Map(), filter: null, unreadable: false };
  try {
    const [products, carriers, numbers] = await Promise.all([reads.products(workspaces), reads.dossierProducts(workspaces), reads.dossierNumbers(workspaces)]);
    return scoped(rows, products, carriers, query, path, numbers);
  } catch (err) {
    log(`product filter: the products could not be read (${why(err)})`);
    return { rows: [...rows], labels: new Map(), filter: null, unreadable: true };
  }
}

/** A board once filtered: the view, its lanes redrawn from the ideas kept, and the filter. */
export interface BoardScope {
  view: IdeasView;
  filter: ProductFilterView | null;
  unreadable: boolean;
}

/** A repository's ideas board filtered by product, for a member of its workspace; anyone else's board, and
 * a board that is none or unavailable, is left as it is, with no read. */
export async function scopeBoard(
  reads: Pick<ProductFilterReads, 'products' | 'boardWorkspaces' | 'ideaProducts'>, view: IdeasView, query: Query, path: string, log: Log = console.error,
): Promise<BoardScope> {
  if (view.kind !== 'board' || !view.board.member) return { view, filter: null, unreadable: false };
  const { board } = view;
  try {
    const workspaces = await reads.boardWorkspaces(board.repo);
    const [products, carriers] = await Promise.all([
      workspaces.length === 0 ? Promise.resolve([]) : reads.products(workspaces),
      reads.ideaProducts(board.repo),
    ]);
    const { rows: ideas, filter } = scoped(board.ideas, products, carriers, query, path);
    return { view: { kind: 'board', board: { ...board, ideas }, lanes: lanesOf(ideas) }, filter, unreadable: false };
  } catch (err) {
    log(`product filter: the board's products could not be read (${why(err)})`);
    return { view, filter: null, unreadable: true };
  }
}

/** The filter's reads on `db`, the client the controller was handed: the viewer's. */
export const productFilterReads = (db: ProductFilterDb): ProductFilterReads => productFilterRepository(db);

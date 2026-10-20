import { productsRepository, type ProductsDb, type ProductsRepository, type StoredLink, type StoredPlayer, type StoredProductDossier } from './products.repository';

// /app/products's rules (PRD 1364 s8; ADR-0095): the workspace's products as cards, as the concept's first
// screen draws them, and the repositories in no product under them. A product's card holds its
// repositories (one linked to another product too is shared: products are many to many, spec §1), how
// many PRDs carry it (dossiers of kind `prd` whose product it is, spec §2), and how many of its items wait
// on the person reading: the approval requests that ask them, with no approval since (PRD 1322), of the
// product's dossiers. A repository is in no product when no product links it. Products are optional, so
// a workspace with none lists every repository below an empty list.

/** One repository on a product's card: its `owner/name`, and whether another product links it too. */
export interface CardRepository {
  repo: string;
  shared: boolean;
}

/** One product's card. */
export interface ProductCard {
  id: string;
  name: string;
  repositories: CardRepository[];
  prds: number;
  waiting: number;
}

/** An archived product, as an owner lists it under Archived (n): when, and by whom (their GitHub login). */
export interface ArchivedProduct {
  id: string;
  name: string;
  at: string;
  by: string | null;
}

/** The list: the live products' cards, first first, the repositories in no product, by name, and, for a
 * workspace owner only (PRD 2232), the archived products. */
export interface ProductsList {
  products: ProductCard[];
  unlinked: string[];
  archived: ArchivedProduct[];
  /** Whether the reader owns the workspace: only an owner sees Archived (n) and Restore. */
  owner: boolean;
}

/** What the list is drawn from, as the repository reads it. */
export interface ProductsListRows {
  products: readonly { id: string; name: string; archived_at: string | null; archived_by: string | null }[];
  links: readonly StoredLink[];
  repositories: readonly string[];
  dossiers: readonly StoredProductDossier[];
  /** The dossiers whose approval waits on the reader. */
  waiting: readonly string[];
  /** Whether the reader owns the workspace. */
  owner: boolean;
  /** The GitHub logins of the archivers. */
  players: readonly StoredPlayer[];
}

const byName = (a: string, b: string) => a.localeCompare(b);

/** The cards and the repositories in no product, from the rows read. A link to a product the workspace
 * does not list, or one that is archived, is left out: an archived product's repositories are free (PRD 2232),
 * and only an owner lists the archived ones. */
export function productsListOf(rows: ProductsListRows): ProductsList {
  const live = rows.products.filter((p) => p.archived_at === null);
  const archived = rows.owner
    ? rows.products.flatMap((p): ArchivedProduct[] => {
      if (p.archived_at === null) return [];
      const by = p.archived_by === null ? null : (rows.players.find((x) => x.user_id === p.archived_by)?.github_login ?? null);
      return [{ id: p.id, name: p.name, at: p.archived_at, by }];
    })
    : [];
  const known = new Set(live.map((p) => p.id));
  const links = rows.links.filter((l) => known.has(l.product_id));
  const productsOf = new Map<string, Set<string>>();
  for (const l of links) productsOf.set(l.repository, (productsOf.get(l.repository) ?? new Set()).add(l.product_id));
  const waiting = new Set(rows.waiting);
  const products = live.map((p): ProductCard => ({
    id: p.id,
    name: p.name,
    repositories: [...new Set(links.filter((l) => l.product_id === p.id).map((l) => l.repository))]
      .sort(byName)
      .map((repo) => ({ repo, shared: (productsOf.get(repo)?.size ?? 0) > 1 })),
    prds: rows.dossiers.filter((d) => d.product_id === p.id && d.kind === 'prd').length,
    waiting: rows.dossiers.filter((d) => d.product_id === p.id && waiting.has(d.id)).length,
  }));
  const unlinked = [...new Set(rows.repositories)].filter((r) => !productsOf.has(r)).sort(byName);
  return { products, unlinked, archived, owner: rows.owner };
}

export function productsService(store: ProductsRepository) {
  return {
    /** The workspace's products list, as the reader sees it. Throws when a read fails. */
    async list(workspace: string): Promise<ProductsList> {
      const [products, links, repositories, dossiers, waiting, owner] = await Promise.all([
        store.products(workspace),
        store.links(workspace),
        store.repositories(workspace),
        store.productDossiers(workspace),
        store.waitingDossiers(),
        store.owner(workspace),
      ]);
      const archivers = owner ? [...new Set(products.flatMap((p) => (p.archived_at === null || p.archived_by === null ? [] : [p.archived_by])))] : [];
      const players = await store.players(workspace, archivers);
      return productsListOf({ products, links, repositories, dossiers, waiting, owner, players });
    },
  };
}

export type ProductsService = ReturnType<typeof productsService>;

/** The products reads on `db`, the client the controller was handed: the viewer's. */
export const productsReads = (db: ProductsDb): ProductsService => productsService(productsRepository(db));

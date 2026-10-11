import type { CardRepository, ProductCard, ProductsList } from './products.service';

// The Products page's tiles as pure data (#1598, pick D): the four totals over the tiles, a tile's
// repositories with their shared owner said once and the rest counted, and the product whose Open leads.
// Everything is read from the list the page already holds: nothing here fetches.

/** How many repositories a tile names before it counts the rest. */
export const TILE_REPOSITORIES = 6;

export interface HomeTotals {
  products: number;
  /** The workspace's repositories, each once: in a product (shared ones counted once) or in none. */
  repositories: number;
  prds: number;
  waiting: number;
}

export function homeTotals(list: ProductsList): HomeTotals {
  const repositories = new Set([...list.products.flatMap((p) => p.repositories.map((r) => r.repo)), ...list.unlinked]);
  return {
    products: list.products.length,
    repositories: repositories.size,
    prds: list.products.reduce((sum, p) => sum + p.prds, 0),
    waiting: list.products.reduce((sum, p) => sum + p.waiting, 0),
  };
}

export interface TileRepository extends CardRepository {
  /** The name the tile shows: the repository's own name when the tile says its owner once. */
  name: string;
}

export interface TileRepositories {
  /** The owner every repository of the tile shares, said once; null when they differ or there are none. */
  owner: string | null;
  shown: TileRepository[];
  /** How many more the tile counts after the ones it shows. */
  more: number;
}

const ownerOf = (repo: string): string => repo.split('/')[0] ?? repo;

export function tileRepositories(repositories: readonly CardRepository[]): TileRepositories {
  const owners = new Set(repositories.map((r) => ownerOf(r.repo)));
  const [only] = owners;
  const owner = owners.size === 1 && only !== undefined ? only : null;
  const shown = repositories.slice(0, TILE_REPOSITORIES).map((r) => ({
    ...r,
    name: owner === null ? r.repo : r.repo.slice(owner.length + 1),
  }));
  return { owner, shown, more: Math.max(0, repositories.length - TILE_REPOSITORIES) };
}

/** The product waiting most on the reader, whose Open leads the page; null when nothing waits. */
export function firstToOpen(products: readonly ProductCard[]): string | null {
  let first: ProductCard | null = null;
  for (const p of products) if (p.waiting > 0 && (first === null || p.waiting > first.waiting)) first = p;
  return first?.id ?? null;
}

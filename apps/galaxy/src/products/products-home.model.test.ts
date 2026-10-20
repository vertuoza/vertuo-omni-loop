import { describe, expect, it } from 'vitest';
import { firstToOpen, homeTotals, tileRepositories, TILE_REPOSITORIES } from './products-home.model';
import type { ProductCard, ProductsList } from './products.service';

// The Products page's tiles as pure data (#1598, pick D): the four totals over the tiles, a tile's
// repositories with their shared owner said once and the rest counted, and the product whose Open leads.

const card = (over: Partial<ProductCard>): ProductCard => ({ id: 'p', name: 'P', repositories: [], prds: 0, waiting: 0, ...over });

describe('homeTotals', () => {
  it('counts the products, the workspace\'s repositories once each, the PRDs and what waits on you', () => {
    const list: ProductsList = {
      products: [
        card({ id: 'a', repositories: [{ repo: 'o/api', shared: true }, { repo: 'o/web', shared: false }], prds: 3, waiting: 2 }),
        card({ id: 'b', repositories: [{ repo: 'o/api', shared: true }], prds: 1, waiting: 1 }),
      ],
      unlinked: ['o/scripts'], archived: [], owner: false,
    };
    expect(homeTotals(list)).toEqual({ products: 2, repositories: 3, prds: 4, waiting: 3 });
  });
});

describe('tileRepositories', () => {
  it('says a shared owner once and shows each repository by its own name', () => {
    expect(tileRepositories([{ repo: 'o/api', shared: true }, { repo: 'o/web', shared: false }])).toEqual({
      owner: 'o',
      shown: [{ repo: 'o/api', name: 'api', shared: true }, { repo: 'o/web', name: 'web', shared: false }],
      more: 0,
    });
  });

  it('keeps full names when the owners differ', () => {
    expect(tileRepositories([{ repo: 'o/api', shared: false }, { repo: 'p/web', shared: false }]).owner).toBeNull();
    expect(tileRepositories([{ repo: 'o/api', shared: false }, { repo: 'p/web', shared: false }]).shown.map((r) => r.name)).toEqual(['o/api', 'p/web']);
  });

  it(`shows the first ${String(TILE_REPOSITORIES)} and counts the rest`, () => {
    const many = Array.from({ length: TILE_REPOSITORIES + 7 }, (_, i) => ({ repo: `o/r${String(i)}`, shared: false }));
    const tile = tileRepositories(many);
    expect(tile.shown).toHaveLength(TILE_REPOSITORIES);
    expect(tile.more).toBe(7);
  });

  it('has nothing to show for a product with no repository', () => {
    expect(tileRepositories([])).toEqual({ owner: null, shown: [], more: 0 });
  });
});

describe('firstToOpen', () => {
  it('is the product waiting most on you, the first of them on a tie', () => {
    expect(firstToOpen([card({ id: 'a', waiting: 2 }), card({ id: 'b', waiting: 3 }), card({ id: 'c', waiting: 3 })])).toBe('b');
  });

  it('is none when nothing waits on you', () => {
    expect(firstToOpen([card({ id: 'a' }), card({ id: 'b' })])).toBeNull();
  });
});

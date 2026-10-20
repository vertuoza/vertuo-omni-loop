import { describe, expect, it } from 'vitest';
import type { ProductsRepository } from './products.repository';
import { productsListOf, productsService, type ProductsListRows } from './products.service';

// /app/products's rules (PRD 1364 s8), on fixture rows: each product's card (its repositories, a shared
// one marked, its PRD count, what waits on the reader), and the repositories in no product.

const MOBILE = { id: 'p-mobile', name: 'Mobile', archived_at: null, archived_by: null };
const ESTIMATES = { id: 'p-estimates', name: 'Estimates', archived_at: null, archived_by: null };
const LEGACY = { id: 'p-legacy', name: 'Legacy', archived_at: '2026-10-18T12:00:00Z', archived_by: 'u-1' };

const ROWS: ProductsListRows = {
  products: [MOBILE, ESTIMATES],
  links: [
    { product_id: 'p-mobile', repository: 'vertuo/app' },
    { product_id: 'p-mobile', repository: 'vertuo/api' },
    { product_id: 'p-estimates', repository: 'vertuo/api' },
    { product_id: 'p-gone', repository: 'vertuo/old' },
  ],
  repositories: ['vertuo/api', 'vertuo/app', 'vertuo/scripts', 'vertuo/docs', 'vertuo/old'],
  dossiers: [
    { id: 'd-1', kind: 'prd', product_id: 'p-mobile' },
    { id: 'd-2', kind: 'prd', product_id: 'p-mobile' },
    { id: 'd-3', kind: 'bug', product_id: 'p-mobile' },
    { id: 'd-4', kind: 'prd', product_id: 'p-estimates' },
  ],
  waiting: ['d-2', 'd-9'],
  owner: false,
  players: [{ user_id: 'u-1', github_login: 'pierrederval' }],
};

describe('the products list', () => {
  it('draws each product first first, its repositories by name, one another product links marked shared', () => {
    const list = productsListOf(ROWS);
    expect(list.products.map((p) => [p.name, p.repositories])).toEqual([
      ['Mobile', [{ repo: 'vertuo/api', shared: true }, { repo: 'vertuo/app', shared: false }]],
      ['Estimates', [{ repo: 'vertuo/api', shared: true }]],
    ]);
  });

  it('counts each product\'s PRDs, never its bug or visual fixes', () => {
    expect(productsListOf(ROWS).products.map((p) => [p.name, p.prds])).toEqual([['Mobile', 2], ['Estimates', 1]]);
  });

  it('counts what waits on the reader, of the product\'s own dossiers only', () => {
    expect(productsListOf(ROWS).products.map((p) => [p.name, p.waiting])).toEqual([['Mobile', 1], ['Estimates', 0]]);
  });

  it('lists the repositories in no product by name, a link to a product the workspace does not list counting as none', () => {
    expect(productsListOf(ROWS).unlinked).toEqual(['vertuo/docs', 'vertuo/old', 'vertuo/scripts']);
  });

  it('lists every repository in no product when the workspace has no product: products are optional', () => {
    expect(productsListOf({ ...ROWS, products: [] })).toEqual({
      products: [],
      unlinked: ['vertuo/api', 'vertuo/app', 'vertuo/docs', 'vertuo/old', 'vertuo/scripts'],
      archived: [],
      owner: false,
    });
  });

  it('draws a product with no repository and no PRD with empty counts', () => {
    expect(productsListOf({ products: [MOBILE], links: [], repositories: [], dossiers: [], waiting: [], owner: false, players: [] }).products)
      .toEqual([{ id: 'p-mobile', name: 'Mobile', repositories: [], prds: 0, waiting: 0 }]);
  });
});

describe('the archived products (PRD 2232)', () => {
  const rows: ProductsListRows = { ...ROWS, products: [MOBILE, LEGACY], links: [...ROWS.links, { product_id: 'p-legacy', repository: 'vertuo/docs' }] };

  it('splits archived products from the live ones: the grid holds only live ones', () => {
    expect(productsListOf({ ...rows, owner: true }).products.map((p) => p.name)).toEqual(['Mobile']);
  });

  it('lists them for an owner with when and by whom, and frees their repositories', () => {
    const list = productsListOf({ ...rows, owner: true });
    expect(list.owner).toBe(true);
    expect(list.archived).toEqual([{ id: 'p-legacy', name: 'Legacy', at: '2026-10-18T12:00:00Z', by: 'pierrederval' }]);
    expect(list.unlinked).toContain('vertuo/docs');
  });

  it('names no one when the archiver is unknown', () => {
    expect(productsListOf({ ...rows, owner: true, players: [] }).archived.map((a) => a.by)).toEqual([null]);
  });

  it('lists none for a member', () => {
    const list = productsListOf({ ...rows, owner: false });
    expect(list.owner).toBe(false);
    expect(list.archived).toEqual([]);
  });
});

describe('the products service', () => {
  const store = (over: Partial<ProductsRepository> = {}): ProductsRepository => ({
    products: () => Promise.resolve(ROWS.products.map((p) => ({ ...p, pitch_look: null, pitch: null }))),
    owner: () => Promise.resolve(false),
    players: () => Promise.resolve([...ROWS.players]),
    links: () => Promise.resolve([...ROWS.links]),
    repositories: () => Promise.resolve([...ROWS.repositories]),
    productDossiers: () => Promise.resolve([...ROWS.dossiers]),
    waitingDossiers: () => Promise.resolve([...ROWS.waiting]),
    ...over,
  });

  it('reads the workspace\'s rows and draws the list from them', async () => {
    const asked: string[] = [];
    const list = await productsService(store({ links: (w) => { asked.push(w); return Promise.resolve([...ROWS.links]); } })).list('ws-1');
    expect(asked).toEqual(['ws-1']);
    expect(list).toEqual(productsListOf(ROWS));
  });

  it('reads the archivers\' logins only for an owner, and only those who archived', async () => {
    const asked: (readonly string[])[] = [];
    const service = productsService(store({
      products: () => Promise.resolve([MOBILE, LEGACY].map((p) => ({ ...p, pitch_look: null, pitch: null }))),
      owner: () => Promise.resolve(true),
      players: (_w, users) => { asked.push(users); return Promise.resolve([...ROWS.players]); },
    }));
    const list = await service.list('ws-1');
    expect(asked).toEqual([['u-1']]);
    expect(list.archived.map((a) => a.by)).toEqual(['pierrederval']);
  });

  it('throws when a read fails', async () => {
    await expect(productsService(store({ waitingDossiers: () => Promise.reject(new Error('down')) })).list('ws-1')).rejects.toThrow('down');
  });
});

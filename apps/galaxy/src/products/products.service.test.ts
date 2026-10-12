import { describe, expect, it } from 'vitest';
import type { ProductsRepository } from './products.repository';
import { productsListOf, productsService, type ProductsListRows } from './products.service';

// /app/products's rules (PRD 1364 s8), on fixture rows: each product's card (its repositories, a shared
// one marked, its PRD count, what waits on the reader), and the repositories in no product.

const MOBILE = { id: 'p-mobile', name: 'Mobile' };
const ESTIMATES = { id: 'p-estimates', name: 'Estimates' };

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
    });
  });

  it('draws a product with no repository and no PRD with empty counts', () => {
    expect(productsListOf({ products: [MOBILE], links: [], repositories: [], dossiers: [], waiting: [] }).products)
      .toEqual([{ id: 'p-mobile', name: 'Mobile', repositories: [], prds: 0, waiting: 0 }]);
  });
});

describe('the products service', () => {
  const store = (over: Partial<ProductsRepository> = {}): ProductsRepository => ({
    products: () => Promise.resolve(ROWS.products.map((p) => ({ ...p, pitch_look: null, pitch: null }))),
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

  it('throws when a read fails', async () => {
    await expect(productsService(store({ waitingDossiers: () => Promise.reject(new Error('down')) })).list('ws-1')).rejects.toThrow('down');
  });
});

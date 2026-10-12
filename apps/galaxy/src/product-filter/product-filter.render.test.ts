import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ProductFilter, productBoardScope, productListScope } from './ProductFilter';
import type { ProductFilterDb } from './product-filter.repository';
import { PRODUCT_FILTER_WORDS } from './product-filter.service';

// The product filter as the server renders it above /prd, /ideas, /bugs and /visual (PRD 1364 s12): a
// labelled row of links, the chosen one current; nothing at all when there is no filter to draw; and the
// line that says the list is not narrowed when the products could not be read.

const render = (props: Parameters<typeof ProductFilter>[0]) => renderToStaticMarkup(createElement(ProductFilter, props));

describe('the product filter', () => {
  it('draws All, each product and No product as links, the current one marked', () => {
    const html = render({
      filter: { options: [
        { label: 'All', href: '/prd', current: false },
        { label: 'Mobile', href: '/prd?product=p', current: true },
        { label: 'No product', href: '/prd?product=none', current: false },
      ] },
      unreadable: false,
    });
    expect(html).toContain('aria-label="Product"');
    expect([...html.matchAll(/<a [^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/g)].map((m) => [m[1], m[2]])).toEqual([
      ['/prd', 'All'], ['/prd?product=p', 'Mobile'], ['/prd?product=none', 'No product'],
    ]);
    expect(/<a [^>]*aria-current="page"[^>]*>([^<]*)</.exec(html)?.[1]).toBe('Mobile');
  });

  it('draws nothing when the list has no filter', () => {
    expect(render({ filter: null, unreadable: false })).toBe('');
  });

  it('says the list is not narrowed when the products could not be read', () => {
    expect(render({ filter: null, unreadable: true })).toContain(PRODUCT_FILTER_WORDS.unreadable);
  });
});

/** A client whose tables answer these rows, whatever the filters: no test calls Supabase. */
function db(tables: Record<string, unknown[]>): ProductFilterDb {
  const query = (table: string) => {
    const q = {
      select: () => q, order: () => q, in: () => q, not: () => q, eq: () => q,
      then: (ok: (v: unknown) => unknown) => Promise.resolve({ data: tables[table] ?? [], error: null }).then(ok),
    };
    return q;
  };
  return { from: query } as unknown as ProductFilterDb;
}

const PRODUCT = '0b8e7c2e-3f1a-4d5b-9c6e-1a2b3c4d5e6f';

describe('a list page\'s product scope', () => {
  const live = db({ products: [{ id: PRODUCT, name: 'Mobile', workspace_id: 'ws-1' }], dossiers: [{ id: 'd-1', product_id: PRODUCT }] });
  const rows = [{ id: 'd-1', workspace_id: 'ws-1' }, { id: 'd-2', workspace_id: 'ws-1' }];

  it('narrows the rows read to the product asked for, and draws the filter above them', async () => {
    const scoped = await productListScope('/bugs')(live, rows, { product: PRODUCT, q: 'crash' });
    expect(scoped.rows).toEqual([{ id: 'd-1', workspace_id: 'ws-1' }]);
    const html = renderToStaticMarkup(createElement('div', null, scoped.above));
    expect(html).toContain(`href="/bugs?q=crash&amp;product=${PRODUCT}"`);
    expect(html).toContain('href="/bugs?q=crash&amp;product=none"');
  });

  it('keeps the rows with no product for No product', async () => {
    expect((await productListScope('/visual')(live, rows, { product: 'none' })).rows).toEqual([{ id: 'd-2', workspace_id: 'ws-1' }]);
  });

  it('narrows a member\'s board, and draws nothing on an anonymous one', async () => {
    const idea = (id: string) => ({ id, title: id, pitch: '', lane: 'next' as const, prd: null, created_at: '2026-10-01T00:00:00Z', votes: 0, voted: false, archived: false });
    const board = (member: boolean) => ({ kind: 'board' as const, board: { repo: 'vertuo/app', public: true, member, ideas: [idea('i-1'), idea('i-2')] }, lanes: [] });
    const withIdeas = db({ repositories: [{ workspace_id: 'ws-1' }], products: [{ id: PRODUCT, name: 'Mobile', workspace_id: 'ws-1' }], ideas: [{ id: 'i-2', product_id: PRODUCT }] });
    const scoped = await productBoardScope(withIdeas, board(true), { product: PRODUCT }, '/ideas/vertuo/app');
    expect(scoped.view.kind === 'board' && scoped.view.board.ideas.map((i) => i.id)).toEqual(['i-2']);
    expect(renderToStaticMarkup(createElement('div', null, scoped.above))).toContain('aria-label="Product"');
    const visitor = await productBoardScope(withIdeas, board(false), { product: PRODUCT }, '/ideas/vertuo/app');
    expect(visitor.view).toEqual(board(false));
    expect(renderToStaticMarkup(createElement('div', null, visitor.above))).toBe('<div></div>');
  });
});

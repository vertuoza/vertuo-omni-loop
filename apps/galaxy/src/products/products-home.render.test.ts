import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { group } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { ADD_TO_PRODUCT_HREF, ALL_IN_A_PRODUCT, DEMO_PRODUCTS_LIST, NO_PRODUCTS_YET, ProductsHome } from './ProductsHome';
import type { ProductsList } from './products.service';

// /app/products as the server renders it (PRD 1364 s8): each product's card, a link to its product home,
// with its repositories (a shared one marked), its PRD count and what waits on the reader; the
// repositories in no product below, each with Add to a product; the empty states; and the situations.

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const links = (html: string) => [...html.matchAll(/<a [^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => ({ href: m[1], text: text(group(m, 2)) }));

const LIST: ProductsList = {
  products: [
    { id: 'p-mobile', name: 'Mobile', repositories: [{ repo: 'vertuo/api', shared: true }, { repo: 'vertuo/app', shared: false }], prds: 3, waiting: 2 },
    { id: 'p-estimates', name: 'Estimates', repositories: [], prds: 1, waiting: 0 },
  ],
  unlinked: ['vertuo/scripts'],
};

const render = (list: ProductsList) => renderToStaticMarkup(createElement(ProductsHome, { view: { kind: 'products', list } }));

describe('the products list, filled', () => {
  it('draws each product as a card linking to its product home, with its repositories, PRDs and what waits on you', () => {
    const html = render(LIST);
    expect(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1]).toBe('Products');
    expect(links(html)).toEqual([
      { href: '/app/products/p-mobile', text: 'Mobile vertuo/api · shared vertuo/app 3 PRDs 2 waiting on you' },
      { href: '/app/products/p-estimates', text: 'Estimates No repository yet 1 PRD 0 waiting on you' },
      { href: ADD_TO_PRODUCT_HREF, text: 'Add to a product' },
    ]);
  });

  it('marks only the shared repository as shared', () => {
    const html = render(LIST);
    expect([...html.matchAll(/<span class="products-chip"( data-shared="true")?>([^<]*)/g)].map((m) => [m[2], Boolean(m[1])])).toEqual([
      ['vertuo/api', true],
      ['vertuo/app', false],
    ]);
  });

  it('lists the repositories in no product below the cards, each with Add to a product', () => {
    const html = render(LIST);
    expect(html.indexOf('Repositories in no product')).toBeGreaterThan(html.indexOf('data-product="p-estimates"'));
    expect(html).toMatch(/<li class="products-repo" data-repo="vertuo\/scripts"><span class="products-repo-name">vertuo\/scripts<\/span><a class="products-add" href="\/app\/settings\/repositories">Add to a product<\/a><\/li>/);
  });
});

describe('the products list, empty', () => {
  it('says products are optional when there is none, and still lists the repositories', () => {
    const html = render({ products: [], unlinked: ['vertuo/api'] });
    expect(text(html)).toContain(NO_PRODUCTS_YET);
    expect(links(html)).toEqual([
      { href: '/app/settings/products', text: 'Open Settings › Products →' },
      { href: ADD_TO_PRODUCT_HREF, text: 'Add to a product' },
    ]);
  });

  it('says every repository is in a product when none is left out', () => {
    expect(text(render({ ...LIST, unlinked: [] }))).toContain(ALL_IN_A_PRODUCT);
  });
});

describe('the products list\'s situations', () => {
  it('asks a signed-out person to sign in, and says so for no workspace, no database and an unreadable list', () => {
    const titles = (['sign-in', 'no-workspace', 'closed', 'unreadable'] as const).map((kind) =>
      /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(renderToStaticMarkup(createElement(ProductsHome, { view: { kind } })))?.[1]);
    expect(titles).toEqual([
      'Sign in to see your products',
      'Your account is not in a workspace',
      'Products are not open here',
      'Couldn’t load your products',
    ]);
  });

  it('draws the demo with a shared repository and one in no product', () => {
    const html = render(DEMO_PRODUCTS_LIST);
    expect(html).toContain('data-shared="true"');
    expect(html).toContain('data-repo="acme/scripts"');
  });
});

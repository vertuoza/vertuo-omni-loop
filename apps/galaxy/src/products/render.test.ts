import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { initialProductState, productReducer, type ProductAction, type ProductRow } from './model';
import { DEMO_PRODUCTS, ProductScreen, ProductsScreen, type ProductScreenView, type ProductsScreenView } from './ProductsScreen';
import { LOOK_HINT, NO_PRODUCTS, ProductsView, ProductView, READ_ONLY } from './ProductsView';

// Settings › Products as the server renders it (PRD 859 s1): the list (each product a link to its own
// page, with its look), the empty list, a product's page with the Pitch look dropdown for whoever may
// edit the business (Arcade poster by default) and as text for anyone else, a refusal, and every
// situation under the Settings tabs with Products marked.

const VERTUOZA: ProductRow = { id: 'p-1', name: 'Vertuoza', look: 'arcade' };
const OMNI: ProductRow = { id: 'p-2', name: 'Omni Loop', look: 'keynote' };

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const links = (html: string) => [...html.matchAll(/<a [^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => ({ href: m[1], text: text(m[2]) }));
const options = (html: string) => [...html.matchAll(/<option ([^>]*)>([^<]*)<\/option>/g)].map((m) => ({ value: /value="([^"]*)"/.exec(m[1])?.[1], selected: m[1].includes('selected'), text: m[2] }));
const select = (html: string) => /<select ([^>]*)>/.exec(html)?.[1] ?? null;

const product = (row: ProductRow, { editable = true, actions = [] as ProductAction[] } = {}) =>
  renderToStaticMarkup(createElement(ProductView, { state: actions.reduce(productReducer, initialProductState(row)), editable }));

describe('the products list', () => {
  it('is headed Products and lists each product with its look, linking to its own page', () => {
    const html = renderToStaticMarkup(createElement(ProductsView, { products: [VERTUOZA, OMNI] }));
    expect(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1]).toBe('Products');
    expect(links(html)).toEqual([
      { href: '/app/settings/products/p-1', text: 'Vertuoza Arcade poster' },
      { href: '/app/settings/products/p-2', text: 'Omni Loop Clean keynote' },
    ]);
  });

  it('says where products are named when there is none yet', () => {
    const html = renderToStaticMarkup(createElement(ProductsView, { products: [] }));
    expect(text(html)).toContain(NO_PRODUCTS);
    expect(links(html)).toEqual([{ href: '/app/settings/business', text: 'Open Business →' }]);
  });
});

describe('a product\'s page, for whoever may edit the business', () => {
  it('is headed by the product, links back to the list, and has a Pitch look section', () => {
    const html = product(VERTUOZA);
    expect(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1]).toBe('Vertuoza');
    expect(links(html)).toEqual([{ href: '/app/settings/products', text: '← Products' }]);
    expect(/<h2[^>]*>([\s\S]*?)<\/h2>/.exec(html)?.[1]).toBe('Pitch look');
    expect(text(html)).toContain(LOOK_HINT);
  });

  it('offers Arcade poster and Clean keynote, Arcade poster selected by default', () => {
    const html = product(VERTUOZA);
    expect(select(html)).toContain('aria-label="Pitch look of Vertuoza"');
    expect(select(html)).not.toContain('disabled');
    expect(options(html)).toEqual([
      { value: 'arcade', selected: true, text: 'Arcade poster' },
      { value: 'keynote', selected: false, text: 'Clean keynote' },
    ]);
    expect(text(html)).not.toContain(READ_ONLY);
  });

  it('shows the saved look, and waits while a change is on its way', () => {
    expect(options(product(OMNI)).find((o) => o.selected)?.value).toBe('keynote');
    expect(options(product(VERTUOZA, { actions: [{ type: 'busy' }, { type: 'saved', product: { ...VERTUOZA, look: 'keynote' } }] })).find((o) => o.selected)?.value).toBe('keynote');
    expect(select(product(VERTUOZA, { actions: [{ type: 'busy' }] }))).toContain('disabled');
  });

  it('says why a change was refused, keeping the look', () => {
    const html = product(VERTUOZA, { actions: [{ type: 'busy' }, { type: 'refused', message: 'Couldn’t save this.' }] });
    expect(html).toMatch(/role="alert">Couldn’t save this\.</);
    expect(options(html).find((o) => o.selected)?.value).toBe('arcade');
  });
});

describe('a product\'s page, for someone who may not edit the business', () => {
  it('shows the look and no dropdown', () => {
    const html = product(OMNI, { editable: false });
    expect(select(html)).toBeNull();
    expect(text(html)).toContain('Pitch look');
    expect(text(html)).toContain('Clean keynote');
    expect(text(html)).toContain(READ_ONLY);
  });
});

describe('the screens', () => {
  const tabsOf = (html: string) => [...html.matchAll(/<a [^>]*class="section-tab"[^>]*>([^<]*)<\/a>/g)].map((m) => [m[1], m[0].includes('aria-current="page"')]);
  const MARKED = [['Fleets', false], ['Repositories', false], ['Business', false], ['Products', true], ['Jev', false]];

  it('start with the Settings tabs in every situation, Products marked', () => {
    const lists: ProductsScreenView[] = [
      { kind: 'closed' }, { kind: 'sign-in' }, { kind: 'no-workspace' }, { kind: 'unreadable' }, { kind: 'products', products: DEMO_PRODUCTS },
    ];
    const pages: ProductScreenView[] = [
      { kind: 'closed' }, { kind: 'sign-in' }, { kind: 'no-workspace' }, { kind: 'unreadable' }, { kind: 'not-found' },
      { kind: 'product', source: { kind: 'demo' }, editable: true, product: DEMO_PRODUCTS[0] },
    ];
    const htmls = [
      ...lists.map((view) => [view.kind, renderToStaticMarkup(createElement(ProductsScreen, { view }))]),
      ...pages.map((view) => [view.kind, renderToStaticMarkup(createElement(ProductScreen, { view }))]),
    ];
    for (const [kind, html] of htmls) {
      expect(html.indexOf('class="section-tabs"'), kind).toBeGreaterThanOrEqual(0);
      expect(html.indexOf('class="section-tabs"'), kind).toBeLessThan(html.indexOf('<h1'));
      expect(tabsOf(html), kind).toEqual(MARKED);
    }
  });

  it('say each situation in plain words', () => {
    const list = (view: ProductsScreenView) => text(renderToStaticMarkup(createElement(ProductsScreen, { view })));
    expect(list({ kind: 'closed' })).toContain('Products are not open here');
    expect(list({ kind: 'sign-in' })).toContain('Sign in to see your products');
    expect(list({ kind: 'no-workspace' })).toContain('Your account is not in a workspace');
    expect(list({ kind: 'unreadable' })).toContain('Couldn’t load your products');
    expect(text(renderToStaticMarkup(createElement(ProductScreen, { view: { kind: 'not-found' } })))).toContain('No such product');
  });

  it('draw the demo\'s two products, one in each look', () => {
    const html = renderToStaticMarkup(createElement(ProductsScreen, { view: { kind: 'products', products: DEMO_PRODUCTS } }));
    expect(text(html)).toContain('Widgets Arcade poster');
    expect(text(html)).toContain('Legacy Clean keynote');
  });
});

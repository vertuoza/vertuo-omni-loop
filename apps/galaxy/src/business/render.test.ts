import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Claim, Product } from './model';
import { businessReducer, initialBusinessState, type BusinessAction } from './state';
import { BusinessScreen, DEMO_CLAIMS, DEMO_PRODUCTS, type BusinessScreenView } from './BusinessScreen';
import { ADD_PRODUCT, ADD_RIVAL, BusinessView, PRODUCT_NAME, SKIP, SKIPPED, TRY_LINE } from './BusinessView';

// Settings → Business as the server renders it (PRD 748 s2): the empty page (the sentence with its
// blanks, the picks, Skip), a filled one (the sentence as the title, a row per claim with its id,
// source, citations and ✓ / ✗, the claims marked wrong folded, the payoff card), the demo, the page's
// situations under the Settings tabs, and a layout that holds at 393 px.

const claim = (seq: number, kind: Claim['kind'], value: string, over: Partial<Claim> = {}): Claim =>
  ({ id: `c-${seq}`, seq, kind, value, source: 'pick', state: 'confirmed', cited: 0, lastBy: null, ...over });

const FILLED: Claim[] = [
  claim(1, 'offering', 'ERP', { cited: 3, lastBy: 'think-big concept #746' }),
  claim(2, 'size', '2-50'),
  claim(3, 'trade', 'construction'),
  claim(4, 'rival', 'Acme Build', { source: 'suggestion' }),
  claim(5, 'region', 'Belgium'),
  claim(6, 'rival', 'Old Co', { state: 'rejected' }),
];

const render = (claims: Claim[], { demo = false, actions = [] as BusinessAction[] } = {}) =>
  renderToStaticMarkup(createElement(BusinessView, { state: actions.reduce(businessReducer, initialBusinessState(claims)), demo }));
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const h1 = (html: string) => text(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? '').replace(/ (?=[,.-])/g, '').replace(/- /g, '-');
const buttons = (html: string) => [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map((m) => ({ attrs: m[1], text: text(m[2]!) }));
const inputs = (html: string) => [...html.matchAll(/<input\b([^>]*)>/g)].map((m) => m[1]);
const rowOf = (html: string, id: string) => {
  const from = html.indexOf(`data-claim="${id}"`);
  return from < 0 ? '' : html.slice(from, html.indexOf('</li>', from));
};
const groupOf = (html: string, kind: string) => {
  const from = html.indexOf(`data-kind="${kind}"`);
  return from < 0 ? '' : html.slice(from, html.indexOf('</div></div>', from));
};

describe('an empty business', () => {
  it('is headed by the sentence with its blanks, says Empty, and offers Skip', () => {
    const html = render([]);
    expect(h1(html)).toBe('We sell ___ to ___-person ___ in ___, up against ___.');
    expect(text(html)).toContain('Empty');
    expect(buttons(html).map((b) => b.text)).toContain(SKIP);
    expect(text(html)).toContain('Skip stores nothing.');
  });

  it('shows every pick: the lists with Other, the size slider, and "+ add a rival"', () => {
    const html = render([]);
    const chips = (kind: string) => buttons(groupOf(html, kind)).map((b) => b.text);
    expect(chips('offering')).toEqual(['ERP', 'CRM', 'Marketplace', 'Developer tool', 'Analytics', 'E-commerce', 'Other']);
    expect(chips('trade')).toEqual(['Construction', 'Retail', 'Healthcare', 'Finance', 'Logistics', 'Manufacturing', 'Software', 'Other']);
    expect(chips('region')).toEqual(['Belgium', 'France', 'Netherlands', 'Germany', 'United Kingdom', 'Europe', 'North America', 'Worldwide', 'Other']);
    expect(chips('rival')).toEqual([ADD_RIVAL]);
    const ranges = inputs(html).filter((i) => i!.includes('type="range"'));
    expect(ranges.map((r) => /aria-label="([^"]+)"/.exec(r!)?.[1])).toEqual(['Smallest customer', 'Largest customer']);
    expect(text(groupOf(html, 'size'))).toContain('Customer size · not picked');
  });

  it('has no text field until Other or "+ add a rival" is pressed, and one then', () => {
    expect(inputs(render([])).filter((i) => i!.includes('type="text"'))).toHaveLength(0);
    for (const kind of ['offering', 'trade', 'region', 'rival'] as const) {
      const html = render([], { actions: [{ type: 'type', kind }] });
      expect(inputs(html).filter((i) => i!.includes('type="text"')), kind).toHaveLength(1);
      expect(groupOf(html, kind)).toContain('type="text"');
    }
  });

  it('shows no row and no payoff card', () => {
    const html = render([]);
    expect(html).not.toContain('data-claim=');
    expect(text(html)).not.toContain(TRY_LINE);
  });

  it('folds the picks away on Skip, saying nothing was stored', () => {
    const html = render([], { actions: [{ type: 'skip' }] });
    expect(text(html)).toContain(SKIPPED);
    expect(html).not.toContain('data-kind="offering"');
    expect(buttons(html).map((b) => b.text)).toContain('Pick now');
  });
});

describe('a business being picked', () => {
  it('fills the title at once, and marks the picked chips', () => {
    const html = render([], { actions: [{ type: 'saved', claim: claim(1, 'offering', 'CRM') }, { type: 'saved', claim: claim(2, 'region', 'France') }] });
    expect(h1(html)).toBe('We sell a CRM to ___-person ___ in France, up against ___.');
    const pressed = (kind: string) => buttons(groupOf(html, kind)).filter((b) => b.attrs!.includes('aria-pressed="true"')).map((b) => b.text);
    expect(pressed('offering')).toEqual(['CRM']);
    expect(pressed('region')).toEqual(['France']);
  });

  it('shows a value typed under Other as a picked chip of its own', () => {
    const html = render([claim(1, 'trade', 'aerospace')]);
    expect(buttons(groupOf(html, 'trade')).filter((b) => b.attrs!.includes('aria-pressed="true"')).map((b) => b.text)).toEqual(['Aerospace']);
  });

  it('says the size the slider sits on while it moves', () => {
    expect(text(groupOf(render([], { actions: [{ type: 'size-draft', stops: [3, 6] }] }), 'size'))).toContain('Customer size · 10–100 people');
  });

  it('places each stop label under its thumb and marks the two ends of the range (#772)', () => {
    const html = render([], { actions: [{ type: 'size-draft', stops: [1, 4] }] });
    const stops = [...html.matchAll(/<li style="--at:([\d.]+)"( data-end="")?>([^<]+)<\/li>/g)];
    expect(stops.map((m) => Number(m[1]))).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => i / 9));
    expect(stops.filter((m) => m[2]).map((m) => m[3])).toEqual(['2', '20']);
  });

  it('shows a refusal under the title', () => {
    const html = render([], { actions: [{ type: 'busy' }, { type: 'refused', message: 'Only a member of the workspace can change its business.' }] });
    expect(html).toMatch(/role="alert">Only a member of the workspace can change its business\.</);
  });
});

describe('a filled business', () => {
  it('is headed by the sentence, and counts the confirmed claims', () => {
    const html = render(FILLED);
    expect(h1(html)).toBe('We sell an ERP to 2–50-person construction firms in Belgium, up against Acme Build.');
    expect(text(html)).toContain('5 confirmed');
  });

  it('shows one row per claim with its id, source, citations and ✓ / ✗', () => {
    const html = render(FILLED);
    const erp = rowOf(html, 'offering#1');
    expect(text(erp)).toContain('Offering ERP offering#1 you picked cited 3× · last by think-big concept #746');
    expect(text(rowOf(html, 'rival#4'))).toContain('suggested not cited yet');
    expect(text(rowOf(html, 'size#2'))).toContain('2–50 people');
    const verdict = buttons(erp);
    expect(verdict.map((b) => b.text)).toEqual(['✓', '✗']);
    expect(verdict[0]!.attrs).toContain('aria-pressed="true"');
    expect(verdict[1]!.attrs).toContain('aria-label="Wrong: ERP"');
    expect(verdict[1]!.attrs).not.toContain('disabled');
  });

  it('folds a claim marked wrong under "Marked wrong", out of the sentence, ✓ still offered', () => {
    const html = render(FILLED);
    const folded = html.slice(html.indexOf('<details'));
    expect(text(folded)).toContain('Marked wrong · 1');
    expect(text(rowOf(folded, 'rival#6'))).toContain('Old Co');
    expect(buttons(rowOf(folded, 'rival#6'))[0]!.attrs).not.toContain('disabled');
    expect(h1(html)).not.toContain('Old Co');
  });

  it('ends with the payoff card: the confirmed claims by id, and the line to try', () => {
    const html = render(FILLED);
    const payoff = html.slice(html.indexOf('business-payoff'));
    expect(text(payoff)).toContain('Next think-big will cite: offering#1 ERP size#2 2–50 people trade#3 Construction region#5 Belgium rival#4 Acme Build');
    expect(text(payoff)).toContain(`$ ${TRY_LINE}`);
    expect(text(payoff)).not.toContain('Old Co');
  });

  it('never says "Product" while the business has one, but for the one button that adds a second', () => {
    const but = (html: string) => text(html).replace(ADD_PRODUCT, '');
    expect(buttons(render(FILLED)).map((b) => b.text)).toContain(ADD_PRODUCT);
    expect(but(render(FILLED))).not.toMatch(/product/i);
    expect(but(render([]))).not.toMatch(/product/i);
    expect(but(renderProducts(FILLED, [VERTUOZA]))).not.toMatch(/product/i);
    expect(renderProducts(FILLED, [VERTUOZA])).not.toContain('role="tablist"');
  });
});

const VERTUOZA: Product = { id: 'p-1', name: 'Vertuoza' };
const LOOP: Product = { id: 'p-2', name: 'Omni Loop' };
const renderProducts = (claims: Claim[], products: Product[], actions: BusinessAction[] = []) =>
  renderToStaticMarkup(createElement(BusinessView, { state: actions.reduce(businessReducer, initialBusinessState(claims, products)) }));

describe('products (PRD 748 s4)', () => {
  const TWO: Claim[] = [
    claim(1, 'offering', 'ERP', { product: 'p-1' }),
    claim(2, 'trade', 'construction', { product: 'p-1' }),
    claim(3, 'region', 'Belgium', { product: null }),
    claim(4, 'offering', 'developer tool', { product: 'p-2' }),
    claim(5, 'rival', 'Acme Build', { product: 'p-1' }),
  ];
  const tabs = (html: string) => [...html.matchAll(/<button\b([^>]*role="tab"[^>]*)>([\s\S]*?)<\/button>/g)]
    .map((m) => [text(m[2]!), m[1]!.includes('aria-selected="true"')]);

  it('opens a name field on "+ Add a product", the only field then', () => {
    const html = renderProducts(FILLED, [VERTUOZA], [{ type: 'add-product' }]);
    const fields = inputs(html).filter((i) => i!.includes('type="text"'));
    expect(fields).toHaveLength(1);
    expect(text(html)).toContain(PRODUCT_NAME);
    expect(buttons(html).map((b) => b.text)).not.toContain(ADD_PRODUCT);
  });

  it('shows one tab per product once there are two, the first selected, then "+ Add a product"', () => {
    const html = renderProducts(TWO, [VERTUOZA, LOOP]);
    expect(tabs(html)).toEqual([['Vertuoza', true], ['Omni Loop', false]]);
    const bar = html.slice(html.indexOf('role="tablist"'), html.indexOf('</div>', html.indexOf('role="tablist"')));
    expect(buttons(bar).map((b) => b.text)).toEqual(['Vertuoza', 'Omni Loop', ADD_PRODUCT]);
  });

  it('gives each tab its own sentence, picks and rows', () => {
    const first = renderProducts(TWO, [VERTUOZA, LOOP]);
    expect(h1(first)).toBe('We sell an ERP to ___-person construction firms in Belgium, up against Acme Build.');
    expect(rowOf(first, 'offering#4')).toBe('');
    const second = renderProducts(TWO, [VERTUOZA, LOOP], [{ type: 'show-product', product: 'p-2' }]);
    expect(tabs(second)).toEqual([['Vertuoza', false], ['Omni Loop', true]]);
    expect(h1(second)).toBe('We sell a developer tool to ___-person ___ in Belgium, up against ___.');
    expect(rowOf(second, 'offering#1')).toBe('');
    expect(text(rowOf(second, 'offering#4'))).toContain('Developer tool');
    expect(buttons(groupOf(second, 'offering')).filter((b) => b.attrs!.includes('aria-pressed="true"')).map((b) => b.text)).toEqual(['Developer tool']);
  });

  it('keeps the region shared above the tabs, once', () => {
    const html = renderProducts(TWO, [VERTUOZA, LOOP]);
    expect(html.match(/data-kind="region"/g)).toHaveLength(1);
    expect(html.indexOf('data-kind="region"')).toBeLessThan(html.indexOf('role="tablist"'));
    expect(html.indexOf('data-kind="offering"')).toBeGreaterThan(html.indexOf('role="tablist"'));
    expect(buttons(groupOf(html, 'region')).filter((b) => b.attrs!.includes('aria-pressed="true"')).map((b) => b.text)).toEqual(['Belgium']);
  });

  it('folds the shared region away on Skip, with the picks', () => {
    expect(renderProducts(TWO, [VERTUOZA, LOOP], [{ type: 'skip' }])).not.toContain('data-kind="region"');
  });

  it('wraps the tabs at 393 px, and breaks a long name', () => {
    const css = readFileSync(fileURLToPath(new URL('./business.css', import.meta.url)), 'utf8');
    const rule = (selector: string) => css.slice(css.lastIndexOf(`${selector} {`), css.indexOf('}', css.lastIndexOf(`${selector} {`)));
    expect(rule('.business-products')).toContain('flex-wrap: wrap');
    expect(rule('.business-product-tab')).toContain('overflow-wrap: anywhere');
  });
});

describe('suggested rivals', () => {
  const PICKED: Claim[] = [
    claim(1, 'offering', 'ERP'),
    claim(2, 'trade', 'construction'),
    claim(3, 'region', 'Belgium'),
    claim(4, 'rival', 'Alpha', { source: 'suggestion', state: 'proposed' }),
    claim(5, 'rival', 'Beta', { source: 'suggestion', state: 'proposed' }),
    claim(6, 'rival', 'Gone', { source: 'suggestion', state: 'rejected' }),
  ];

  it('shows each proposed rival as a dashed guess chip with ✓ Right and ✗ Wrong, before "+ add a rival"', () => {
    const group = groupOf(render(PICKED), 'rival');
    const guesses = [...group.matchAll(/class="business-guess"[^>]*data-claim="([^"]+)"/g)].map((m) => m[1]);
    expect(guesses).toEqual(['rival#4', 'rival#5']);
    expect(text(group)).toContain('Alpha guess');
    expect(buttons(group).map((b) => b.text)).toEqual(['✓ Right', '✗ Wrong', '✓ Right', '✗ Wrong', ADD_RIVAL]);
    expect(buttons(group)[0]!.attrs).toContain('aria-label="Right: Alpha"');
  });

  it('keeps a guess out of the sentence until ✓, and shows no rejected one', () => {
    const html = render(PICKED);
    expect(h1(html)).toBe('We sell an ERP to ___-person construction firms in Belgium, up against ___.');
    expect(text(groupOf(html, 'rival'))).not.toContain('Gone');
    const confirmedOne = render(PICKED.map((c) => (c.value === 'Alpha' ? { ...c, state: 'confirmed' as const } : c)));
    expect(h1(confirmedOne)).toContain('up against Alpha.');
    expect(groupOf(confirmedOne, 'rival')).not.toContain('data-claim="rival#4"');
  });

  it('with no guess, shows "+ add a rival" as before, and no error', () => {
    const html = render(PICKED.filter((c) => c.kind !== 'rival'));
    expect(buttons(groupOf(html, 'rival')).map((b) => b.text)).toEqual([ADD_RIVAL]);
    expect(html).not.toContain('role="alert"');
  });

  it('draws the guess chip dashed, and lets it wrap at 393 px', () => {
    const css = readFileSync(fileURLToPath(new URL('./business.css', import.meta.url)), 'utf8');
    const at = css.lastIndexOf('.business-guess {');
    expect(at).toBeGreaterThanOrEqual(0);
    const rule = css.slice(at, css.indexOf('}', at));
    expect(rule).toContain('dashed');
    expect(rule).toContain('flex-wrap: wrap');
    expect(rule).toContain('overflow-wrap: anywhere');
  });
});

describe('the demo', () => {
  it('shows the sample rows, marked Demo, naming no real company', () => {
    const html = render(DEMO_CLAIMS, { demo: true });
    expect(text(html)).toContain('Demo');
    expect(DEMO_CLAIMS.map((c) => rowOf(html, `${c.kind}#${c.seq}`)).every((r) => r !== '')).toBe(true);
    expect(h1(html)).toBe('We sell an ERP to 2–50-person construction firms in Belgium, up against Acme Build.');
  });
});

describe('the page\'s situations', () => {
  const screen = (view: BusinessScreenView) => renderToStaticMarkup(createElement(BusinessScreen, { view }));
  const VIEWS: BusinessScreenView[] = [
    { kind: 'closed' }, { kind: 'sign-in' }, { kind: 'no-workspace' }, { kind: 'unreadable' },
    { kind: 'business', source: { kind: 'demo' }, claims: DEMO_CLAIMS, products: DEMO_PRODUCTS },
  ];

  it('says what is wrong when there is no business to show', () => {
    expect(text(screen({ kind: 'closed' }))).toContain('The business is not open here');
    expect(text(screen({ kind: 'sign-in' }))).toContain('Sign in to see your business');
    expect(text(screen({ kind: 'no-workspace' }))).toContain('Your account is not in a workspace');
    expect(text(screen({ kind: 'unreadable' }))).toContain('Couldn’t load your business');
  });

  it('draws the business otherwise', () => {
    expect(text(screen({ kind: 'business', source: { kind: 'demo' }, claims: [], products: DEMO_PRODUCTS }))).toContain('We sell ___');
  });

  it('starts with the Fleets · Repositories · Business · Jev tabs in every situation, Business marked', () => {
    for (const view of VIEWS) {
      const html = screen(view);
      expect(html.indexOf('class="section-tabs"'), view.kind).toBeGreaterThanOrEqual(0);
      expect(html.indexOf('class="section-tabs"'), view.kind).toBeLessThan(html.indexOf('<h1'));
      const tabs = [...html.matchAll(/<a [^>]*class="section-tab"[^>]*>([^<]*)<\/a>/g)].map((m) => [m[1], m[0].includes('aria-current="page"')]);
      expect(tabs, view.kind).toEqual([['Fleets', false], ['Repositories', false], ['Business', true], ['Jev', false]]);
    }
  });
});

describe('the layout at 393 px', () => {
  const css = readFileSync(fileURLToPath(new URL('./business.css', import.meta.url)), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rule = (selector: string) => {
    const at = css.lastIndexOf(`${selector} {`);
    expect(at, selector).toBeGreaterThanOrEqual(0);
    return css.slice(at, css.indexOf('}', at));
  };

  it('fixes no width wider than a 393 px screen less its gutters', () => {
    const widths = [...css.matchAll(/(?:^|[;{\s])(?:min-)?(?:width|flex(?:-basis)?)\s*:[^;]*?(\d+)px/g)].map((m) => Number(m[1]));
    expect(widths.length).toBeGreaterThan(0);
    expect(Math.max(...widths)).toBeLessThanOrEqual(393 - 2 * 16);
  });

  it('wraps each row, the chips and the fields, and breaks every long word', () => {
    for (const selector of ['.business-row', '.business-chips', '.business-type', '.business-skip', '.business-row-meta', '.business-cites']) {
      expect(rule(selector), selector).toContain('flex-wrap: wrap');
    }
    for (const selector of ['.business .business-sentence', '.business-row-main strong', '.business-chip', '.business-try']) {
      expect(rule(selector), selector).toContain('overflow-wrap: anywhere');
    }
    expect(rule('.business-row-main')).toContain('min-width: 0');
  });
});

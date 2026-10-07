import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Claim, Product } from './model';
import { businessReducer, initialBusinessState, type BusinessAction } from './state';
import { BusinessScreen, DEMO_CLAIMS, DEMO_PRODUCTS, DEMO_QUESTIONS, DEMO_TOKENS, type BusinessScreenView } from './BusinessScreen';
import type { AgentQuestion } from '../agent-connect/questions/model';
import {
  ANSWER_ONCE, DISMISS, NO_QUESTIONS, QuestionsCard, QUESTIONS_TITLE, SAVE_ANSWER,
} from '../agent-connect/questions/QuestionsCard';
import { initialQuestionsState, questionsReducer, type QuestionsAction } from '../agent-connect/questions/state';
import {
  CONNECT_TITLE, ConnectAgentCard, DONE, MAKE_LINK, NO_LINKS, NOT_WORKING, REVOKE, SHOWN_ONCE,
} from '../agent-connect/tokens/ConnectAgentCard';
import { dayLabel, type AgentToken } from '../agent-connect/tokens/model';
import { initialTokensState, tokensReducer, type TokensAction } from '../agent-connect/tokens/state';
import { ADD_PRODUCT, ADD_RIVAL, BusinessView, PRODUCT_NAME, SKIP, SKIPPED, TRY_LINE } from './BusinessView';
import { sure } from '../arcade/test/sure';

// Settings → Business as the server renders it (PRD 748 s2): the empty page (the sentence with its
// blanks, the picks, Skip), a filled one (the sentence as the title, a row per claim with its id,
// source, citations and ✓ / ✗, the claims marked wrong folded, the payoff card), the demo, the page's
// situations under the Settings tabs, and a layout that holds at 393 px. Connect an agent (PRD 855 s1):
// empty, a token shown once, the list, Revoke on your own or on all for an owner, the demo, 393 px.
// Questions agents couldn't answer (PRD 855 s3): none, open, asked 2×, answer once, dismiss, the demo,
// 393 px.

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
const buttons = (html: string) => [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map((m) => ({ attrs: m[1], text: text(sure(m[2], 'm[2]')) }));
const inputs = (html: string) => [...html.matchAll(/<input\b([^>]*)>/g)].map((m) => sure(m[1], 'm[1]'));
const rowOf = (html: string, id: string) => {
  const from = html.indexOf(`data-claim="${id}"`);
  return from < 0 ? '' : html.slice(from, html.indexOf('</li>', from));
};
const rowOfToken = (html: string, id: string) => {
  const from = html.indexOf(`data-token="${id}"`);
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
    const ranges = inputs(html).filter((i) => i.includes('type="range"'));
    expect(ranges.map((r) => /aria-label="([^"]+)"/.exec(r)?.[1])).toEqual(['Smallest customer', 'Largest customer']);
    expect(text(groupOf(html, 'size'))).toContain('Customer size · not picked');
  });

  it('has no text field until Other or "+ add a rival" is pressed, and one then', () => {
    expect(inputs(render([])).filter((i) => i.includes('type="text"'))).toHaveLength(0);
    for (const kind of ['offering', 'trade', 'region', 'rival'] as const) {
      const html = render([], { actions: [{ type: 'type', kind }] });
      expect(inputs(html).filter((i) => i.includes('type="text"')), kind).toHaveLength(1);
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
    const pressed = (kind: string) => buttons(groupOf(html, kind)).filter((b) => sure(b.attrs, 'b.attrs').includes('aria-pressed="true"')).map((b) => b.text);
    expect(pressed('offering')).toEqual(['CRM']);
    expect(pressed('region')).toEqual(['France']);
  });

  it('shows a value typed under Other as a picked chip of its own', () => {
    const html = render([claim(1, 'trade', 'aerospace')]);
    expect(buttons(groupOf(html, 'trade')).filter((b) => sure(b.attrs, 'b.attrs').includes('aria-pressed="true"')).map((b) => b.text)).toEqual(['Aerospace']);
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
    expect(sure(verdict[0], 'verdict[0]').attrs).toContain('aria-pressed="true"');
    expect(sure(verdict[1], 'verdict[1]').attrs).toContain('aria-label="Wrong: ERP"');
    expect(sure(verdict[1], 'verdict[1]').attrs).not.toContain('disabled');
  });

  it('folds a claim marked wrong under "Marked wrong", out of the sentence, ✓ still offered', () => {
    const html = render(FILLED);
    const folded = html.slice(html.indexOf('<details'));
    expect(text(folded)).toContain('Marked wrong · 1');
    expect(text(rowOf(folded, 'rival#6'))).toContain('Old Co');
    expect(sure(buttons(rowOf(folded, 'rival#6'))[0], 'buttons(rowOf(folded, \'rival#6\'))[0]').attrs).not.toContain('disabled');
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
    .map((m) => [text(sure(m[2], 'm[2]')), sure(m[1], 'm[1]').includes('aria-selected="true"')]);

  it('opens a name field on "+ Add a product", the only field then', () => {
    const html = renderProducts(FILLED, [VERTUOZA], [{ type: 'add-product' }]);
    const fields = inputs(html).filter((i) => i.includes('type="text"'));
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
    expect(buttons(groupOf(second, 'offering')).filter((b) => sure(b.attrs, 'b.attrs').includes('aria-pressed="true"')).map((b) => b.text)).toEqual(['Developer tool']);
  });

  it('keeps the region shared above the tabs, once', () => {
    const html = renderProducts(TWO, [VERTUOZA, LOOP]);
    expect(html.match(/data-kind="region"/g)).toHaveLength(1);
    expect(html.indexOf('data-kind="region"')).toBeLessThan(html.indexOf('role="tablist"'));
    expect(html.indexOf('data-kind="offering"')).toBeGreaterThan(html.indexOf('role="tablist"'));
    expect(buttons(groupOf(html, 'region')).filter((b) => sure(b.attrs, 'b.attrs').includes('aria-pressed="true"')).map((b) => b.text)).toEqual(['Belgium']);
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
    expect(sure(buttons(group)[0], 'buttons(group)[0]').attrs).toContain('aria-label="Right: Alpha"');
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

  it('starts with the Fleets · Repositories · Business · Products · Jev tabs in every situation, Business marked', () => {
    for (const view of VIEWS) {
      const html = screen(view);
      expect(html.indexOf('class="section-tabs"'), view.kind).toBeGreaterThanOrEqual(0);
      expect(html.indexOf('class="section-tabs"'), view.kind).toBeLessThan(html.indexOf('<h1'));
      const tabs = [...html.matchAll(/<a [^>]*class="section-tab"[^>]*>([^<]*)<\/a>/g)].map((m) => [m[1], m[0].includes('aria-current="page"')]);
      expect(tabs, view.kind).toEqual([['Fleets', false], ['Repositories', false], ['Business', true], ['Products', false], ['Jev', false]]);
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

describe('Connect an agent (PRD 855 s1)', () => {
  const link = (over: Partial<AgentToken> = {}): AgentToken => ({
    id: 't-1', name: 'Tom’s editor', lastFour: 'Zz09', createdAt: '2026-09-28T08:00:00Z', lastUsedAt: '2026-10-01T09:00:00Z',
    maker: { id: 'u-tom', login: 'tom', name: 'Tom' }, mine: true, canRevoke: true, working: true, ...over,
  });
  const card = (tokens: AgentToken[], actions: TokensAction[] = [], demo = false) =>
    renderToStaticMarkup(createElement(ConnectAgentCard, { state: actions.reduce(tokensReducer, initialTokensState(tokens)), demo }));
  const TOKEN = `omb_${'k'.repeat(39)}W4x2`;
  const made: TokensAction = { type: 'made', token: TOKEN, url: 'https://galaxy.example/api/mcp', listed: link({ id: 't-9', name: 'Laptop', lastFour: 'W4x2', lastUsedAt: null }) };

  it('starts empty: a name field, Make link, and no link yet', () => {
    const html = card([]);
    expect(text(html)).toContain(CONNECT_TITLE);
    expect(text(html)).toContain(NO_LINKS);
    const fields = inputs(html).filter((i) => i.includes('type="text"'));
    expect(fields).toHaveLength(1);
    expect(fields[0]).toContain('maxLength="40"');
    expect(buttons(html).map((b) => b.text)).toEqual([MAKE_LINK]);
    expect(html).not.toContain('data-token-shown');
  });

  it('shows a made token once, with the setup for Cursor, Claude Code and any MCP client', () => {
    const html = card([], [made]);
    expect(text(html)).toContain(SHOWN_ONCE);
    expect(html).toContain(`data-token-shown="true">${TOKEN}</code>`);
    expect([...html.matchAll(/data-setup="([^"]+)"/g)].map((m) => m[1])).toEqual(['Cursor', 'Claude Code', 'Any MCP client']);
    expect(text(html)).toContain('https://galaxy.example/api/mcp');
    expect(text(html)).toContain(`Bearer ${TOKEN}`);
    expect(buttons(html).map((b) => b.text)).toContain(DONE);
  });

  it('never shows the token again once Done', () => {
    const html = card([], [made, { type: 'done' }]);
    expect(html).not.toContain(TOKEN);
    expect(html).not.toContain('data-token-shown');
    expect(rowOfToken(html, 't-9')).toContain('…W4x2');
  });

  it('lists each link: name, maker, created, last used and last four', () => {
    const html = card([link(), link({ id: 't-2', name: 'Sophie’s editor', mine: false, canRevoke: false, lastUsedAt: null, maker: { id: 'u-s', login: 'sophie', name: null } })]);
    const tom = text(rowOfToken(html, 't-1'));
    expect(tom).toContain('Tom’s editor');
    expect(tom).toContain('made by you');
    expect(tom).toContain(`created ${dayLabel('2026-09-28T08:00:00Z')}`);
    expect(tom).toContain('last used 1 Oct 2026');
    expect(tom).toContain('…Zz09');
    const sophie = text(rowOfToken(html, 't-2'));
    expect(sophie).toContain('made by @sophie');
    expect(sophie).toContain('never used');
  });

  it('offers Revoke on your own links, and on every link for an owner', () => {
    const member = card([link(), link({ id: 't-2', name: 'Other', mine: false, canRevoke: false })]);
    expect(buttons(rowOfToken(member, 't-1')).map((b) => b.text)).toEqual([REVOKE]);
    expect(buttons(rowOfToken(member, 't-2'))).toEqual([]);
    const owner = card([link({ mine: false, canRevoke: true }), link({ id: 't-2', name: 'Left behind', mine: false, canRevoke: true, working: false })]);
    expect(buttons(rowOfToken(owner, 't-1')).map((b) => b.text)).toEqual([REVOKE]);
    expect(buttons(rowOfToken(owner, 't-2')).map((b) => b.text)).toEqual([REVOKE]);
    expect(text(rowOfToken(owner, 't-2'))).toContain(NOT_WORKING);
  });

  it('says a refusal', () => {
    const html = card([], [{ type: 'refused', message: 'You hold 20 links already: revoke one to make another.' }]);
    expect(html).toContain('role="alert"');
    expect(text(html)).toContain('You hold 20 links already');
  });

  it('draws in the demo, below the business, marked Demo', () => {
    const html = renderToStaticMarkup(createElement(BusinessScreen, {
      view: { kind: 'business', source: { kind: 'demo' }, claims: DEMO_CLAIMS, products: DEMO_PRODUCTS, agents: { source: { kind: 'demo' }, tokens: DEMO_TOKENS } },
    }));
    const at = html.indexOf('class="ask-card agent-connect"');
    expect(at).toBeGreaterThan(html.indexOf('<h1'));
    expect(text(html.slice(at))).toContain('Demo');
    expect(rowOfToken(html, sure(DEMO_TOKENS[0], 'DEMO_TOKENS[0]').id)).toContain(sure(DEMO_TOKENS[0], 'DEMO_TOKENS[0]').name);
  });

  it('is not drawn when the page has no links to show', () => {
    const html = renderToStaticMarkup(createElement(BusinessScreen, { view: { kind: 'business', source: { kind: 'demo' }, claims: [], products: DEMO_PRODUCTS } }));
    expect(html).not.toContain('agent-connect');
  });

  it('holds at 393 px: nothing wider, every row and setup wraps, the token breaks anywhere', () => {
    const css = readFileSync(fileURLToPath(new URL('../agent-connect/tokens/connect.css', import.meta.url)), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const rule = (selector: string) => {
      const at = css.lastIndexOf(`${selector} {`);
      expect(at, selector).toBeGreaterThanOrEqual(0);
      return css.slice(at, css.indexOf('}', at));
    };
    const widths = [...css.matchAll(/(?:^|[;{\s])(?:min-)?(?:width|flex(?:-basis)?)\s*:[^;]*?(\d+)px/g)].map((m) => Number(m[1]));
    expect(Math.max(...widths)).toBeLessThanOrEqual(393 - 2 * 16);
    for (const selector of ['.agent-make', '.agent-row', '.agent-row-meta', '.agent-setup-head', '.agent-connect-head']) {
      expect(rule(selector), selector).toContain('flex-wrap: wrap');
    }
    for (const selector of ['.agent-token', '.agent-setup pre', '.agent-row-main strong']) {
      expect(rule(selector), selector).toContain('overflow-wrap: anywhere');
    }
    expect(rule('.agent-setup pre')).toContain('white-space: pre-wrap');
  });
});

describe('Questions agents couldn’t answer (PRD 855 s3)', () => {
  const ask = (over: Partial<AgentQuestion> = {}): AgentQuestion => ({
    id: 'q-1', question: 'Do we sell in Luxembourg?', asked: 1, askedBy: 'Tom’s editor', repo: 'acme/app', file: 'src/NewQuoteForm.tsx',
    firstAskedAt: '2026-09-30T08:00:00Z', lastAskedAt: '2026-10-01T09:00:00Z', product: 'p-1', ...over,
  });
  const TWO: Product[] = [{ id: 'p-1', name: 'App' }, { id: 'p-2', name: 'Site' }];
  const card = (questions: AgentQuestion[], actions: QuestionsAction[] = [], { demo = false, products = TWO } = {}) =>
    renderToStaticMarkup(createElement(QuestionsCard, { state: actions.reduce(questionsReducer, initialQuestionsState(questions)), products, demo }));
  const rowOfQuestion = (html: string, id: string) => {
    const from = html.indexOf(`data-question="${id}"`);
    return from < 0 ? '' : html.slice(from, html.indexOf('</li>', from));
  };

  it('says none is waiting', () => {
    const html = card([]);
    expect(text(html)).toContain(QUESTIONS_TITLE);
    expect(text(html)).toContain(NO_QUESTIONS);
    expect(buttons(html)).toEqual([]);
  });

  it('shows an open question: who asked, the repository, the file and when, with Answer once and Dismiss', () => {
    const row = rowOfQuestion(card([ask()]), 'q-1');
    expect(text(row)).toContain('Do we sell in Luxembourg?');
    expect(text(row)).toContain('asked by Tom’s editor');
    expect(text(row)).toContain('acme/app');
    expect(text(row)).toContain('src/NewQuoteForm.tsx');
    expect(text(row)).toContain(dayLabel('2026-10-01T09:00:00Z'));
    expect(text(row)).not.toMatch(/asked \d×/);
    expect(buttons(row).map((b) => b.text)).toEqual([ANSWER_ONCE, DISMISS]);
  });

  it('says asked 2× when the same question came again', () => {
    expect(text(rowOfQuestion(card([ask({ asked: 2 })]), 'q-1'))).toContain('asked 2×');
  });

  it('opens Answer once: the kinds, the value, and no product when the question names one', () => {
    const row = rowOfQuestion(card([ask()], [{ type: 'answer', id: 'q-1' }, { type: 'kind', kind: 'never' }, { type: 'value', value: 'Luxembourg' }]), 'q-1');
    expect([...row.matchAll(/<option value="([^"]+)"/g)].map((m) => m[1])).toEqual(['offering', 'size', 'trade', 'region', 'rival', 'never']);
    expect(row).toMatch(/<option value="never" selected="">/);
    expect(inputs(row).find((i) => i.includes('name="value"'))).toContain('maxLength="200"');
    expect(row).not.toContain('name="product"');
    expect(buttons(row).map((b) => b.text)).toEqual([SAVE_ANSWER, 'Cancel']);
    expect(sure(buttons(row)[0], 'buttons(row)[0]').attrs).not.toContain('disabled');
  });

  it('asks for the product when the question names none and the business has several, but never for a region', () => {
    const open: QuestionsAction[] = [{ type: 'answer', id: 'q-1' }, { type: 'kind', kind: 'trade' }, { type: 'value', value: 'plumbing' }];
    const html = rowOfQuestion(card([ask({ product: null })], open), 'q-1');
    expect(html).toContain('name="product"');
    expect(sure(buttons(html)[0], 'buttons(html)[0]').attrs).toContain('disabled');
    const picked = rowOfQuestion(card([ask({ product: null })], [...open, { type: 'product', product: 'p-2' }]), 'q-1');
    expect(sure(buttons(picked)[0], 'buttons(picked)[0]').attrs).not.toContain('disabled');
    expect(rowOfQuestion(card([ask({ product: null })], [{ type: 'answer', id: 'q-1' }]), 'q-1')).not.toContain('name="product"');
    expect(rowOfQuestion(card([ask({ product: null })], open, { products: [sure(TWO[0], 'TWO[0]')] }), 'q-1')).not.toContain('name="product"');
  });

  it('after Answer once, the question is gone and the claim is named', () => {
    const html = card([ask(), ask({ id: 'q-2', question: 'Other?' })], [{ type: 'answer', id: 'q-1' }, { type: 'busy' }, { type: 'answered', id: 'q-1', claim: 'region#7' }]);
    expect(rowOfQuestion(html, 'q-1')).toBe('');
    expect(rowOfQuestion(html, 'q-2')).not.toBe('');
    expect(text(html)).toContain('Saved as region#7');
  });

  it('after Dismiss, the question is gone with nothing stored; a refusal is said', () => {
    const html = card([ask()], [{ type: 'busy' }, { type: 'dismissed', id: 'q-1' }]);
    expect(rowOfQuestion(html, 'q-1')).toBe('');
    expect(text(html)).toContain('Nothing was stored');
    const refused = card([ask()], [{ type: 'busy' }, { type: 'refused', message: 'Pick the product this answer is about.' }]);
    expect(refused).toContain('role="alert"');
  });

  it('draws in the demo, below the business and above Connect an agent, marked Demo', () => {
    const html = renderToStaticMarkup(createElement(BusinessScreen, {
      view: {
        kind: 'business', source: { kind: 'demo' }, claims: DEMO_CLAIMS, products: DEMO_PRODUCTS,
        agents: { source: { kind: 'demo' }, tokens: DEMO_TOKENS },
        questions: { source: { kind: 'demo', lastSeq: 6 }, questions: DEMO_QUESTIONS, products: DEMO_PRODUCTS },
      },
    }));
    const at = html.indexOf('agent-questions');
    expect(at).toBeGreaterThan(html.indexOf('<h1'));
    expect(at).toBeLessThan(html.indexOf('class="ask-card agent-connect"'));
    expect(text(html.slice(at, html.indexOf('</section>', at)))).toContain('Demo');
    expect(text(rowOfQuestion(html, sure(DEMO_QUESTIONS[0], 'DEMO_QUESTIONS[0]').id))).toContain('asked 2×');
  });

  it('is not drawn when the page has no questions to show', () => {
    const html = renderToStaticMarkup(createElement(BusinessScreen, { view: { kind: 'business', source: { kind: 'demo' }, claims: [], products: DEMO_PRODUCTS } }));
    expect(html).not.toContain('agent-questions');
  });

  it('holds at 393 px: nothing wider, the buttons and the form wrap, a file breaks anywhere', () => {
    const css = readFileSync(fileURLToPath(new URL('../agent-connect/questions/questions.css', import.meta.url)), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const widths = [...css.matchAll(/(?:^|[;{\s])(?:min-)?(?:width|flex(?:-basis)?)\s*:[^;]*?(\d+)px/g)].map((m) => Number(m[1]));
    expect(widths.every((w) => w <= 393 - 2 * 16)).toBe(true);
    expect(css).toMatch(/\.agent-question-actions \{[^}]*flex-wrap: wrap/);
    expect(css).toMatch(/\.agent-question-file \{[^}]*overflow-wrap: anywhere/);
    expect(card([ask()])).toContain('class="agent-question-file"');
    // The form is the Business page's own, which wraps.
    expect(card([ask()], [{ type: 'answer', id: 'q-1' }])).toContain('class="business-type agent-question-answer"');
  });
});

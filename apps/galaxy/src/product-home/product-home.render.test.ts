import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { group } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { demoProductHome, NO_PRDS, ProductHome, type ProductHomeTab, type ProductHomeView } from './ProductHome';
import type { ProductHome as Home } from './product-home.service';

// /app/products/<id> as the server renders it (PRD 1364 s9): the Ledger, its summary and three lanes, each
// row its number or seal, ◆/◇ and its repository, its PR chips and one state word; the PRDs tab, newest
// first; the empty product; and the situations, signed out among them.

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const render = (view: ProductHomeView, tab: ProductHomeTab = 'ledger') => renderToStaticMarkup(createElement(ProductHome, { view, tab }));
const tabs = (html: string) => [...html.matchAll(/(<a class="section-tab"[^>]*>)([\s\S]*?)<\/a>/g)].map((m) => ({ tab: m[1], text: text(group(m, 2)) }));
const laneText =(html: string, lane: string) => text(new RegExp(`<section[^>]*data-lane="${lane}"[^>]*>([\\s\\S]*?)</section>`).exec(html)?.[1] ?? '');

const FILLED = demoProductHome('demo-product-1');
if (FILLED === null) throw new Error('the demo has a product home');
const EMPTY: Home = {
  product: { id: 'p-empty', name: 'Estimates' },
  ledger: { lanes: { 'on-you': [], 'on-review': [], 'on-agent': [] }, summary: { building: 0, waitingOnPerson: 0, drifted: 0 } },
  prds: [],
};

describe('the Ledger, filled', () => {
  const html = render({ kind: 'home', home: FILLED });

  it('names the product, then opens on the Ledger tab, counting what waits on you', () => {
    expect(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1]).toBe('Widgets');
    expect(tabs(html)).toEqual([
      { tab: '<a class="section-tab" aria-label="Ledger: 2 waiting" aria-current="page" href="/app/products/demo-product-1">', text: 'Ledger 2' },
      { tab: '<a class="section-tab" href="/app/products/demo-product-1/prds">', text: 'PRDs' },
      { tab: '<a class="section-tab" href="/app/products/demo-product-1/repositories">', text: 'Repositories & approvers' },
    ]);
  });

  it('shows the summary of building, waiting on a person and drifted', () => {
    expect(text(/<section class="product-home-summary"[^>]*>([\s\S]*?)<\/section>/.exec(html)?.[1] ?? '')).toBe('2 building 2 waiting on a person 0 drifted');
  });

  it('lays the rows in three lanes, each with its number, birthplace, repository, chips and state word', () => {
    expect(laneText(html, 'on-you')).toBe('On you 918 Offline photo upload ◆ acme/widgets approval 912 Quotes on the phone ◇ acme/widgets Round per line or on the total? question');
    expect(laneText(html, 'on-review')).toBe('On GitHub review 910 Faster search ◇ acme/widgets widgets #101 review');
    expect(laneText(html, 'on-agent')).toBe('On the agent 905 Invoice reminders ◆ acme/widgets api #447 widgets #94 building');
  });

  it('seals a PRD whose approval is in force, and links each PR chip to GitHub and each title to the PRD page', () => {
    expect(html).toMatch(/<span class="product-home-n" data-sealed="true" title="approved">905<\/span>/);
    expect(html).toMatch(/<span class="product-home-n">918<\/span>/);
    expect(html).toContain('href="https://github.com/acme/api/pull/447"');
    expect(html).toContain('href="/prd/demo-d-905"');
  });
});

describe('the PRDs tab', () => {
  it('lists every PRD, newest first, with its birthplace and state word, the PRDs tab current', () => {
    const html = render({ kind: 'home', home: FILLED }, 'prds');
    expect(tabs(html).map((t) => t.tab)).toEqual([
      '<a class="section-tab" aria-label="Ledger: 2 waiting" href="/app/products/demo-product-1">',
      '<a class="section-tab" aria-current="page" href="/app/products/demo-product-1/prds">',
      '<a class="section-tab" href="/app/products/demo-product-1/repositories">',
    ]);
    expect([...html.matchAll(/<li class="product-home-row"[^>]*>([\s\S]*?)<\/li>/g)].map((m) => text(group(m, 1)))).toEqual([
      '918 Offline photo upload ◆ acme/widgets PRD',
      '912 Quotes on the phone ◇ acme/widgets building',
      '910 Faster search ◇ acme/widgets outbox',
      '905 Invoice reminders ◆ acme/widgets building',
      '890 Dark mode ◇ acme/widgets shipped',
    ]);
  });
});

describe('the product home, empty', () => {
  it('says no PRD carries the product, and every lane that nothing waits there', () => {
    const html = render({ kind: 'home', home: EMPTY });
    expect(text(html)).toContain(NO_PRDS);
    expect(laneText(html, 'on-you')).toBe('On you Nothing waits on you.');
    expect(laneText(html, 'on-review')).toBe('On GitHub review Nothing waits on a review.');
    expect(laneText(html, 'on-agent')).toBe('On the agent Nothing waits on the agent.');
    expect(html).not.toContain('aria-label="Ledger:');
  });

  it('says so on the PRDs tab too', () => {
    expect(text(render({ kind: 'home', home: EMPTY }, 'prds'))).toContain(NO_PRDS);
  });
});

describe('the product home\'s situations', () => {
  it('asks a signed-out person to sign in, and draws no tab', () => {
    const html = render({ kind: 'sign-in' });
    expect(text(html)).toContain('Sign in to see your products');
    expect(html).not.toContain('section-tab');
  });

  it('says when the product is not found, the deployment is closed, or the reads failed', () => {
    expect(text(render({ kind: 'not-found' }))).toContain('No such product');
    expect(text(render({ kind: 'closed' }))).toContain('Products are not open here');
    expect(text(render({ kind: 'unreadable' }))).toContain('Couldn’t load your products');
    expect(text(render({ kind: 'no-workspace' }))).toContain('Your account is not in a workspace');
  });
});

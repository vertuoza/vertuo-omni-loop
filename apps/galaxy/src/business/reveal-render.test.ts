import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Claim } from './model';
import { businessReducer, initialBusinessState, type BusinessAction } from './state';
import type { DraftView, WebPage } from './reveal';
import { BusinessScreen, DEMO_CLAIMS, DEMO_PRODUCTS } from './BusinessScreen';
import {
  ADD_PAGE, BusinessView, DOCK, DRAFT, DRAFTING, NOTHING_FOUND, NOTHING_NEW, NOTHING_SAVED, PAGES_FULL, SAVED_LINE, THATS_US, THIN_HINT,
} from './BusinessView';
import { sure } from '../arcade/sure';

// Settings › Business with the draft (PRD 774 s3), as the server renders it: Draft from my repos on the
// empty and the filled page, + add a web page (a fourth refused), the scan of sources while a draft
// runs, the sentence that types itself as "We think you sell …" with the Sources used line, What we
// found with its receipt chips and ✓ Right / ✗ Wrong, the That's us dock, the saved line, thin evidence
// and nothing found beside the pick controls, the demo, and a layout that holds at 393 px.

const claim = (seq: number, kind: Claim['kind'], value: string, over: Partial<Claim> = {}): Claim =>
  ({ id: `c-${seq}`, seq, kind, value, source: 'pick', state: 'confirmed', cited: 0, lastBy: null, ...over });
const found = (seq: number, kind: Claim['kind'], value: string, where: string, quote: string, over: Partial<Claim> = {}) =>
  claim(seq, kind, value, {
    source: 'evidence', state: 'proposed',
    receipts: [{ kind: where.startsWith('https://') ? 'link' : 'file', where, quote, seenAt: '2026-09-30T10:00:00Z' }],
    ...over,
  });

const FOUND: Claim[] = [
  found(1, 'offering', 'ERP', 'acme/vertuo-app/README.md', 'The ERP for construction companies'),
  found(2, 'size', '2-50', 'https://example.com/pricing', 'Pro: up to 50 users. Starter for teams of 2.'),
  found(3, 'region', 'Belgium', 'acme/vertuo-app/README.md', 'Peppol e-invoicing for Belgium, built in.'),
  found(4, 'rival', 'Brick & Co', 'acme/vertuo-app/docs/positioning.md', 'Brick & Co is too heavy for a 10-person firm.'),
];

const DONE: DraftView = {
  id: 'd-1', kind: 'draft', state: 'done', reason: null,
  counts: { readmes: 2, docs: 0, prds: 14, pages: 1, kept: 4 },
  scanned: [
    { source: 'vertuo-app · README.md', state: 'read' },
    { source: 'example.com/pricing', state: 'read' },
    { source: 'example.com/about', state: 'skipped', why: 'no answer in 10 s' },
  ],
};
const RUNNING: DraftView = { ...DONE, state: 'running', counts: {}, scanned: DONE.scanned.slice(0, 1) };

const render = (claims: Claim[], { draft = null as DraftView | null, pages = [] as WebPage[], actions = [] as BusinessAction[], demo = false } = {}) =>
  renderToStaticMarkup(createElement(BusinessView, { state: actions.reduce(businessReducer, initialBusinessState(claims, [], { draft, pages })), demo }));
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const h1 = (html: string) => text(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? '').replace(/ (?=[,.-])/g, '').replace(/- /g, '-');
const buttons = (html: string) => [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map((m) => ({ attrs: m[1], text: text(sure(m[2], 'm[2]')) }));
const button = (html: string, label: string) => buttons(html).find((b) => b.text === label);
const section = (html: string, cls: string) => {
  const from = html.indexOf(`class="${cls}`);
  return from < 0 ? '' : html.slice(from, html.indexOf('</section>', from));
};
const foundRow = (html: string, id: string) => {
  const from = html.indexOf(`data-found="${id}"`);
  return from < 0 ? '' : html.slice(from, html.indexOf('</li>', from));
};
const PAGES: WebPage[] = [{ id: 'w-1', url: 'https://example.com/pricing' }, { id: 'w-2', url: 'https://example.com/about' }];

describe('Draft from my repos', () => {
  it('is offered on the empty sentence and on a filled page', () => {
    expect(button(render([]), DRAFT)?.attrs).not.toContain('disabled');
    expect(button(render([claim(1, 'offering', 'ERP')]), DRAFT)).toBeDefined();
  });

  it('waits while a draft runs, saying so', () => {
    const html = render([], { actions: [{ type: 'draft', draft: RUNNING }] });
    expect(button(html, DRAFTING)?.attrs).toContain('disabled');
    expect(button(html, DRAFT)).toBeUndefined();
  });
});

describe('+ add a web page', () => {
  it('says how many of three are left, lists the pages pasted, each removable', () => {
    const html = render([], { pages: PAGES });
    expect(text(html)).toContain(`${ADD_PAGE} (1 of 3 left)`);
    const list = section(html, 'business-pages');
    expect(text(list)).toContain('example.com/pricing');
    expect(buttons(list).filter((b) => sure(b.attrs, 'b.attrs').includes('aria-label="Remove example.com/pricing"'))).toHaveLength(1);
  });

  it('opens one address field, the only thing typed', () => {
    const html = render([], { actions: [{ type: 'add-page' }] });
    const fields = [...html.matchAll(/<input\b([^>]*)>/g)].map((m) => m[1]).filter((i) => /type="(text|url)"/.test(sure(i, 'i')));
    expect(fields).toHaveLength(1);
    expect(fields[0]).toContain('type="url"');
    expect(fields[0]).toContain('pattern="https://.*"');
  });

  it('refuses a fourth: the button waits, and says why', () => {
    const html = render([], { pages: [...PAGES, { id: 'w-3', url: 'https://example.com/home' }] });
    const add = buttons(html).find((b) => b.text.startsWith(ADD_PAGE));
    expect(add?.attrs).toContain('disabled');
    expect(text(html)).toContain(PAGES_FULL);
  });
});

describe('the scan', () => {
  it('lists each source as it is read or skipped, while the draft runs', () => {
    const html = render([], { actions: [{ type: 'draft', draft: { ...RUNNING, scanned: DONE.scanned } }] });
    const scan = text(section(html, 'business-scan'));
    expect(scan).toContain('✓ vertuo-app · README.md');
    expect(scan).toContain('– example.com/about · skipped (no answer in 10 s)');
    expect(html).toContain('aria-live="polite"');
  });
});

describe('the reveal', () => {
  const html = render(FOUND, { draft: DONE, actions: [{ type: 'drafted', draft: DONE, claims: FOUND }] });

  it('types the sentence as "We think you sell …", with the Sources used line and Nothing saved yet', () => {
    expect(h1(html)).toBe('We think you sell an ERP to 2–50-person ___ in Belgium, up against Brick & Co.');
    expect(html).toMatch(/<h1[^>]*class="business-sentence business-typing"/);
    expect(text(html)).toContain('Sources used: 2 READMEs · 14 PRDs · 1 web page');
    expect(text(html)).toContain(NOTHING_SAVED);
  });

  it('lists What we found, one row per claim with its kind, value, receipt chips and ✓ Right / ✗ Wrong', () => {
    const list = section(html, 'business-found');
    expect(text(list)).toContain('What we found');
    const erp = foundRow(list, 'offering#1');
    expect(text(erp)).toContain('Offering ERP');
    expect(text(erp)).toContain('vertuo-app/README.md');
    expect(text(erp)).toContain('“The ERP for construction companies”');
    expect(erp).toContain('<details class="business-receipt"');
    expect(text(foundRow(list, 'size#2'))).toContain('example.com/pricing');
    expect(buttons(erp).map((b) => b.text)).toEqual(['✓ Right', '✗ Wrong']);
  });

  it('keeps the found rows out of the claims list and out of the guessed rivals', () => {
    expect(html).not.toContain('data-claim="offering#1"');
    expect(html).not.toContain('data-claim="rival#4"');
  });

  it('marks a row ✗: struck through, and out of the sentence', () => {
    const marked = render(FOUND, { actions: [{ type: 'drafted', draft: DONE, claims: FOUND }, { type: 'mark', claim: 'c-4', mark: 'wrong' }] });
    const row = foundRow(marked, 'rival#4');
    expect(row).toContain('data-mark="wrong"');
    expect(sure(buttons(row)[1], 'buttons(row)[1]').attrs).toContain('aria-pressed="true"');
    expect(h1(marked)).toBe('We think you sell an ERP to 2–50-person ___ in Belgium, up against ___.');
  });

  it('docks That\'s us under the rows', () => {
    const dock = section(html, 'business-dock');
    expect(text(dock)).toContain(DOCK);
    expect(buttons(dock).map((b) => b.text)).toEqual([THATS_US]);
  });

  it('reads as the filled page once That\'s us is saved, with the saved line', () => {
    const after = render(FOUND, { actions: [{ type: 'drafted', draft: DONE, claims: FOUND }, { type: 'mark', claim: 'c-4', mark: 'wrong' }, { type: 'thats-us' }] });
    expect(h1(after)).toBe('We sell an ERP to 2–50-person ___ in Belgium, up against ___.');
    expect(text(after)).toContain(SAVED_LINE);
    expect(after).not.toContain('class="business-found');
    expect(after).not.toContain('class="business-dock');
    expect(text(after)).toContain('3 confirmed');
  });

  it('shows the rows found by an earlier draft on any visit', () => {
    const again = render(FOUND, { draft: DONE });
    expect(h1(again)).toContain('We think you sell');
    expect(section(again, 'business-found')).not.toBe('');
  });
});

describe('thin evidence', () => {
  it('says "We found only 1 thing" beside the pick controls, and points at + add a web page', () => {
    const html = render(FOUND.slice(2, 3), { actions: [{ type: 'drafted', draft: DONE, claims: FOUND.slice(2, 3) }] });
    expect(text(html)).toContain('We found only 1 thing.');
    expect(text(html)).toContain(THIN_HINT);
    expect(section(html, 'business-found')).not.toBe('');
    expect(html).toContain('data-kind="offering"');
    expect(html.indexOf('We found only')).toBeLessThan(html.indexOf('data-kind="offering"'));
  });
});

describe('nothing found', () => {
  it('says "Nothing we could quote — pick instead", and the picks follow', () => {
    const empty: DraftView = { ...DONE, counts: { readmes: 1 } };
    const html = render([], { actions: [{ type: 'drafted', draft: empty, claims: [] }] });
    expect(text(html)).toContain(NOTHING_FOUND);
    expect(html).toContain('data-kind="offering"');
    expect(h1(html)).toBe('We sell ___ to ___-person ___ in ___, up against ___.');
  });

  it('says nothing new when every quote is already on the page', () => {
    const erp = claim(1, 'offering', 'ERP');
    const html = render([erp], { actions: [{ type: 'drafted', draft: { ...DONE, counts: { kept: 1, seen: 1 } }, claims: [erp] }] });
    expect(text(html)).toContain(NOTHING_NEW);
  });

  it('says why a draft failed', () => {
    const html = render([], { actions: [{ type: 'drafted', draft: { ...DONE, state: 'failed', reason: 'The business database could not answer. Try again.' }, claims: [] }] });
    expect(html).toMatch(/role="alert">The business database could not answer\. Try again\.</);
  });
});

describe('the demo', () => {
  it('offers Draft from my repos, marked Demo', () => {
    const html = renderToStaticMarkup(createElement(BusinessScreen, { view: { kind: 'business', source: { kind: 'demo' }, claims: DEMO_CLAIMS, products: DEMO_PRODUCTS } }));
    expect(text(html)).toContain('Demo');
    expect(button(html, DRAFT)).toBeDefined();
    expect(text(html)).toContain(`${ADD_PAGE} (3 of 3 left)`);
  });
});

describe('the draft at 393 px', () => {
  const css = readFileSync(fileURLToPath(new URL('./business.css', import.meta.url)), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rule = (selector: string) => {
    const at = css.lastIndexOf(`${selector} {`);
    expect(at, selector).toBeGreaterThanOrEqual(0);
    return css.slice(at, css.indexOf('}', at));
  };

  it('wraps the rows, the chips, the dock and the page list, and breaks every long word', () => {
    for (const selector of ['.business-found-row', '.business-receipts', '.business-dock', '.business-pages ul', '.business-draft-bar', '.business-page-field']) {
      expect(rule(selector), selector).toContain('flex-wrap: wrap');
    }
    for (const selector of ['.business-scan li', '.business-receipt', '.business-found-value', '.business-pages li', '.business-used']) {
      expect(rule(selector), selector).toContain('overflow-wrap: anywhere');
    }
    expect(rule('.business-found-main')).toContain('min-width: 0');
  });

  it('types the sentence only where motion is welcome', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: no-preference\)\s*{[^}]*\.business-typing/);
  });
});

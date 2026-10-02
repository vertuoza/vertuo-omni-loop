import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Claim } from './model';
import { businessReducer, initialBusinessState, type BusinessAction } from './state';
import { ANSWERED, BusinessView, CHECK_TITLE, STILL_TRUE, type BusinessHandlers } from './BusinessView';

// Settings › Business after the weekly recheck (PRD 774 s4), as the server renders it: on top of the
// page, an addition diff ("Belgium → Belgium + France") and a replacement ("ERP → CRM", the old one
// struck), each with ✓ Right / ✗ Wrong; a claim with receipts unseen for eight weeks, dimmed with its
// date, ✓ Still true and ✗ Wrong; a claim without receipts never fades; a claim a person answered in a
// skill run and left proposed (PRD 822), "answered in a run", ✓ Right / ✗ Wrong. The rows on top leave
// the list of claims below, and the card holds at 393 px.

const NOW = Date.parse('2026-10-05T09:00:00Z');
const WEEK = 7 * 24 * 3600_000;
const ago = (ms: number) => new Date(NOW - ms).toISOString();

const claim = (seq: number, kind: Claim['kind'], value: string, over: Partial<Claim> = {}): Claim =>
  ({ id: `c-${seq}`, seq, kind, value, source: 'pick', state: 'confirmed', cited: 0, lastBy: null, ...over });
const receipt = (seenAt: string, quote = 'Invoices for Belgium and France.') => ({ kind: 'file' as const, where: 'acme/app/README.md', quote, seenAt });
const evidence = (seq: number, kind: Claim['kind'], value: string, over: Partial<Claim> = {}) =>
  claim(seq, kind, value, { source: 'evidence', state: 'proposed', receipts: [receipt(ago(0))], ...over });

const RECHECKED: Claim[] = [
  claim(1, 'region', 'Belgium'),
  evidence(2, 'region', 'France'),
  claim(3, 'offering', 'ERP', { state: 'contradicted' }),
  evidence(4, 'offering', 'CRM', { replaces: 'c-3', receipts: [receipt(ago(0), 'The CRM for builders.')] }),
  claim(5, 'rival', 'Brick & Co', { source: 'evidence', receipts: [receipt('2026-08-03T10:00:00Z')], lastSeen: '2026-08-03T10:00:00Z' }),
  claim(6, 'rival', 'Mortar Inc', { lastSeen: ago(40 * WEEK) }),
  claim(7, 'rival', 'Pipe Pro', { source: 'answer', state: 'proposed' }),
];

const render = (claims: Claim[], { actions = [] as BusinessAction[], on }: { actions?: BusinessAction[]; on?: BusinessHandlers } = {}) =>
  renderToStaticMarkup(createElement(BusinessView, { state: actions.reduce(businessReducer, initialBusinessState(claims)), now: NOW, on }));
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const card = (html: string) => {
  const from = html.indexOf('class="ask-card business-check');
  return from < 0 ? '' : html.slice(from, html.indexOf('</section>', from));
};
const row = (html: string, id: string) => {
  const from = html.indexOf(`data-check="${id}"`);
  return from < 0 ? '' : html.slice(from, html.indexOf('</li>', from));
};
const buttons = (html: string) => [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map((m) => ({ attrs: m[1], text: text(m[2]!) }));

describe('what the recheck found, on top', () => {
  it('comes first on the page, before the sentence', () => {
    const html = render(RECHECKED);
    expect(text(card(html))).toContain(CHECK_TITLE);
    expect(html.indexOf('business-check')).toBeLessThan(html.indexOf('id="business-title"'));
  });

  it('shows an addition as "Region: Belgium → Belgium + France", with its receipts and ✓ / ✗', () => {
    const r = row(render(RECHECKED), 'region#2');
    expect(text(r)).toContain('Region Belgium → Belgium + France');
    expect(text(r)).toContain('Invoices for Belgium and France.');
    expect(buttons(r).map((b) => b.text)).toEqual(['✓ Right', '✗ Wrong']);
  });

  it('shows a replacement as "ERP → CRM", the old value struck', () => {
    const r = row(render(RECHECKED), 'offering#4');
    expect(r).toMatch(/<s[^>]*>ERP<\/s>/);
    expect(text(r)).toContain('Offering ERP → CRM');
    expect(text(r)).toContain('The CRM for builders.');
    expect(buttons(r).map((b) => b.text)).toEqual(['✓ Right', '✗ Wrong']);
  });

  it('shows a claim unseen for eight weeks faded, with its date, ✓ Still true and ✗ Wrong', () => {
    const r = row(render(RECHECKED), 'rival#5');
    expect(r).toContain('data-kind="faded"');
    expect(text(r)).toContain('Brick & Co');
    expect(text(r)).toContain('not seen since 3 Aug');
    expect(buttons(r).map((b) => b.text)).toEqual([STILL_TRUE, '✗ Wrong']);
  });

  it('shows a proposed answer as "answered in a run", with ✓ Right / ✗ Wrong, and never as a guess', () => {
    const html = render(RECHECKED);
    const r = row(html, 'rival#7');
    expect(r).toContain('data-kind="answer"');
    expect(text(r)).toContain(`Rival Pipe Pro ${ANSWERED}`);
    expect(buttons(r).map((b) => b.text)).toEqual(['✓ Right', '✗ Wrong']);
    expect(html).not.toContain('data-claim="rival#7"');
  });

  it('never fades a claim without receipts', () => {
    const html = render(RECHECKED);
    expect(row(html, 'rival#6')).toBe('');
    expect(html).toContain('data-claim="rival#6"');
  });

  it('takes its rows out of the list of claims below, and the found rows', () => {
    const html = render(RECHECKED);
    for (const id of ['region#2', 'offering#3', 'offering#4', 'rival#5', 'rival#7']) expect(html, id).not.toContain(`data-claim="${id}"`);
    expect(html).not.toContain('What we found');
  });

  it('shows nothing when nothing waits', () => {
    expect(card(render([claim(1, 'region', 'Belgium')]))).toBe('');
  });
});

describe('settling what the recheck found', () => {
  const calls: string[] = [];
  const on = new Proxy({} as BusinessHandlers, {
    get: (_t, name: string) => (c?: Claim, right?: boolean) => calls.push([name, c?.id, right].filter((x) => x !== undefined).join(' ')),
  });

  it('wires ✓ and ✗ to settle, ✓ Still true to stillTrue and ✗ Wrong on a faded claim to reject', () => {
    const html = render(RECHECKED, { on });
    const names = buttons(card(html)).map((b) => /aria-label="([^"]+)"/.exec(b.attrs!)?.[1]);
    expect(names).toEqual([
      'Right: CRM replaces ERP', 'Wrong: CRM replaces ERP',
      'Right: add France', 'Wrong: add France',
      'Right: Pipe Pro', 'Wrong: Pipe Pro',
      'Still true: Brick &amp; Co', 'Wrong: Brick &amp; Co',
    ]);
  });

  it('✓ on a replacement confirms the new and rejects the old; ✗ the reverse', () => {
    const right = render(RECHECKED, { actions: [{ type: 'settled', claim: { ...RECHECKED[3]!, state: 'confirmed' } }] });
    expect(row(right, 'offering#4')).toBe('');
    expect(right).toContain('data-claim="offering#4" data-state="confirmed"');
    expect(right).not.toContain('data-claim="offering#3" data-state="confirmed"');
    const wrong = render(RECHECKED, { actions: [{ type: 'settled', claim: { ...RECHECKED[3]!, state: 'rejected' } }] });
    expect(wrong).toContain('data-claim="offering#3" data-state="confirmed"');
  });

  it('✓ Still true clears the fade', () => {
    const html = render(RECHECKED, { actions: [{ type: 'still-true', claim: 'c-5', at: new Date(NOW).toISOString() }] });
    expect(row(html, 'rival#5')).toBe('');
    expect(html).toContain('data-claim="rival#5"');
  });
});

describe('the rows to check at 393 px', () => {
  const css = readFileSync(fileURLToPath(new URL('./business.css', import.meta.url)), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rule = (selector: string) => {
    const at = css.lastIndexOf(`\n${selector} {`);
    expect(at, selector).toBeGreaterThanOrEqual(0);
    return css.slice(at, css.indexOf('}', at));
  };

  it('wraps each row and breaks every long word; a faded row is dimmed', () => {
    expect(rule('.business-check-row')).toContain('flex-wrap: wrap');
    expect(rule('.business-check-main')).toContain('min-width: 0');
    expect(rule('.business-check-diff')).toContain('overflow-wrap: anywhere');
    expect(rule(".business-check-row[data-kind='faded'] .business-check-main")).toContain('opacity');
  });
});

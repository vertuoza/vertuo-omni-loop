import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { planPick, type Claim } from './model';
import { businessReducer, initialBusinessState, type BusinessAction } from './state';
import { DEMO_CLAIMS } from './BusinessScreen';
import { ADD_NEVER, BusinessView, NEVER_EMPTY, NEVER_TITLE } from './BusinessView';
import { callsOf, databaseBusiness, demoBusinessPort, NEVER_INVALID } from './store';

// Settings › Business's Never lines (PRD 839 s2): the list under the claims, empty or filled; + Never
// line, typed and confirmed at once, 200 characters at most; ✓ / ✗ on each line; the `#never-<seq>`
// anchor the App's Change the claim links to; a line the draft proposed, with its receipt; 393 px; and
// the demo.

const claim = (seq: number, kind: Claim['kind'], value: string, over: Partial<Claim> = {}): Claim =>
  ({ id: `c-${seq}`, seq, kind, value, source: 'pick', state: 'confirmed', cited: 0, lastBy: null, ...over });

const render = (claims: Claim[], { demo = false, actions = [] as BusinessAction[] } = {}) =>
  renderToStaticMarkup(createElement(BusinessView, { state: actions.reduce(businessReducer, initialBusinessState(claims)), demo }));
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const buttons = (html: string) => [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map((m) => ({ attrs: m[1], text: text(m[2]) }));
const inputs = (html: string) => [...html.matchAll(/<input\b([^>]*)>/g)].map((m) => m[1]);
const section = (html: string) => {
  const from = html.indexOf('class="ask-card business-never"');
  return from < 0 ? '' : html.slice(from, html.indexOf('</section>', from));
};
const lineOf = (html: string, seq: number) => {
  const from = html.indexOf(`id="never-${seq}"`);
  return from < 0 ? '' : html.slice(from, html.indexOf('</li>', from));
};

const GROUPS = claim(7, 'never', 'Build for groups of companies', { cited: 2, lastBy: 'canon #753' });
const TENDERS = claim(8, 'never', 'Answer public tenders', {
  source: 'evidence', state: 'proposed',
  receipts: [{ kind: 'file', where: 'acme/app/docs/positioning.md', quote: 'we don\'t answer public tenders', seenAt: '2026-09-30T08:00:00Z' }],
});
const BASE: Claim[] = [claim(1, 'offering', 'ERP'), claim(2, 'region', 'Belgium')];

describe('an empty Never lines list', () => {
  it('sits under the claims, says there is none yet, and offers + Never line', () => {
    const html = render(BASE);
    const list = section(html);
    expect(text(list)).toContain(NEVER_TITLE);
    expect(text(list)).toContain(NEVER_EMPTY);
    expect(buttons(list).map((b) => b.text)).toEqual([ADD_NEVER]);
    expect(html.indexOf('business-never')).toBeGreaterThan(html.indexOf('The claims agents read'));
    expect(list).not.toContain('id="never-');
  });

  it('is there on an empty business too', () => {
    expect(buttons(section(render([]))).map((b) => b.text)).toEqual([ADD_NEVER]);
  });
});

describe('adding a Never line', () => {
  it('opens one field of 200 characters on + Never line', () => {
    const html = render(BASE, { actions: [{ type: 'type', kind: 'never' }] });
    const fields = inputs(section(html)).filter((i) => i.includes('type="text"'));
    expect(fields).toHaveLength(1);
    expect(fields[0]).toContain('maxLength="200"');
    expect(buttons(section(html)).map((b) => b.text)).not.toContain(ADD_NEVER);
  });

  it('shows the saved line at once, confirmed, "you wrote"', () => {
    const html = render(BASE, { actions: [{ type: 'type', kind: 'never' }, { type: 'busy' }, { type: 'saved', claim: GROUPS }, { type: 'done' }] });
    const line = lineOf(html, 7);
    expect(text(line)).toContain('Build for groups of companies never#7 you wrote cited 2× · last by canon #753');
    expect(line).toContain('data-state="confirmed"');
    expect(inputs(section(html)).filter((i) => i.includes('type="text"'))).toHaveLength(0);
    expect(text(section(html))).not.toContain(NEVER_EMPTY);
  });

  it('plans a typed line as one pick, rejecting nothing, however many lines there are', async () => {
    const plan = planPick([GROUPS], 'never', 'Answer public tenders');
    expect(plan).toEqual({ reject: [], pick: 'Answer public tenders' });
    const calls: Array<[string, Record<string, unknown>]> = [];
    const db = { rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push([fn, args]);
      return { data: { id: 'c-9', seq: 9, kind: 'never', value: 'Answer public tenders', source: 'pick', state: 'confirmed', product_id: 'p-1' }, error: null };
    } };
    const port = databaseBusiness(db, 'ws-1', 'p-1');
    for (const call of callsOf(port, 'never', plan, 'p-1')) expect(await call()).toMatchObject({ ok: true, claim: { kind: 'never', state: 'confirmed' } });
    expect(calls).toEqual([['claim_pick', { p_workspace: 'ws-1', p_product: 'p-1', p_kind: 'never', p_value: 'Answer public tenders', p_source: 'pick' }]]);
  });

  it('refuses a line over 200 characters with its own words', async () => {
    const db = { rpc: async () => ({ data: null, error: { code: '22023' } }) };
    expect(await databaseBusiness(db, 'ws-1', 'p-1').pick('never', 'x'.repeat(201))).toEqual({ ok: false, message: NEVER_INVALID });
    expect(NEVER_INVALID).toContain('200');
  });
});

describe('✓ / ✗ on a Never line', () => {
  it('offers ✓ and ✗ on a confirmed line, ✓ pressed', () => {
    const verdict = buttons(lineOf(render([...BASE, GROUPS]), 7));
    expect(verdict.map((b) => b.text)).toEqual(['✓', '✗']);
    expect(verdict[0].attrs).toContain('aria-pressed="true"');
    expect(verdict[1].attrs).toContain('aria-label="Wrong: Build for groups of companies"');
    expect(verdict[1].attrs).not.toContain('disabled');
  });

  it('folds a line marked wrong under "Marked wrong", out of the list', () => {
    const html = render([...BASE, { ...GROUPS, state: 'rejected' }]);
    expect(section(html)).not.toContain('never#7');
    expect(text(html.slice(html.indexOf('<details class="business-wrong-list"')))).toContain('Build for groups of companies');
  });

  it('keeps Never lines out of the claim rows and the sentence', () => {
    const html = render([...BASE, GROUPS]);
    const rows = html.slice(html.indexOf('The claims agents read'), html.indexOf('business-never'));
    expect(rows).not.toContain('never#7');
    expect(text(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? '')).not.toContain('groups');
  });
});

describe('a Never line the draft proposed', () => {
  it('waits in the list, dashed, with its receipt and ✓ Right / ✗ Wrong', () => {
    const html = render([...BASE, TENDERS]);
    const line = lineOf(html, 8);
    expect(line).toContain('data-state="proposed"');
    expect(text(line)).toContain('Answer public tenders');
    expect(text(line)).toContain('proposed');
    expect(text(line)).toContain('we don\'t answer public tenders');
    expect(buttons(line).map((b) => b.text)).toEqual(['✓ Right', '✗ Wrong']);
  });

  it('is neither a row of "What we found" nor an addition on top', () => {
    const html = render([...BASE, claim(3, 'never', 'Sell to banks'), TENDERS]);
    expect(html).not.toContain('data-found="never#8"');
    expect(html).not.toContain('data-check="never#8"');
  });
});

describe('the anchor the App links to', () => {
  it('gives each line the id never-<seq>, once', () => {
    const html = render([...BASE, GROUPS, TENDERS]);
    expect(html.match(/id="never-7"/g)).toHaveLength(1);
    expect(html.match(/id="never-8"/g)).toHaveLength(1);
  });
});

describe('the demo', () => {
  it('shows a sample Never line, naming no real company', () => {
    const html = render(DEMO_CLAIMS, { demo: true });
    const lines = DEMO_CLAIMS.filter((c) => c.kind === 'never');
    expect(lines.length).toBeGreaterThan(0);
    for (const c of lines) expect(lineOf(html, c.seq)).not.toBe('');
  });

  it('adds a line in memory, up to 200 characters, and refuses a longer one', async () => {
    const port = demoBusinessPort(DEMO_CLAIMS);
    expect(await port.pick('never', 'y'.repeat(200))).toMatchObject({ ok: true, claim: { kind: 'never', state: 'confirmed', source: 'pick' } });
    expect(await port.pick('never', 'y'.repeat(201))).toEqual({ ok: false, message: NEVER_INVALID });
    expect(await port.pick('rival', 'y'.repeat(81))).not.toMatchObject({ ok: true });
  });
});

describe('at 393 px', () => {
  const read = (file: string) => readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const css = `${read('./business.css')}\n${read('./never.css')}`;
  const rule = (selector: string) => {
    const at = css.lastIndexOf(`${selector} {`);
    expect(at, selector).toBeGreaterThanOrEqual(0);
    return css.slice(at, css.indexOf('}', at));
  };

  it('wraps each line and breaks a long one', () => {
    const html = render([...BASE, claim(9, 'never', 'x'.repeat(200))]);
    expect(lineOf(html, 9)).toContain('class="business-row business-never-line"');
    expect(rule('.business-row')).toContain('flex-wrap: wrap');
    expect(rule('.business-row-main strong')).toContain('overflow-wrap: anywhere');
    expect(rule('.business-never ul')).toContain('min-width: 0');
  });

  it('fixes no width wider than a 393 px screen less its gutters', () => {
    const widths = [...read('./never.css').matchAll(/(?:^|[;{\s])(?:min-)?(?:width|flex(?:-basis)?)\s*:[^;]*?(\d+)px/g)].map((m) => Number(m[1]));
    expect(Math.max(0, ...widths)).toBeLessThanOrEqual(393 - 2 * 16);
  });

  it('is loaded by the Business page', () => {
    const page = readFileSync(fileURLToPath(new URL('../../app/app/settings/business/page.tsx', import.meta.url)), 'utf8');
    expect(page).toContain('src/business/never.css');
  });
});

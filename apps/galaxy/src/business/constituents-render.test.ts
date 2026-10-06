import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { demoConstituentsPort, NOT_OWNER, type ConstituentPort } from '../constituents/store';
import { faceOf } from '../people/face';
import type { Person } from '../people/types';
import {
  constituentsReducer, initialConstituentsState, panelOf, vagueHint, vagueWordsOf, whenOf, writeConstituent,
  type ConstituentsAction, type ConstituentsState, type ConstituentWrite,
} from './constituents-panel';
import {
  ADD_NEVER_LINE, ADD_STATEMENT, CONSTITUENTS_TITLE, ConstituentsPanel, EDIT_STATEMENT, NO_NEVER, NO_STATEMENT, REMOVE, SAVE, UNREADABLE,
} from './ConstituentsPanel';
import { BusinessScreen, DEMO_CLAIMS, DEMO_CONSTITUENTS, DEMO_PRODUCTS } from './BusinessScreen';
import { BusinessView } from './BusinessView';
import type { Claim } from './model';
import { initialBusinessState } from './state';
import { sure } from '../arcade/test/sure';

// Settings › Business's Constituents panel (PRD 871 s2): an owner adds a Statement and two Never lines,
// edits the Statement and removes never#2, through the store's rules (the demo port, the functions'
// rules in memory); the panel shows the result, and the History drawer lists every event newest first
// with its person, its date and time, and its before and after. A member sees the same with no control.
// The vague-word hint shows under the Never line field and never blocks Save.

const PRODUCT = 'p-1';
const OWNER_ID = 'u-owner';
const PEOPLE: Record<string, Person> = { [OWNER_ID]: { name: 'Pierre', face: faceOf({ name: 'Pierre' }), login: 'pierre' } };

let tick = 0;
const now = () => new Date(Date.UTC(2026, 9, 1, 9, tick++)).toISOString();

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const buttons = (html: string) => [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map((m) => ({ attrs: m[1], text: text(sure(m[2], 'm[2]')) }));
const history = (html: string) => {
  const from = html.indexOf('<details class="constituents-history"');
  return from < 0 ? '' : html.slice(from, html.indexOf('</details>', from));
};
const events = (html: string) => [...history(html).matchAll(/<li class="constituents-event"[^>]*>([\s\S]*?)<\/li>/g)].map((m) => text(sure(m[1], 'm[1]')));

const render = (state: ConstituentsState, { owner = true, unreadable = false } = {}) =>
  renderToStaticMarkup(createElement(ConstituentsPanel, { state, product: PRODUCT, owner, people: PEOPLE, unreadable }));

/** Runs the writes through `port` as the owner, as BusinessPage does: busy, then the answer. */
async function run(port: ConstituentPort, writes: Array<(s: ConstituentsState) => ConstituentWrite>, start = initialConstituentsState([], [])) {
  let state = start;
  for (const write of writes) {
    state = constituentsReducer(state, { type: 'busy' });
    state = constituentsReducer(state, await writeConstituent(port, write(state), OWNER_ID, now));
  }
  return state;
}

const save = (write: ConstituentWrite) => () => write;
const statementOf = (s: ConstituentsState) => panelOf(s, PRODUCT).statement;
const lineOf = (s: ConstituentsState, id: string) => sure(s.constituents.find((c) => c.displayId === id && !c.removed), 's.constituents.find((c) => c.displayId === id && c.removed)');

async function filled() {
  tick = 0;
  const port = demoConstituentsPort({ products: [PRODUCT], by: OWNER_ID, now: () => '2026-10-01T08:00:00.000Z' });
  const state = await run(port, [
    save({ kind: 'save', product: PRODUCT, field: { kind: 'statement', id: null }, text: 'The component workshop', before: null }),
    save({ kind: 'save', product: PRODUCT, field: { kind: 'never' }, text: 'Calls real APIs', before: null }),
    save({ kind: 'save', product: PRODUCT, field: { kind: 'never' }, text: 'Holds business logic', before: null }),
    (s) => ({ kind: 'save', product: PRODUCT, field: { kind: 'statement', id: sure(statementOf(s), 'statementOf(s)').id }, text: 'The component workshop, with fixtures', before: sure(statementOf(s), 'statementOf(s)').text }),
    (s) => ({ kind: 'remove', line: lineOf(s, 'never#2') }),
  ]);
  return { port, state };
}

describe('an owner writing a product\'s constituents', () => {
  it('shows the Statement and the live Never lines, each anchored #never-<n>, never#2 gone', async () => {
    const { state } = await filled();
    const html = render(state);
    expect(text(html)).toContain(CONSTITUENTS_TITLE);
    expect(text(html)).toContain('The component workshop, with fixtures');
    expect(html).toContain('id="never-1"');
    expect(html).not.toContain('id="never-2"');
    expect(text(html)).toContain('never#1 Calls real APIs');
    expect(text(html.slice(0, html.indexOf('<details')))).not.toContain('Holds business logic');
  });

  it('lists every event newest first in the History drawer, with the person, the time, the before and the after', async () => {
    const { state } = await filled();
    const html = render(state);
    expect(text(history(html))).toContain('History · 5');
    const lines = events(html);
    expect(lines).toHaveLength(5);
    expect(lines[0]).toBe('Pierre removed never#2 1 Oct 2026, 09:04 UTC Before Holds business logic');
    expect(lines[1]).toBe('Pierre edited statement 1 Oct 2026, 09:03 UTC Before The component workshop After The component workshop, with fixtures');
    expect(lines.slice(2).map((l) => l.split(' ').slice(0, 3).join(' '))).toEqual(['Pierre added never#2', 'Pierre added never#1', 'Pierre added statement']);
    expect(history(html)).toContain('href="/app/people/pierre"');
    expect(history(html)).toContain('dateTime="2026-10-01T09:04:00.000Z"');
  });

  it('gives the next Never line never#3, not never#2', async () => {
    const { port, state } = await filled();
    const next = await run(port, [save({ kind: 'save', product: PRODUCT, field: { kind: 'never' }, text: 'Ships without the keyboard', before: null })], state);
    expect(panelOf(next, PRODUCT).never.map((l) => l.displayId)).toEqual(['never#1', 'never#3']);
    expect(render(next)).toContain('id="never-3"');
  });

  it('shows Edit, + Never line and a Remove per line', async () => {
    const { state } = await filled();
    expect(buttons(render(state)).map((b) => b.text)).toEqual([EDIT_STATEMENT, REMOVE, ADD_NEVER_LINE]);
  });

  it('offers + Statement on an empty product, and says there is no line yet', () => {
    const html = render(initialConstituentsState([], []));
    expect(buttons(html).map((b) => b.text)).toEqual([ADD_STATEMENT, ADD_NEVER_LINE]);
    expect(text(html)).toContain(NO_STATEMENT);
    expect(text(html)).toContain(NO_NEVER);
  });

  it('says a refusal, and keeps the field open', async () => {
    const refusing: ConstituentPort = {
      add: () => Promise.resolve({ ok: false, message: NOT_OWNER }), edit: () => Promise.resolve({ ok: false, message: NOT_OWNER }), remove: () => Promise.resolve({ ok: false, message: NOT_OWNER }),
    };
    const open = constituentsReducer(initialConstituentsState([], []), { type: 'add-never' });
    const state = await run(refusing, [save({ kind: 'save', product: PRODUCT, field: { kind: 'never' }, text: 'x', before: null })], open);
    expect(state.editing).toEqual({ kind: 'never' });
    expect(text(render(state))).toContain(NOT_OWNER);
  });
});

describe('a member', () => {
  it('sees the Statement, the Never list and the History with no Edit, add or remove control', async () => {
    const { state } = await filled();
    const html = render(state, { owner: false });
    expect(buttons(html)).toEqual([]);
    expect(html).not.toContain('<input');
    expect(text(html)).toContain('The component workshop, with fixtures');
    expect(text(html)).toContain('never#1 Calls real APIs');
    expect(events(html)).toHaveLength(5);
  });

  it('sees no field even when the state holds one open', () => {
    const open = constituentsReducer(initialConstituentsState([], []), { type: 'add-never' });
    expect(render(open, { owner: false })).not.toContain('<input');
  });
});

describe('the vague-word hint', () => {
  const typing = (value: string, kind: 'never' | 'statement' = 'never') => {
    const actions: ConstituentsAction[] = [kind === 'never' ? { type: 'add-never' } : { type: 'edit-statement', statement: null }, { type: 'text', text: value }];
    return actions.reduce(constituentsReducer, initialConstituentsState([], []));
  };

  it('shows under the Never line field on "world-class components", and Save stays enabled', () => {
    const html = render(typing('world-class components'));
    expect(text(html)).toContain('“world-class” names nothing a spec can break — say what it would look like.');
    const saveButton = sure(buttons(html).find((b) => b.text === SAVE), 'buttons(html).find((b) => b.text === SAVE)');
    expect(saveButton.attrs).not.toContain('disabled');
  });

  it('is not there for a line that names something checkable, nor for the Statement', () => {
    expect(render(typing('Calls real APIs'))).not.toContain('constituents-hint');
    expect(render(typing('world-class components', 'statement'))).not.toContain('constituents-hint');
  });

  it('reads whole words of the fixed list only, whatever their case', () => {
    expect(vagueWordsOf('World-Class and SEAMLESS')).toEqual(['world-class', 'seamless']);
    expect(vagueWordsOf('a bestseller of quality-control')).toEqual([]);
    expect(vagueWordsOf('the best, nice and great; modern beautiful quality')).toEqual(['best', 'nice', 'quality', 'great', 'beautiful', 'modern']);
    expect(vagueHint('Calls real APIs')).toBeNull();
  });
});

describe('on Settings › Business', () => {
  const claim = (seq: number, kind: Claim['kind'], value: string, state: Claim['state'] = 'confirmed'): Claim =>
    ({ id: `c-${seq}`, seq, kind, value, source: 'pick', state, cited: 0, lastBy: null });

  it('sits above the claims, in the demo as an owner with nothing yet', () => {
    const html = renderToStaticMarkup(createElement(BusinessScreen, {
      view: { kind: 'business', source: { kind: 'demo' }, claims: DEMO_CLAIMS, products: DEMO_PRODUCTS, personas: [], constituents: DEMO_CONSTITUENTS },
    }));
    const panel = html.indexOf('business-constituents');
    expect(panel).toBeGreaterThan(0);
    expect(panel).toBeLessThan(html.indexOf('The claims agents read'));
    expect(text(html)).toContain(ADD_STATEMENT);
  });

  it('is not drawn when the page has no constituents', () => {
    const html = renderToStaticMarkup(createElement(BusinessScreen, {
      view: { kind: 'business', source: { kind: 'demo' }, claims: DEMO_CLAIMS, products: DEMO_PRODUCTS, personas: [] },
    }));
    expect(html).not.toContain('business-constituents');
  });

  it('leaves the Never kind out of the claim editor: no Never claim is drawn, and nothing offers one', () => {
    const claims = [
      claim(1, 'offering', 'ERP'), claim(6, 'never', 'Build for groups', 'rejected'),
      claim(7, 'never', 'Answer tenders', 'proposed'), claim(8, 'never', 'Old line'),
    ];
    const html = renderToStaticMarkup(createElement(BusinessView, { state: initialBusinessState(claims) }));
    expect(html).not.toContain('never#');
    expect(text(html)).not.toMatch(/Build for groups|Answer tenders|Old line|\+ Never line|Never lines/);
    expect(html).not.toContain('Marked wrong');
    expect(DEMO_CLAIMS.some((c) => c.kind === 'never')).toBe(false);
  });
});

describe('the panel', () => {
  it('says when the constituents could not be read, and draws no control', () => {
    const html = render(initialConstituentsState([], []), { unreadable: true });
    expect(text(html)).toContain(UNREADABLE);
    expect(buttons(html)).toEqual([]);
  });

  it('names the move by Omni Loop, with its note', () => {
    const state = initialConstituentsState(
      [{ id: 'k-1', product: PRODUCT, kind: 'never', displayId: 'never#1', text: 'Build for groups', removed: false, updatedAt: '2026-10-01T00:00:00Z' }],
      [{ id: 1, product: PRODUCT, constituent: 'k-1', action: 'moved', before: null, after: 'Build for groups', note: 'moved from Business never#6', by: null, at: '2026-10-01T00:00:00Z' }],
    );
    expect(events(render(state))[0]).toBe('Omni Loop moved from Business never#1 1 Oct 2026, 00:00 UTC After Build for groups moved from Business never#6');
  });

  it('formats a date the same on the server and in the browser', () => {
    expect(whenOf('2026-09-30T23:05:00Z')).toBe('30 Sep 2026, 23:05 UTC');
    expect(whenOf('nonsense')).toBe('nonsense');
  });

  it('wraps at 393 px and reads in both themes: its stylesheet uses the theme tokens and breaks long words', () => {
    const css = readFileSync(fileURLToPath(new URL('./constituents.css', import.meta.url)), 'utf8');
    expect(css).toMatch(/overflow-wrap:\s*anywhere/);
    expect(css).toMatch(/min-width:\s*0/);
    expect(css).not.toMatch(/#[0-9a-f]{3,6}\b/i);
  });
});

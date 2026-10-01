import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PERSONA_TRADES } from '@omni/design';
import type { Product } from './model';
import { initialPersonasState, personasReducer, pickerOf, type Persona, type PersonasAction } from './personas';
import { ADD_PERSONA, NO_PERSONAS, PersonasSection, SHUFFLE, UNDO } from './PersonasSection';
import { BusinessScreen, DEMO_CLAIMS, DEMO_PERSONAS, DEMO_PRODUCTS } from './BusinessScreen';
import { businessReducer, initialBusinessState } from './state';
import { BusinessView } from './BusinessView';

// Settings → Business → Personas as the server renders it (PRD 799 s3): the empty section, the card
// grid, the drawer with its fields and portrait picker, two products each with its own cast, no
// "product" with one, the demo, and a layout that holds at 393 px.

const AVATAR = { v: 1 as const, skin: 2, hair: 1, hairColor: 1, outfit: 2, accessory: 1 };
const persona = (n: number, over: Partial<Persona> = {}): Persona => ({
  id: `pe-${n}`, product: 'p-1', ordinal: n, name: `Person ${n}`, stance: 'neutral', trade: 'plumber', avatar: AVATAR, who: '', usage: '', ...over,
});
const ONE: Product[] = [{ id: 'p-1', name: 'Vertuoza' }];
const TWO: Product[] = [{ id: 'p-1', name: 'Vertuoza' }, { id: 'p-2', name: 'Omni Loop' }];
const CAST = [
  persona(1, { name: 'Marc', stance: 'skeptical', who: 'Runs five plumbers', usage: 'Mostly the quotes' }),
  persona(2, { name: 'Sofia', stance: 'excited', trade: 'office' }),
  persona(3, { name: 'Anne', trade: 'accountant', product: 'p-2' }),
];

const render = (personas: Persona[], { products = ONE, current = 'p-1', actions = [] as PersonasAction[] } = {}) =>
  renderToStaticMarkup(createElement(PersonasSection, {
    state: actions.reduce(personasReducer, initialPersonasState(personas)), products, current,
  }));
const text = (html: string) => html.replace(/<title>[\s\S]*?<\/title>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const buttons = (html: string) => [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map((m) => ({ attrs: m[1], text: text(m[2]!) }));
const cards = (html: string) => [...html.matchAll(/data-persona="([^"]+)"/g)].map((m) => m[1]);
const cardOf = (html: string, id: string) => {
  const from = html.indexOf(`data-persona="${id}"`);
  return from < 0 ? '' : html.slice(from, html.indexOf('</li>', from));
};
const variations = (html: string) => [...html.matchAll(/<button\b[^>]*class="business-persona-variation"[^>]*>([\s\S]*?)<\/button>/g)].map((m) => m[1]);

describe('an empty cast', () => {
  it('says "No personas yet — agents carry on", with + Add a persona and a count of 0', () => {
    const html = render([]);
    expect(text(html)).toContain(NO_PERSONAS);
    expect(buttons(html).map((b) => b.text)).toEqual([ADD_PERSONA]);
    expect(text(html)).toMatch(/Personas 0/);
    expect(cards(html)).toEqual([]);
  });
});

describe('the card grid', () => {
  it('draws one card per persona, oldest first, with the count', () => {
    const html = render(CAST);
    expect(cards(html)).toEqual(['pe-1', 'pe-2', 'pe-3']);
    expect(text(html)).toMatch(/Personas 3/);
    expect(text(html)).not.toContain(NO_PERSONAS);
  });

  it('shows the portrait, name, trade, stance chip, who and uses', () => {
    const card = cardOf(render(CAST), 'pe-1');
    expect(card).toContain('<svg');
    expect(card).toContain('aria-label="Marc, Plumber"');
    expect(text(card)).toContain('Marc Plumber Skeptical');
    expect(card).toContain('data-stance="skeptical"');
    expect(text(card)).toContain('Who Runs five plumbers');
    expect(text(card)).toContain('Uses Mostly the quotes');
    expect(buttons(card).map((b) => b.attrs)).toEqual([expect.stringContaining('aria-label="Edit Marc"')]);
  });

  it('draws the trade\'s label: an office manager, not "office"', () => {
    expect(text(cardOf(render(CAST), 'pe-2'))).toContain('Sofia Office manager Excited');
  });

  it('draws an empty portrait for a trade it cannot draw, and keeps that trade while editing', () => {
    const odd = [persona(9, { name: 'Lou', trade: 'welder' })];
    const card = cardOf(render(odd), 'pe-9');
    expect(card).not.toContain('<svg');
    expect(text(card)).toContain('Lou welder');
    const edit = render(odd, { actions: [{ type: 'edit', persona: 'pe-9', seed: 'e' }] });
    expect([...edit.matchAll(/<option value="([^"]+)"/g)].map((m) => m[1])[0]).toBe('welder');
  });

  it('leaves out who and uses when empty', () => {
    const card = text(cardOf(render(CAST), 'pe-2'));
    expect(card).not.toContain('Who');
    expect(card).not.toContain('Uses');
  });
});

describe('the drawer', () => {
  const open = render(CAST, { actions: [{ type: 'new', product: 'p-1', seed: 'a' }] });

  it('holds the name, the three stance chips, the trade select, who, usage and the picker', () => {
    expect(open).toContain('aria-label="Add a persona"');
    const tag = (name: string) => [...open.matchAll(/<(?:input|textarea|select)\b[^>]*>/g)].map((m) => m[0]).find((t) => t.includes(`name="${name}"`)) ?? '';
    expect(tag('name')).toContain('maxLength="40"');
    const stances = buttons(open).filter((b) => b.attrs!.includes('data-stance'));
    expect(stances.map((b) => [b.text, b.attrs!.includes('aria-pressed="true"')])).toEqual([['Excited', false], ['Neutral', true], ['Skeptical', false]]);
    const options = [...open.matchAll(/<option value="([^"]+)"/g)].map((m) => m[1]);
    expect(options).toEqual(PERSONA_TRADES.map((t) => t.id));
    expect(tag('who')).toContain('maxLength="400"');
    expect(tag('usage')).toContain('maxLength="400"');
    expect(tag('trade')).toContain('<select');
    expect(text(open)).toContain('Who they are');
    expect(text(open)).toContain('How they use it');
    expect(buttons(open).map((b) => b.text)).toEqual(expect.arrayContaining([SHUFFLE, 'Save', 'Cancel']));
    expect(buttons(open).map((b) => b.text)).not.toContain('Delete');
    expect(buttons(open).map((b) => b.text)).not.toContain(ADD_PERSONA);
  });

  it('shows 24 variations of the chosen trade, and Shuffle shows 24 others', () => {
    const first = variations(open);
    expect(first).toHaveLength(24);
    expect(first.every((v) => v!.includes('aria-label="Builder, variation'))).toBe(true);
    const shuffled = variations(render(CAST, { actions: [{ type: 'new', product: 'p-1', seed: 'a' }, { type: 'shuffle' }] }));
    expect(shuffled).toHaveLength(24);
    expect(shuffled.some((v) => first.includes(v))).toBe(false);
    const plumber = variations(render(CAST, { actions: [{ type: 'new', product: 'p-1', seed: 'a' }, { type: 'change', fields: { trade: 'plumber' } }] }));
    expect(plumber.every((v) => v!.includes('aria-label="Plumber, variation'))).toBe(true);
  });

  it('outlines the chosen variation, and only it', () => {
    const drawer = [{ type: 'new', product: 'p-1', seed: 'a' }] as PersonasAction[];
    const third = pickerOf(drawer.reduce(personasReducer, initialPersonasState(CAST)).drawer!)[2];
    const html = render(CAST, { actions: [...drawer, { type: 'change', fields: { avatar: third } }] });
    expect(variations(html).length).toBe(24);
    const pressed = [...html.matchAll(/class="business-persona-variation" aria-pressed="(true|false)"/g)].map((m) => m[1] === 'true');
    expect(pressed.map((on, i) => (on ? i : -1)).filter((i) => i >= 0)).toEqual([2]);
  });

  it('edits a persona with its own fields, and offers Delete', () => {
    const html = render(CAST, { actions: [{ type: 'edit', persona: 'pe-1', seed: 'e' }] });
    expect(html).toContain('aria-label="Edit Marc"');
    expect(html).toMatch(/<input[^>]*name="name" value="Marc"/);
    expect(buttons(html).map((b) => b.text)).toContain('Delete');
  });

  it('says a refusal inside the drawer', () => {
    const html = render(CAST, { actions: [{ type: 'new', product: 'p-1', seed: 'a' }, { type: 'refused', message: 'A name: 1 to 40 characters, on one line.' }] });
    expect(html).toMatch(/role="alert">A name: 1 to 40 characters, on one line\.</);
  });
});

describe('delete and Undo', () => {
  it('removes the card at once and offers Undo', () => {
    const html = render(CAST, { actions: [{ type: 'deleted', persona: CAST[0]!, at: 1 }] });
    expect(cards(html)).toEqual(['pe-2', 'pe-3']);
    expect(text(html)).toContain('Deleted Marc.');
    expect(buttons(html).map((b) => b.text)).toContain(UNDO);
  });

  it('brings the card back in its place', () => {
    const html = render(CAST, { actions: [{ type: 'deleted', persona: CAST[0]!, at: 1 }, { type: 'restored', persona: CAST[0]! }] });
    expect(cards(html)).toEqual(['pe-1', 'pe-2', 'pe-3']);
    expect(buttons(html).map((b) => b.text)).not.toContain(UNDO);
  });
});

describe('products', () => {
  it('gives each product tab its own cast, named in the title', () => {
    const first = render(CAST, { products: TWO, current: 'p-1' });
    expect(cards(first)).toEqual(['pe-1', 'pe-2']);
    expect(text(first)).toContain('Personas · Vertuoza 2');
    const second = render(CAST, { products: TWO, current: 'p-2' });
    expect(cards(second)).toEqual(['pe-3']);
    expect(text(second)).toContain('Personas · Omni Loop 1');
  });

  it('never says "product" with one product, the drawer open or not', () => {
    for (const actions of [[], [{ type: 'new', product: 'p-1', seed: 'a' }], [{ type: 'edit', persona: 'pe-1', seed: 'e' }]] as PersonasAction[][]) {
      expect(text(render(CAST, { actions })).toLowerCase()).not.toContain('product');
    }
  });

  it('follows the tab shown on the whole page', () => {
    const state = [{ type: 'show-product', product: 'p-2' } as const].reduce(businessReducer, initialBusinessState([], TWO));
    const html = renderToStaticMarkup(createElement(BusinessView, {
      state, personas: createElement(PersonasSection, { state: initialPersonasState(CAST), products: state.products, current: state.current }),
    }));
    expect(cards(html)).toEqual(['pe-3']);
    expect(html.indexOf('business-personas')).toBeGreaterThan(html.indexOf('role="tablist"'));
  });
});

describe('the demo', () => {
  const html = renderToStaticMarkup(createElement(BusinessScreen, {
    view: { kind: 'business', source: { kind: 'demo' }, claims: DEMO_CLAIMS, products: DEMO_PRODUCTS, personas: DEMO_PERSONAS },
  }));

  it('shows the sample personas below the claims', () => {
    expect(cards(html)).toEqual(DEMO_PERSONAS.map((p) => p.id));
    expect(html.indexOf('business-personas')).toBeGreaterThan(html.indexOf('data-claim='));
  });

  it('holds a persona of every stance, of the demo\'s product, each on a trade the page draws', () => {
    expect(new Set(DEMO_PERSONAS.map((p) => p.stance))).toEqual(new Set(['excited', 'neutral', 'skeptical']));
    expect(DEMO_PERSONAS.every((p) => p.product === DEMO_PRODUCTS[0]!.id)).toBe(true);
    expect(DEMO_PERSONAS.every((p) => PERSONA_TRADES.some((t) => t.id === p.trade))).toBe(true);
  });

  it('names no company: no sample text holds a capitalised company word', () => {
    const said = DEMO_PERSONAS.flatMap((p) => [p.who, p.usage]).join(' ');
    expect(said).not.toMatch(/\b(?:Inc|Ltd|SA|SRL|BV|GmbH|NV|LLC)\b/);
    expect(said).not.toMatch(/Vertuoza/i);
  });

  it('draws an empty section on the demo with no persona', () => {
    const empty = renderToStaticMarkup(createElement(BusinessScreen, {
      view: { kind: 'business', source: { kind: 'demo' }, claims: [], products: DEMO_PRODUCTS },
    }));
    expect(text(empty)).toContain(NO_PERSONAS);
  });
});

describe('the layout at 393 px', () => {
  const css = readFileSync(fileURLToPath(new URL('./business.css', import.meta.url)), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rule = (selector: string) => {
    const at = css.lastIndexOf(`${selector} {`);
    expect(at, selector).toBeGreaterThanOrEqual(0);
    return css.slice(at, css.indexOf('}', at));
  };

  it('lets the grid fall to one column, and the drawer stack', () => {
    expect(rule('.business-persona-grid')).toContain('minmax(min(100%, 220px), 1fr)');
    expect(rule('.business-persona-drawer')).toContain('flex-wrap: wrap');
  });

  it('wraps the header, each card\'s top, the stances and the actions, and breaks long words', () => {
    for (const selector of ['.business-personas-head', '.business-persona-top', '.business-personas-undo', '.business-persona-actions', '.business-persona-picker-head']) {
      expect(rule(selector), selector).toContain('flex-wrap: wrap');
    }
    for (const selector of ['.business-persona-name', '.business-persona-line', '.business-personas-hint']) {
      expect(rule(selector), selector).toContain('overflow-wrap: anywhere');
    }
  });

  it('draws the portraits unsmoothed', () => {
    expect(rule('.business-portrait svg')).toContain('image-rendering: pixelated');
  });
});

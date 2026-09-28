import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DEMO_PROJECTS, lookOf } from '@omni/galaxy';
import type { Form } from '../form';
import { gridFor } from '../grid';
import { Press } from '../hint';
import { nameInit } from '../name-entry';
import { ScreenContext } from '../Screen';
import type { FleetRow } from '../types';
import { TALL, WIDE, type Grid } from './common.ts';
import { cardRow, TALL_SCENES } from './recruit.ts';
import { BuilderOverlay, NameOverlay, SelectOverlay } from './recruit.tsx';

const fleets: FleetRow[] = Object.entries(DEMO_PROJECTS.teams)
  .map(([name, t]) => ({ name, ...lookOf(name, t) }))
  .filter((f) => !f.retired)
  .sort((a, b) => a.sort - b.sort);
const hero = { v: 1 as const, body: 'girl' as const, skin: 1, hair: 0, suit: 0, cape: 1 };

/** A text layer as it renders on `form`, on the grid that form draws the scene on, its hints clickable. */
function render(form: Form, grid: Grid, layer: ReactElement): string {
  const pressable = createElement(Press.Provider, { value: () => {} }, layer);
  return renderToStaticMarkup(createElement(ScreenContext.Provider, { value: { form, grid, page: 0, pages: 1 } }, pressable));
}

/** The words of the key hint line at the bottom of the screen. */
function hintLine(html: string): string {
  const line = html.match(/<p class="j-hint[^"]*">(.*?)<\/p>/)?.[1] ?? '';
  return line.replace(/<[^>]+>/g, ' ').replace(/&nbsp;| /g, ' ').replace(/\s+/g, ' ').trim();
}

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

const name = () => createElement(NameOverlay, { state: nameInit('GUEST'), shake: false, team: 'beaver', error: null });
const builder = () => createElement(BuilderOverlay, { hero, row: 0, team: 'beaver', name: 'GUEST', error: null, onRow: () => {} });
const select = (pick = 0, n = fleets.length) => createElement(SelectOverlay, {
  fleets: fleets.slice(0, n), pick, change: false, locked: false, confirm: false, current: null, disbanded: false, crew: {}, onPick: () => {},
});

describe('the recruit group on the tall grid', () => {
  it('lists the fleet select, the name entry and the hero builder as tall', () => {
    expect([...TALL_SCENES].sort()).toEqual(['hero', 'name', 'select']);
    for (const scene of ['select', 'name', 'hero'] as const) {
      expect(gridFor('handheld', scene)).toBe(TALL);
      expect(gridFor('full', scene)).toBe(WIDE);
      expect(gridFor('advance', scene)).toBe(WIDE);
    }
  });
});

describe('the fleet cards', () => {
  it('sit where they always have on the wide grid, every fleet on the row', () => {
    expect(cardRow(5, 2, WIDE)).toEqual({ first: 0, count: 5, x0: 180, y: 282, w: 48, h: 46, gap: 10, lift: 4 });
  });

  it('fit inside the tall grid, the one under the cursor always among them', () => {
    for (let n = 1; n <= 12; n++) {
      for (let pick = 0; pick < n; pick++) {
        const row = cardRow(n, pick, TALL);
        expect(row.x0, `${n} fleets`).toBeGreaterThanOrEqual(0);
        expect(row.x0 + row.count * (row.w + row.gap) - row.gap).toBeLessThanOrEqual(TALL.w);
        expect(row.y + row.h + row.lift).toBeLessThanOrEqual(TALL.h);
        expect(pick).toBeGreaterThanOrEqual(row.first);
        expect(pick).toBeLessThan(row.first + row.count);
        expect(row.first + row.count).toBeLessThanOrEqual(n);
      }
    }
  });

  it('show every fleet at once when they fit, as today\'s five do', () => {
    expect(cardRow(5, 4, TALL)).toMatchObject({ first: 0, count: 5 });
    expect(cardRow(6, 0, TALL)).toMatchObject({ first: 0, count: 6 });
  });

  it('are a button each on the tall grid, for the cards it shows', () => {
    const html = render('handheld', TALL, select(0));
    expect(html.match(/class="j-card"/g)).toHaveLength(fleets.length + 1); // and PLAY SOLO
    const many = render('handheld', TALL, createElement(SelectOverlay, {
      fleets: Array.from({ length: 9 }, (_, i) => ({ ...fleets[i % fleets.length], name: `f${i}`, label: `F${i}` })),
      pick: 8, change: false, locked: false, confirm: false, current: null, disbanded: false, crew: {}, onPick: () => {},
    }));
    expect(many.match(/class="j-card"/g)).toHaveLength(cardRow(10, 8, TALL).count);
    expect(many).toContain('aria-label="F8"');
  });
});

describe('the fleet step, a fleet optional (PRD 400)', () => {
  const pickOf = (pick: number, over: Partial<Parameters<typeof SelectOverlay>[0]> = {}) => createElement(SelectOverlay, {
    fleets, pick, change: false, locked: false, confirm: false, current: null, disbanded: false, crew: {}, onPick: () => {}, ...over,
  });

  it('offers each active fleet and a PLAY SOLO card after them', () => {
    const html = render('full', WIDE, pickOf(0));
    const labels = [...html.matchAll(/class="j-card" aria-label="([^"]*)"/g)].map(([, l]) => l);
    expect(labels).toEqual([...fleets.map((f) => f.label), 'PLAY SOLO']);
  });

  it('reads PLAY SOLO, never a fleet, with the solo card under the cursor', () => {
    const shown = text(render('full', WIDE, pickOf(fleets.length)));
    expect(shown).toContain('PLAY SOLO');
    expect(shown).toContain('Flies alone. Every point is your own.');
    expect(shown).not.toContain('UNCREWED');
  });

  it('says SOLO! when solo is locked in, and warns a fleet player that leaving keeps their past points', () => {
    expect(text(render('full', WIDE, pickOf(fleets.length, { locked: true })))).toContain('SOLO!');
    const confirm = text(render('full', WIDE, pickOf(fleets.length, { change: true, confirm: true, current: fleets[0].name })));
    expect(confirm).toContain('YOUR FUTURE POINTS ARE YOUR OWN.');
    expect(confirm).toContain(`YOUR PAST POINTS STAY WITH ${fleets[0].label}`);
  });

  it('marks SOLO as a solo player\'s own choice when they come to join a fleet', () => {
    expect(text(render('full', WIDE, pickOf(fleets.length, { change: true, current: null })))).toContain('YOUR CHOICE');
    expect(text(render('full', WIDE, pickOf(0, { change: true, current: null })))).toContain('JOIN A FLEET');
  });

  it('shows the "raise your own" screen with no fleets: the owner reads where, a member whom to ask', () => {
    for (const grid of [WIDE, TALL]) {
      const owner = text(render(grid === TALL ? 'handheld' : 'full', grid, pickOf(0, { fleets: [], owner: true })));
      expect(owner).toContain('NO FLEETS YET — RAISE YOUR OWN!');
      expect(owner).toContain('SET THEM UP AT /app/fleets');
      expect(owner).not.toContain('ASK YOUR OWNER');
    }
    const member = text(render('full', WIDE, pickOf(0, { fleets: [], owner: false })));
    expect(member).toContain('NO FLEETS YET — RAISE YOUR OWN!');
    expect(member).toContain('ASK YOUR OWNER');
    expect(member).not.toContain('/app/fleets');
  });
});

describe('a solo player on the recruit screens', () => {
  it('reads SOLO on the hero builder and no badge on the name entry, never UNCREWED', () => {
    const named = text(render('full', WIDE, createElement(NameOverlay, { state: nameInit('GUEST'), shake: false, team: null, error: null })));
    expect(named).not.toContain('UNCREWED');
    const built = text(render('full', WIDE, createElement(BuilderOverlay, { hero, row: 0, team: null, name: 'GUEST', error: null, onRow: () => {} })));
    expect(built).not.toContain('UNCREWED');
  });
});

describe('the hints name the buttons you have', () => {
  for (const form of ['handheld', 'advance'] as const) {
    const grid = gridFor(form, 'name');

    it(`read B ERASE and START DONE on the name screen on ${form}`, () => {
      const hint = hintLine(render(form, grid, name()));
      expect(hint).toContain('B ERASE');
      expect(hint).toContain('START DONE');
      expect(hint).toContain('▲▼ SPIN');
      for (const k of ['ENTER', 'TAB', 'ESC', '⌫', 'TYPE', ' OR ']) expect(hint).not.toContain(k);
    });

    it(`read RANDOM (SELECT) on the hero builder on ${form}`, () => {
      const html = render(form, gridFor(form, 'hero'), builder());
      expect(text(html)).toContain('RANDOM (SELECT)');
      const hint = hintLine(html);
      expect(hint).toContain('SELECT RANDOM');
      expect(hint).toContain('START DONE');
      for (const k of ['ENTER', 'TAB', 'ESC', '⌫', 'TYPE']) expect(text(html)).not.toContain(k);
    });

    it(`name no key the Game Boy lacks on the fleet select on ${form}`, () => {
      const hint = hintLine(render(form, gridFor(form, 'select'), select()));
      expect(hint).toBe('◀ ▶ MOVE A LOCK IN B BACK');
    });
  }

  it('read as today on full', () => {
    expect(hintLine(render('full', WIDE, name()))).toBe('TYPE OR ▲▼ SPIN ◀▶ MOVE ⌫ ERASE ENTER DONE');
    const html = render('full', WIDE, builder());
    expect(text(html)).toContain('RANDOM (TAB)');
    expect(hintLine(html)).toBe('▲▼ ROW ◀▶ CHANGE TAB RANDOM ENTER DONE');
    expect(hintLine(render('full', WIDE, select()))).toBe('◀ ▶ MOVE A LOCK IN B BACK');
  });

  it('make B and START clickable where they stand for ⌫ and ENTER', () => {
    const html = render('handheld', TALL, name());
    expect(html).toMatch(/<button[^>]*class="j-hit"[^>]*><span class="j-key"[^>]*>B<\/span>ERASE<\/button>/);
    expect(html).toMatch(/<button[^>]*class="j-hit"[^>]*><span class="j-key"[^>]*>START<\/span>DONE<\/button>/);
  });
});

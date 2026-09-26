import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildGalaxy, demoEvents, DEMO_PROJECTS, lookOf } from '@omni/galaxy';
import { setFleets } from '../fleets';
import { HOUSE_BRAND } from '../brand';
import { markFor } from '../mark';
import { DEFAULT_THEME } from '../theme';
import { gridFor, pagesFor, TALL, WIDE, type Grid } from '../grid';
import { ScreenContext } from '../Screen';
import type { FleetRow, Player } from '../types';
import type { FrameState } from './common.ts';
import { layoutMap } from './map.ts';
import { BRIEFING_PAGES, drawMenu, PAGES, TALL_SCENES } from './menu.ts';
import { BriefingOverlay, doorOf, MenuOverlay, menuItems } from './menu.tsx';
import type { KnowledgeGraph } from '../../data/knowledge';

const now = new Date('2026-09-25T10:00:00Z');
const view = buildGalaxy(demoEvents(now), { projects: DEMO_PROJECTS, now, source: 'demo' });
const fleets: FleetRow[] = Object.entries(DEMO_PROJECTS.teams)
  .map(([name, t]) => ({ name, ...lookOf(name, t) }))
  .sort((a, b) => a.sort - b.sort);
const player: Player = {
  id: 'guest', display_name: 'MAXIMILIAN', team: fleets[1].name, team_since: null, github_login: 'max-gh',
  hero: { v: 1, body: 'girl', skin: 1, hair: 0, suit: 0, cape: 1 },
};

/** The text a screen shows, one run of text per entry, as a player reads it on `grid`'s `page`. */
function textOf(el: ReactElement, grid: Grid, page = 0, pages = 1): string[] {
  const html = renderToStaticMarkup(createElement(ScreenContext.Provider, { value: { form: 'handheld', grid, page, pages } }, el));
  return html
    .replace(/<!-- -->/g, '') // React's marker between two runs of text in one element
    .replace(/<[^>]+>/g, '\n')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"')
    .split('\n').map((s) => s.trim()).filter(Boolean);
}

beforeAll(() => { setFleets(fleets); });

describe('the menu group on the tall grid', () => {
  it('lists the menu and How to play as tall, so the Game Boy held upright draws them on 320×288', () => {
    expect([...TALL_SCENES].sort()).toEqual(['briefing', 'menu']);
    expect(gridFor('handheld', 'menu')).toBe(TALL);
    expect(gridFor('handheld', 'briefing')).toBe(TALL);
    for (const form of ['full', 'advance'] as const) {
      expect(gridFor(form, 'menu')).toBe(WIDE);
      expect(gridFor(form, 'briefing')).toBe(WIDE);
    }
  });
});

// A 2D context that keeps where each image lands (a sprite, the planet, the nebula), and the
// offscreen canvases the sprites and the planet render into.
function recorder() {
  const images: { x: number; y: number; w: number; h: number; sprite: boolean }[] = [];
  const ctx = new Proxy({} as Record<string | symbol, unknown>, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'createImageData') return (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });
      if (prop === 'createLinearGradient') return () => ({ addColorStop() {} });
      if (prop === 'drawImage') {
        return (img: { width: number; height: number }, x: number, y: number, w?: number, h?: number) => {
          images.push({ x, y, w: w ?? img.width, h: h ?? img.height, sprite: w !== undefined });
        };
      }
      return () => {};
    },
    set(target, prop, value) { target[prop] = value; return true; },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, images };
}

class FakeOffscreenCanvas {
  constructor(public width: number, public height: number) {}
  getContext() { return recorder().ctx; }
}

function frame(grid: Grid, team: string | null): FrameState {
  return {
    scene: 'menu', grid, page: 0, view, layout: layoutMap(view, grid), sel: 0, fleetSel: 0, t: 5, sceneT: 2, reduced: false, mark: markFor(HOUSE_BRAND.name), theme: DEFAULT_THEME,
    join: { fleets, pick: 0, lockedAt: null, team, away: false, hero: player.hero },
  };
}

describe('the menu on the canvas', () => {
  beforeAll(() => { vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas); });
  afterAll(() => { vi.unstubAllGlobals(); });

  it.each([['the player\'s hero', fleets[1].name], ['OmniMan (a visitor has no hero)', null]] as const)(
    'stands %s and the planet inside the tall grid',
    (_, team) => {
      const { ctx, images } = recorder();
      drawMenu(ctx, frame(TALL, team));
      const sprites = images.filter((i) => i.sprite);
      expect(sprites.length).toBeGreaterThan(0);
      for (const s of sprites) {
        expect(s.x).toBeGreaterThanOrEqual(-1);
        expect(s.y).toBeGreaterThanOrEqual(-1);
        expect(s.x + s.w).toBeLessThanOrEqual(TALL.w + 1);
        expect(s.y + s.h).toBeLessThanOrEqual(TALL.h + 1);
      }
      for (const i of images) { // the planet and the nebula show, at least in part
        expect(i.x).toBeLessThan(TALL.w);
        expect(i.y).toBeLessThan(TALL.h);
        expect(i.x + i.w).toBeGreaterThan(0);
        expect(i.y + i.h).toBeGreaterThan(0);
      }
    },
  );
});

describe('the menu', () => {
  const visitor = menuItems({ joined: false, linked: false, signedIn: true });
  const playing = menuItems({ joined: true, linked: true, signedIn: true });

  it('holds a visitor\'s seven items and a player\'s eight, STAR CHART right after GALAXY MAP', () => {
    expect(visitor.map((m) => m.id)).toEqual(['link', 'map', 'chart', 'fleets', 'heroes', 'briefing', 'signout']);
    expect(playing.map((m) => m.id)).toEqual(['map', 'chart', 'fleets', 'heroes', 'briefing', 'myhero', 'change', 'signout']);
    for (const items of [visitor, playing]) {
      const at = items.findIndex((m) => m.label === 'GALAXY MAP');
      expect(items[at + 1]).toEqual({ id: 'chart', label: 'STAR CHART', scene: 'chart' });
    }
  });

  it.each([['a visitor', visitor, null], ['a player', playing, player]] as const)(
    'shows %s every row, hint, badge and footer on the tall grid that it shows on the wide one',
    (_, items, me) => {
      const menu = createElement(MenuOverlay, { view, items: [...items], index: 0, me, onPick: () => {} });
      const wide = textOf(menu, WIDE);
      expect(textOf(menu, TALL)).toEqual(wide);
      for (const m of items) expect(wide).toContain(m.label);
      expect(wide).toContain('B · BACK TO TITLE');
    },
  );
});

describe('How to play', () => {
  const briefing = createElement(BriefingOverlay, { view });
  const tallPages = pagesFor('briefing', { view, grid: TALL });

  it('takes one page on the wide grid, and a page per section on the tall one', () => {
    expect(pagesFor('briefing', { view, grid: WIDE })).toBe(1);
    expect(tallPages).toBe(BRIEFING_PAGES.length);
    expect(tallPages).toBeGreaterThan(1);
    expect(PAGES.briefing?.({ view, grid: TALL })).toBe(tallPages);
  });

  it('shows every rule the wide page shows, across its tall pages', () => {
    const wide = textOf(briefing, WIDE);
    const tall = Array.from({ length: tallPages }, (_, page) => textOf(briefing, TALL, page, tallPages));
    const shown = new Set(tall.flat());
    for (const line of wide) expect(shown, line).toContain(line);
    const r = view.rules;
    for (const n of [r.zoneSecured, r.rescue, r.terraformOwner, r.terraformExpedition]) {
      expect(tall.flat().some((s) => s.includes(`+${n}`)), `+${n}`).toBe(true);
    }
    for (const k of Object.keys(r.woundClose) as (keyof typeof r.woundClose)[]) {
      expect(shown, k).toContain(`+${r.woundClose[k]} / −${r.decayPerTranche[k]}`);
    }
  });

  it('shows one section a page, says which page it is, and keeps the heading and the way back on each', () => {
    const tall = Array.from({ length: tallPages }, (_, page) => textOf(briefing, TALL, page, tallPages));
    tall.forEach((page, i) => {
      expect(page).toContain('HOW TO PLAY');
      expect(page).toContain(`PAGE ${i + 1}/${tallPages}`);
      expect(page.some((s) => s.includes('B · MENU'))).toBe(true);
    });
    expect(tall[0]).toContain('EARN');
    expect(tall[0]).not.toContain('ENTROPY · CLEAR IT / IT COSTS');
    expect(tall[1]).toContain('ENTROPY · CLEAR IT / IT COSTS');
    expect(tall[1]).not.toContain('EARN');
  });

  it('shows a page past the last as the last (the grid changed under it)', () => {
    expect(textOf(briefing, TALL, 5, tallPages)).toEqual(textOf(briefing, TALL, tallPages - 1, tallPages));
  });

  it('shows no page count on the wide grid', () => {
    expect(textOf(briefing, WIDE).some((s) => s.startsWith('PAGE'))).toBe(false);
  });
});

describe('the star chart on the menu', () => {
  const graph: KnowledgeGraph = {
    version: 1, repo: 'acme/widgets',
    domains: [
      { name: 'product', code: 'PRODUCT', scope: 'product', counts: { principles: 1, rules: 1, invariants: 0, laws: 1, proposed: 1 } },
      { name: 'quote', code: 'QUOTE', scope: 'domain', counts: { principles: 1, rules: 0, invariants: 0, laws: 0, proposed: 1 } },
    ],
    entries: ['P-PRODUCT-1', 'BR-PRODUCT-1', 'P-QUOTE-1'].map((id) => ({
      id, kind: id.startsWith('P-') ? 'principle' : 'rule', domain: id.includes('QUOTE') ? 'quote' : 'product', domains: [], statement: `${id} holds.`,
      why: null, status: 'law', serves: null, enforced: false, enforcedBy: null, prd: null, file: 'x.md',
    })),
    links: [], loose: [], unserved: [],
  };
  const items = menuItems({ joined: true, linked: true, signedIn: true });
  const chart = items.find((m) => m.id === 'chart')!;
  const hintOf = (source: KnowledgeGraph | 'none' | null) => {
    const text = textOf(createElement(MenuOverlay, { view, items, index: 0, me: player, onPick: () => {}, chart: source }), WIDE);
    return text[text.indexOf('STAR CHART') + 1];
  };

  it('counts the systems and the worlds beside it, with a graph', () => {
    expect(hintOf(graph)).toBe('2 SYSTEMS · 3 WORLDS');
    expect(hintOf({ ...graph, domains: graph.domains.slice(0, 1), entries: graph.entries.slice(0, 1) })).toBe('1 SYSTEM · 1 WORLD');
  });

  it('reads OUT OF REACH without a graph, and NOT IN THIS BUILD in a build that carries none', () => {
    expect(hintOf(null)).toBe('OUT OF REACH');
    expect(hintOf('none')).toBe('NOT IN THIS BUILD');
  });

  it('opens the chart only with a graph, and says why not otherwise', () => {
    expect(doorOf(chart, { view, chart: graph, problem: null })).toEqual({ scene: 'chart' });
    expect(doorOf(chart, { view: null, chart: graph, problem: null })).toEqual({ scene: 'chart' });
    expect(doorOf(chart, { view, chart: null, problem: null })).toEqual({ refused: 'THE STAR CHART IS OUT OF REACH' });
    expect(doorOf(chart, { view, chart: 'none', problem: null })).toEqual({ refused: 'NO STAR CHART IN THIS BUILD' });
  });

  it('keeps the galaxy\'s screens behind the galaxy, as before', () => {
    const map = items.find((m) => m.id === 'map')!;
    expect(doorOf(map, { view, chart: null, problem: null })).toEqual({ scene: 'map' });
    expect(doorOf(map, { view: null, chart: graph, problem: null })).toEqual({ refused: 'SIGN IN TO SEE THE GALAXY' });
    expect(doorOf(map, { view: null, chart: graph, problem: 'THE GALAXY IS OUT OF REACH.' })).toEqual({ refused: 'THE GALAXY IS OUT OF REACH.' });
    expect(doorOf(items.find((m) => m.id === 'signout')!, { view, chart: graph, problem: null })).toBeNull();
  });
});

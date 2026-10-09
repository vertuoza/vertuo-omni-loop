import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildGalaxy, demoEvents, DEMO_PROJECTS, lookOf, type GalaxyView, type XpRules } from '@omni/galaxy';
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
import { BriefingOverlay, doorOf, MenuOverlay, menuItems, type MenuItem } from './menu.tsx';
import { xpStatus, type XpStatus } from '../games/room';
import type { KnowledgeGraph } from '../../data/knowledge';
import { sure } from '../test/sure';

const now = new Date('2026-09-25T10:00:00Z');
const view = buildGalaxy(demoEvents(now), { projects: DEMO_PROJECTS, now, source: 'demo' });
const fleets: FleetRow[] = Object.entries(DEMO_PROJECTS.teams)
  .map(([name, t]) => ({ name, ...lookOf(name, t) }))
  .sort((a, b) => a.sort - b.sort);
const player: Player = {
  id: 'guest', display_name: 'MAXIMILIAN', team: sure(fleets[1], 'fleets[1]').name, team_since: null, github_login: 'max-gh',
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
  const ctx = new Proxy<Record<string | symbol, unknown>>({}, {
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
  width: number;
  height: number;
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }
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

  it.each([['the player\'s hero', sure(fleets[1], 'fleets[1]').name], ['OmniMan (a visitor has no hero)', null]] as const)(
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
  const visitor = menuItems({ joined: false, signedIn: true });
  const playing = menuItems({ joined: true, signedIn: true });

  it('holds a visitor\'s eight items and a player\'s nine, STAR CHART right after GALAXY MAP', () => {
    // A visitor here has signed in and joined no fleet yet: PLAY leads to the fleets, with no GitHub link step.
    expect(visitor[0]).toEqual({ id: 'play', label: 'PLAY', fresh: true });
    expect(visitor.map((m) => m.id)).toEqual(['play', 'map', 'chart', 'fleets', 'heroes', 'games', 'briefing', 'signout']);
    expect(playing.map((m) => m.id)).toEqual(['map', 'chart', 'fleets', 'heroes', 'games', 'briefing', 'myhero', 'change', 'signout']);
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

describe('the menu of a solo player (PRD 400)', () => {
  const solo: Player = { ...player, team: null };
  const ids = (items: MenuItem[]) => items.map((m) => m.id);

  it('shows MY HERO to anyone with a player row, and JOIN A FLEET to a solo player while fleets exist', () => {
    const items = menuItems({ joined: true, solo: true, signedIn: true, fleets: true });
    expect(ids(items)).toEqual(['map', 'chart', 'fleets', 'heroes', 'games', 'briefing', 'myhero', 'change', 'signout']);
    expect(items.find((m) => m.id === 'change')).toEqual({ id: 'change', label: 'JOIN A FLEET', fresh: true });
    expect(menuItems({ joined: true, signedIn: true, fleets: true }).find((m) => m.id === 'change')?.label).toBe('CHANGE FLEET');
  });

  it('shows neither fleet item with no fleets, and MY HERO still', () => {
    for (const solo_ of [true, false]) {
      const items = menuItems({ joined: true, solo: solo_, signedIn: true, fleets: false });
      expect(ids(items)).toContain('myhero');
      expect(ids(items)).not.toContain('change');
      expect(items.map((m) => m.label)).not.toContain('JOIN A FLEET');
    }
  });

  it('badges a solo player SOLO, never UNCREWED nor VISITOR', () => {
    const items = menuItems({ joined: true, solo: true, signedIn: true, fleets: true });
    const text = textOf(createElement(MenuOverlay, { view, items, index: 0, me: solo, onPick: () => {} }), WIDE).join(' ');
    expect(text).toContain('P1 MAXIMILIAN · SOLO');
    expect(text).not.toContain('UNCREWED');
    expect(text).not.toContain('VISITOR');
    expect(text).toContain('Pick a fleet: your future points follow you');
  });

  it('says there are no fleets yet beside FLEETS, rather than an empty lead', () => {
    const items = menuItems({ joined: true, solo: true, signedIn: true, fleets: false });
    const text = textOf(createElement(MenuOverlay, { view: { ...view, teams: [] }, items, index: 0, me: solo, onPick: () => {} }), WIDE);
    expect(text[text.indexOf('FLEETS') + 1]).toBe('No fleets yet');
    expect(text.join(' ')).not.toContain('UNCREWED');
  });
});

describe('APP MODE on the menu', () => {
  const visitor = menuItems({ joined: false, signedIn: true, app: true });
  const playing = menuItems({ joined: true, signedIn: true, app: true });
  const APP: MenuItem = { id: 'app', label: 'APP MODE' };

  it('stands just above SIGN OUT, for a visitor and for a player, with the app', () => {
    expect(visitor.map((m) => m.id)).toEqual(['play', 'map', 'chart', 'fleets', 'heroes', 'games', 'briefing', 'app', 'signout']);
    expect(playing.map((m) => m.id)).toEqual(['map', 'chart', 'fleets', 'heroes', 'games', 'briefing', 'myhero', 'change', 'app', 'signout']);
    for (const items of [visitor, playing]) expect(items.at(-2)).toEqual(APP);
  });

  it('makes a player\'s menu ten rows, its longest', () => {
    expect(playing).toHaveLength(10);
    expect(menuItems({ joined: true, signedIn: true, app: true, newGames: true })).toHaveLength(10);
  });

  it('is last, with no SIGN OUT under it, for anyone signed out', () => {
    expect(menuItems({ joined: false, signedIn: false, app: true }).map((m) => m.id))
      .toEqual(['map', 'chart', 'fleets', 'heroes', 'briefing', 'app']);
  });

  it('is not there without the app (the single-file artifact has none), and the menu is as it was', () => {
    for (const who of [{ joined: false, signedIn: true }, { joined: true, signedIn: true }, { joined: false, signedIn: false }]) {
      expect(menuItems(who).map((m) => m.id)).not.toContain('app');
      expect(menuItems({ ...who, app: false })).toEqual(menuItems(who));
      expect(menuItems({ ...who, app: true }).filter((m) => m.id !== 'app')).toEqual(menuItems(who));
    }
  });

  it('opens no scene of its own: the arcade asks OPEN THE APP? first', () => {
    expect(doorOf(APP, { view, chart: null, problem: null })).toBeNull();
    expect(doorOf(APP, { view: null, chart: null, problem: 'THE GALAXY IS OUT OF REACH.' })).toBeNull();
  });

  it.each([['a visitor', visitor, null], ['a player', playing, player]] as const)(
    'shows %s its hint, Leave the game for the app, on the wide grid and the tall one',
    (_, items, me) => {
      const menu = createElement(MenuOverlay, { view, items: [...items], index: 0, me, onPick: () => {} });
      const wide = textOf(menu, WIDE);
      expect(wide[wide.indexOf('APP MODE') + 1]).toBe('Leave the game for the app');
      expect(wide.indexOf('APP MODE')).toBeLessThan(wide.indexOf('SIGN OUT'));
      expect(textOf(menu, TALL)).toEqual(wide);
      expect(wide).toContain('B · BACK TO TITLE');
    },
  );
});

describe('GAMES on the menu', () => {
  const visitor = menuItems({ joined: false, signedIn: true });
  const playing = menuItems({ joined: true, signedIn: true });
  const withXp = xpStatus(true, { xp: 180, level: 3, unlocked: ['invaders'] });
  const shown = (items: MenuItem[], me: Player | null, xp?: XpStatus, grid: Grid = WIDE) =>
    textOf(createElement(MenuOverlay, { view, items, index: 0, me, onPick: () => {}, xp }), grid);
  const hintOf = (text: string[]) => text[text.indexOf('GAMES') + 1];

  it('stands right after HALL OF HEROES for a visitor and for a player, and opens the game room', () => {
    for (const items of [visitor, playing]) {
      const at = items.findIndex((m) => m.id === 'heroes');
      expect(items[at + 1]).toEqual({ id: 'games', label: 'GAMES', scene: 'games' });
    }
    expect(menuItems({ joined: false, signedIn: false }).map((m) => m.id)).not.toContain('games');
    const games = sure(playing.find((m) => m.id === 'games'), 'playing.find((m) => m.id === "games")');
    expect(doorOf(games, { view, chart: null, problem: null })).toEqual({ scene: 'games' });
    expect(doorOf(games, { view: null, chart: null, problem: 'THE GALAXY IS OUT OF REACH.' })).toEqual({ refused: 'THE GALAXY IS OUT OF REACH.' });
  });

  it('names a player\'s level and the games unlocked in its hint, and puts the level on their badge', () => {
    const text = shown(playing, player, withXp);
    expect(hintOf(text)).toBe('LV 3 · 1 game unlocked');
    expect(text).toContain(`P1 MAXIMILIAN · ${sure(fleets[1], 'fleets[1]').label} · LV 3`);
    expect(shown(playing, player, withXp, TALL)).toEqual(text);
  });

  it('tells a visitor linking GitHub is how XP is earned, and shows no level on their badge', () => {
    const text = shown(visitor, null, xpStatus(false, null));
    expect(hintOf(text)).toBe('Link GitHub to earn XP');
    expect(text).toContain('VISITOR');
    expect(text.some((s) => /LV \d/.test(s))).toBe(false);
  });

  it.each([
    ['no row', xpStatus(true, null), 'No XP yet'],
    ['a row stored at level 0', xpStatus(true, { xp: 0, level: 0, unlocked: [] }), 'No XP yet'],
    ['XP it could not read', xpStatus(true, 'unreadable'), 'XP out of reach'],
    ['nothing said about XP', undefined, 'XP out of reach'],
  ] as const)('shows a player with %s no level: never LV 0, never a guess', (_, xp, hint) => {
    const text = shown(playing, player, xp);
    expect(hintOf(text)).toBe(hint);
    expect(text).toContain(`P1 MAXIMILIAN · ${sure(fleets[1], 'fleets[1]').label}`);
    expect(text.some((s) => /LV \d/.test(s)), text.join(' | ')).toBe(false);
  });

  it('carries a NEW tag until the room is seen', () => {
    const fresh = menuItems({ joined: true, signedIn: true, newGames: true });
    expect(fresh.find((m) => m.id === 'games')).toEqual({ id: 'games', label: 'GAMES', scene: 'games', tag: 'NEW' });
    expect(fresh.filter((m) => m.tag).map((m) => m.id)).toEqual(['games']);
    const text = shown(fresh, player, withXp);
    expect(text[text.indexOf('GAMES') + 1]).toBe('NEW');
    expect(shown(playing, player, withXp)).not.toContain('NEW');
  });
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
    const headings = ['EARN', 'ENTROPY · CLEAR IT / IT COSTS', 'LEVELS · XP NEVER RESETS'];
    expect(tall).toHaveLength(headings.length);
    tall.forEach((page, i) => {
      for (const [j, heading] of headings.entries()) expect(page.includes(heading), `page ${i + 1}: ${heading}`).toBe(i === j);
    });
  });

  it('lays all three sections out on the wide grid\'s one page', () => {
    const wide = textOf(briefing, WIDE);
    for (const heading of ['EARN', 'ENTROPY · CLEAR IT / IT COSTS', 'LEVELS · XP NEVER RESETS']) expect(wide).toContain(heading);
  });

  it('shows a page past the last as the last (the grid changed under it)', () => {
    expect(textOf(briefing, TALL, 5, tallPages)).toEqual(textOf(briefing, TALL, tallPages - 1, tallPages));
  });

  it('shows no page count on the wide grid', () => {
    expect(textOf(briefing, WIDE).some((s) => s.startsWith('PAGE'))).toBe(false);
  });
});

describe('How to play\'s LEVELS', () => {
  const lastPage = BRIEFING_PAGES.indexOf('levels');
  /** The LEVELS page on the tall grid, as a player reads it, for a view carrying `xp` as its rules' xp block. */
  const levelsOf = (xp: XpRules = view.rules.xp): string[] => {
    const shown: GalaxyView = { ...view, rules: { ...view.rules, xp } };
    return textOf(createElement(BriefingOverlay, { view: shown }), TALL, lastPage, BRIEFING_PAGES.length);
  };
  /** The value a line shows beside its label: the next run of text. */
  const beside = (text: string[], label: string) => {
    expect(text, label).toContain(label);
    return text[text.indexOf(label) + 1];
  };
  const rules = view.rules.xp;

  it('is its own page on the tall grid, the last one', () => {
    expect(lastPage).toBe(BRIEFING_PAGES.length - 1);
    expect(levelsOf()).toContain('LEVELS · XP NEVER RESETS');
  });

  it('shows the weight of each personal credit, the curve\'s first levels and each game\'s unlock level, from the rulebook', () => {
    const text = levelsOf();
    expect(rules).toEqual({ weights: { zoneSecured: 1, woundClosed: 1, rescue: 1, expedition: 1, closer: 1, questionAnswered: 1, featureMerged: 1, featureReviewed: 1 }, curve: { first: 1, step: 25 }, cap: 99, unlocks: { invaders: 1, platformer: 2 } });
    for (const label of ['ZONE SECURED', 'ENTROPY CLEARED', 'RESCUE', 'EXPEDITION BONUS', 'CLOSER BONUS', 'QUESTION ANSWERED']) expect(beside(text, label)).toBe('×1');
    expect([1, 2, 3, 4, 5].map((n) => beside(text, `LV ${n}`))).toEqual(['1', '50', '150', '300', '500']);
    expect(text).not.toContain('LV 6');
    expect(beside(text, 'ENTROPY INVADERS')).toBe('LV 1');
    expect(beside(text, 'SUPER OMNI WORLD')).toBe('LV 2');
    expect(text.some((s) => s.includes('UP TO LV 99')), text.join(' | ')).toBe(true);
  });

  it('shows the new value when a number in the rules changes', () => {
    const text = levelsOf({
      weights: { ...rules.weights, zoneSecured: 2, rescue: 1.5, woundClosed: 0 },
      curve: { first: 5, step: 30 },
      cap: 40,
      unlocks: { invaders: 3 },
    });
    expect(beside(text, 'ZONE SECURED')).toBe('×2');
    expect(beside(text, 'RESCUE')).toBe('×1.5');
    expect(beside(text, 'ENTROPY CLEARED')).toBe('NOT COUNTED');
    expect(beside(text, 'CLOSER BONUS')).toBe('×1');
    expect([1, 2, 3, 4, 5].map((n) => beside(text, `LV ${n}`))).toEqual(['5', '60', '180', '360', '600']);
    expect(beside(text, 'ENTROPY INVADERS')).toBe('LV 3');
    expect(text.some((s) => s.includes('UP TO LV 40'))).toBe(true);
    expect(text.some((s) => s.includes('LV 99'))).toBe(false);
  });

  it('lists every game in the rules\' unlocks, lowest level first, named by the game room\'s registry', () => {
    const text = levelsOf({ ...rules, unlocks: { invaders: 4, 'star-maze': 2 } });
    expect(beside(text, 'STAR MAZE')).toBe('LV 2');
    expect(beside(text, 'ENTROPY INVADERS')).toBe('LV 4');
    expect(text.indexOf('STAR MAZE')).toBeLessThan(text.indexOf('ENTROPY INVADERS'));
    expect(levelsOf()).not.toContain('STAR MAZE');
  });

  it('shows no level past the cap, and groups the thousands of a large XP', () => {
    const low = levelsOf({ ...rules, cap: 3 });
    expect(low).toContain('LV 3');
    expect(low).not.toContain('LV 4');
    const steep = levelsOf({ ...rules, curve: { first: 1, step: 250 } });
    expect(beside(steep, 'LV 5')).toBe('5,000');
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
  const items = menuItems({ joined: true, signedIn: true });
  const chart = sure(items.find((m) => m.id === 'chart'), 'items.find((m) => m.id === "chart")');
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
    const map = sure(items.find((m) => m.id === 'map'), 'items.find((m) => m.id === "map")');
    expect(doorOf(map, { view, chart: null, problem: null })).toEqual({ scene: 'map' });
    expect(doorOf(map, { view: null, chart: graph, problem: null })).toEqual({ refused: 'SIGN IN TO SEE THE GALAXY' });
    expect(doorOf(map, { view: null, chart: graph, problem: 'THE GALAXY IS OUT OF REACH.' })).toEqual({ refused: 'THE GALAXY IS OUT OF REACH.' });
    expect(doorOf(sure(items.find((m) => m.id === 'signout'), 'items.find((m) => m.id === "signout")'), { view, chart: graph, problem: null })).toBeNull();
  });
});

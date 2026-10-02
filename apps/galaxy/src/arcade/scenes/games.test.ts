import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildGalaxy, demoEvents, DEMO_PROJECTS, lookOf, XP_RULES } from '@omni/galaxy';
import { setFleets } from '../fleets';
import { HOUSE_BRAND } from '../brand';
import { markFor } from '../mark';
import { DEFAULT_THEME } from '../theme';
import { gridFor, TALL, WIDE, type Grid } from '../grid';
import { ScreenContext } from '../Screen';
import { cabinets, xpStatus, type XpStatus } from '../games/room';
import type { FleetRow, Player, ScoreLine, ScoresRead } from '../types';
import type { FrameState } from './common.ts';
import { layoutMap } from './map.ts';
import { drawGames, TALL_SCENES } from './games.ts';
import { GamesOverlay } from './games.tsx';

const now = new Date('2026-09-25T10:00:00Z');
const view = buildGalaxy(demoEvents(now), { projects: DEMO_PROJECTS, now, source: 'demo' });
const fleets: FleetRow[] = Object.entries(DEMO_PROJECTS.teams)
  .map(([name, t]) => ({ name, ...lookOf(name, t) }))
  .sort((a, b) => a.sort - b.sort);
const player: Player = {
  id: 'guest', display_name: 'INKY', team: fleets[1]!.name, team_since: null, github_login: 'inky-gh',
  hero: { v: 1, body: 'girl', skin: 1, hair: 0, suit: 0, cape: 1 },
};
const LEVEL_3 = xpStatus(true, { xp: 180, level: 3, unlocked: ['invaders'] });
const CABINETS = cabinets(LEVEL_3).length;

/** The text a screen shows, one run of text per entry, as a player reads it on `grid`. */
function textOf(el: ReactElement, grid: Grid): string[] {
  const html = renderToStaticMarkup(createElement(ScreenContext.Provider, { value: { form: 'full', grid, page: 0, pages: 1 } }, el));
  return html
    .replace(/<!-- -->/g, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"')
    .split('\n').map((s) => s.trim()).filter(Boolean);
}

const room = (xp: XpStatus, grid: Grid, index = 0, me: Player | null = player, scores: Record<string, ScoresRead> = {}) =>
  textOf(createElement(GamesOverlay, { xp, me, index, scores, onPick: () => {} }), grid);
const line = (id: string, name: string, best: number): ScoreLine => ({ id, name, hero: null, team: null, best });
const CREW: ScoresRead = {
  top: [line('u-dime', 'DIME', 12480), line(player.id, 'INKY', 9210), line('u-bonny', 'BONNY-B', 7730), line('u-kraken', 'KRAKEN-K', 5100), line('u-agent', 'AGENT-K', 2990)],
  mine: 9210,
};
const levels = (text: string[]) => text.filter((s) => /\bLV \d/.test(s));

beforeAll(() => { setFleets(fleets); });

describe('the game room on the two grids', () => {
  it('is laid out on the tall grid too, so the Game Boy held upright draws it on 320×288', () => {
    expect([...TALL_SCENES]).toEqual(['games', 'platformer']);
    expect(gridFor('handheld', 'games')).toBe(TALL);
    for (const form of ['full', 'advance'] as const) expect(gridFor(form, 'games')).toBe(WIDE);
  });
});

describe('the game room, for a player with a level', () => {
  const wide = room(LEVEL_3, WIDE);

  it('shows the level, the XP bar\'s numbers and the XP to the next level, and the level on the badge', () => {
    expect(wide).toContain('GAME ROOM');
    expect(wide).toContain(`P1 INKY · ${fleets[1]!.label} · LV 3`);
    expect(wide).toContain('LV 3');
    expect(wide).toContain('180 / 300 XP');
    expect(wide).toContain('120 XP to LV 4');
  });

  it('stands the three cabinets side by side on the wide grid: Entropy Invaders lit, Super Omni World, then one SOON', () => {
    expect(CABINETS).toBe(3);
    expect(wide).toContain('ENTROPY INVADERS');
    expect(wide).toContain('SUPER OMNI WORLD');
    expect(wide).toContain('CREW TOP 5');
    expect(wide).toContain('NO SCORES YET');
    expect(wide).toContain('A · PLAY');
    expect(wide.filter((s) => s === 'SOON')).toHaveLength(1);
    expect(wide.filter((s) => s === 'Its own PRD sets its level')).toHaveLength(1);
    expect(wide.some((s) => s.startsWith('PAGE'))).toBe(false);
  });

  it('shows no level on a SOON cabinet: only Super Omni World\'s, locked until the stored row unlocks it', () => {
    expect(levels(wide).sort()).toEqual(['120 XP to LV 4', `P1 INKY · ${fleets[1]!.label} · LV 3`, 'LV 2', 'LV 3'].sort());
  });

  it('shows the XP and the cap without a next level at the top', () => {
    const top = XP_RULES.curve.step * XP_RULES.cap * (XP_RULES.cap - 1);
    const text = room(xpStatus(true, { xp: top + 7, level: XP_RULES.cap, unlocked: ['invaders'] }), WIDE);
    expect(text).toContain(`LV ${XP_RULES.cap}`);
    expect(text).toContain(`${top + 7} XP`);
    expect(text).toContain('MAX LEVEL');
  });

  it('shows a locked game dark with the level it unlocks at, when the stored row has not unlocked it', () => {
    const text = room(xpStatus(true, { xp: 180, level: 3, unlocked: [] }), WIDE);
    expect(text).toContain('ENTROPY INVADERS');
    expect(text).toContain('LV 1');
    expect(text).not.toContain('A · PLAY');
    expect(text).not.toContain('CREW TOP 5');
  });
});

describe('the crew\'s top five on the lit cabinet', () => {
  const markup = (grid: Grid, scores: Record<string, ScoresRead>) => renderToStaticMarkup(createElement(ScreenContext.Provider, { value: { form: 'full', grid, page: 0, pages: 1 } },
    createElement(GamesOverlay, { xp: LEVEL_3, me: player, index: 0, scores, onPick: () => {} })));

  it.each([WIDE, TALL])('shows the five best with their names and scores, best first (%o)', (grid) => {
    const text = room(LEVEL_3, grid, 0, player, { invaders: CREW });
    const rows = [['1 DIME', '12 480'], ['2 INKY', '9 210'], ['3 BONNY-B', '7 730'], ['4 KRAKEN-K', '5 100'], ['5 AGENT-K', '2 990']];
    const at = rows.map(([who, best]) => {
      const i = text.indexOf(who!);
      expect(i, who).toBeGreaterThanOrEqual(0);
      expect(text[i + 1], who).toBe(best);
      return i;
    });
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(text).toContain('CREW TOP 5');
    expect(text).not.toContain('NO SCORES YET');
    expect(text).toContain('A · PLAY');
  });

  it('highlights the player\'s own line, and no other', () => {
    const html = markup(WIDE, { invaders: CREW });
    expect(html.match(/class="mine"/g)).toHaveLength(1);
    expect(/<li class="mine">(.*?)<\/li>/.exec(html)?.[1]!.replace(/<[^>]+>/g, ' ')).toMatch(/2\s+INKY\s+9 210/);
    expect(markup(WIDE, { invaders: { top: CREW.top.filter((l) => l.id !== player.id), mine: 40 } })).not.toContain('class="mine"');
  });

  it('says the scores are out of reach when they could not be read, and still plays', () => {
    const text = room(LEVEL_3, WIDE, 0, player, { invaders: 'unreadable' });
    expect(text).toContain('SCORES OUT OF REACH');
    expect(text).not.toContain('NO SCORES YET');
    expect(text).toContain('A · PLAY');
  });

  it('says there are none yet before anyone has scored', () => {
    expect(room(LEVEL_3, WIDE, 0, player, { invaders: { top: [], mine: null } })).toContain('NO SCORES YET');
  });
});

describe('the game room without a level', () => {
  it.each([
    ['a visitor', xpStatus(false, null), null, 'LINK GITHUB TO EARN XP', 'VISITOR'],
    ['a player with no row', xpStatus(true, null), player, 'NO XP YET · SCORE YOUR FIRST POINT', `P1 INKY · ${fleets[1]!.label}`],
    ['a player whose row holds level 0', xpStatus(true, { xp: 0, level: 0, unlocked: [] }), player, 'NO XP YET · SCORE YOUR FIRST POINT', `P1 INKY · ${fleets[1]!.label}`],
    ['a player whose XP could not be read', xpStatus(true, 'unreadable'), player, 'XP OUT OF REACH', `P1 INKY · ${fleets[1]!.label}`],
  ] as const)('tells %s why, shows no level of theirs, and keeps every cabinet locked', (_, xp, me, line, badge) => {
    for (const grid of [WIDE, TALL]) {
      const text = room(xp, grid, 0, me);
      expect(text, grid.name).toContain(line);
      expect(text, grid.name).toContain(badge);
      expect(text, grid.name).not.toContain('A · PLAY');
      expect(text.some((s) => /\d XP\b/.test(s)), grid.name).toBe(false);
      // The only levels on screen are the ones the games unlock at, on their locked cabinets: the
      // tall grid shows one cabinet a page.
      expect(levels(text), grid.name).toEqual(grid === TALL ? ['LV 1'] : ['LV 1', 'LV 2']);
    }
  });
});

describe('the game room on the tall grid', () => {
  const pages = Array.from({ length: CABINETS }, (_, i) => room(LEVEL_3, TALL, i));

  it('shows one cabinet a page, says which page it is, and keeps the heading, the XP and the way back on each', () => {
    pages.forEach((page, i) => {
      expect(page).toContain('GAME ROOM');
      expect(page).toContain(`PAGE ${i + 1}/${CABINETS}`);
      expect(page).toContain('180 / 300 XP');
      expect(page).toContain('MENU');
    });
    expect(pages[0]).toContain('ENTROPY INVADERS');
    expect(pages[0]).not.toContain('SOON');
    expect(pages[1]).toContain('SUPER OMNI WORLD');
    expect(pages[1]).not.toContain('ENTROPY INVADERS');
    for (const page of pages.slice(2)) {
      expect(page).toContain('SOON');
      expect(page).not.toContain('ENTROPY INVADERS');
    }
  });

  it('shows every line the wide room shows, across its pages', () => {
    const shown = new Set(pages.flat());
    for (const line of room(LEVEL_3, WIDE).filter((s) => s !== 'CHOOSE')) expect(shown, line).toContain(line);
  });

  it('shows the last cabinet for a page past the last (the room changed under it)', () => {
    expect(room(LEVEL_3, TALL, 7)).toEqual(pages[CABINETS - 1]);
  });
});

// A 2D context that keeps where each image lands, and the offscreen canvases the sprites render into.
function recorder() {
  const images: { x: number; y: number; w: number; h: number }[] = [];
  const ctx = new Proxy({} as Record<string | symbol, unknown>, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'createImageData') return (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });
      if (prop === 'createLinearGradient') return () => ({ addColorStop() {} });
      if (prop === 'drawImage') return (img: { width: number; height: number }, x: number, y: number) => { images.push({ x, y, w: img.width, h: img.height }); };
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

describe('the game room on the canvas', () => {
  beforeAll(() => { vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas); });
  afterAll(() => { vi.unstubAllGlobals(); });

  it.each([WIDE, TALL])('lays its nebula on the %o grid, in part at least', (grid) => {
    const s: FrameState = {
      scene: 'games', grid, page: 0, view, layout: layoutMap(view, grid), sel: 0, fleetSel: 0, t: 5, sceneT: 2, reduced: false,
      mark: markFor(HOUSE_BRAND.name), theme: DEFAULT_THEME,
      join: { fleets, pick: 0, lockedAt: null, team: player.team, away: false, hero: player.hero },
    };
    const { ctx, images } = recorder();
    drawGames(ctx, s);
    expect(images.length).toBeGreaterThan(0);
    for (const i of images) {
      expect(i.x).toBeLessThan(grid.w);
      expect(i.y).toBeLessThan(grid.h);
      expect(i.x + i.w).toBeGreaterThan(0);
      expect(i.y + i.h).toBeGreaterThan(0);
    }
  });
});

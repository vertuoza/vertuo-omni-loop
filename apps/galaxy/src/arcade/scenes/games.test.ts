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
import { GamesOverlay, TURN_MS } from './games.tsx';
import { sure } from '../test/sure';

const now = new Date('2026-09-25T10:00:00Z');
const view = buildGalaxy(demoEvents(now), { projects: DEMO_PROJECTS, now, source: 'demo' });
const fleets: FleetRow[] = Object.entries(DEMO_PROJECTS.teams)
  .map(([name, t]) => ({ name, ...lookOf(name, t) }))
  .sort((a, b) => a.sort - b.sort);
const player: Player = {
  id: 'guest', display_name: 'INKY', team: sure(fleets[1], 'fleets[1]').name, team_since: null, github_login: 'inky-gh',
  hero: { v: 1, body: 'girl', skin: 1, hair: 0, suit: 0, cape: 1 },
};
const LEVEL_3 = xpStatus(true, { xp: 180, level: 3, unlocked: ['invaders'] });
const CABINETS = cabinets(LEVEL_3).length;
const GAMES_IN_ORDER = ['ENTROPY INVADERS', 'SUPER OMNI WORLD', 'OMNI KART', 'OMNI DUET', 'OMNI PONG'];

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
    expect(wide).toContain(`P1 INKY · ${sure(fleets[1], 'fleets[1]').label} · LV 3`);
    expect(wide).toContain('LV 3');
    expect(wide).toContain('180 / 300 XP');
    expect(wide).toContain('120 XP to LV 4');
  });

  it('stands three of its five cabinets side by side on the wide grid: Entropy Invaders lit, Super Omni World, then OMNI KART, and no SOON', () => {
    expect(CABINETS).toBe(5);
    expect(wide).not.toContain('OMNI DUET');
    expect(wide).not.toContain('OMNI PONG');
    expect(wide).toContain('ENTROPY INVADERS');
    expect(wide).toContain('SUPER OMNI WORLD');
    expect(wide).toContain('CREW TOP 5');
    expect(wide).toContain('NO SCORES YET');
    expect(wide).toContain('A · PLAY');
    expect(wide).toContain('OMNI KART');
    expect(wide.filter((s) => s === 'SOON')).toHaveLength(0);
    expect(wide.filter((s) => s === 'Its own PRD sets its level')).toHaveLength(0);
    expect(wide.some((s) => s.startsWith('PAGE'))).toBe(false);
  });

  it('shows a level on each locked cabinet: Super Omni World\'s LV 2 and OMNI KART\'s LV 3, locked until the stored row unlocks them', () => {
    expect(levels(wide).sort()).toEqual(['120 XP to LV 4', `P1 INKY · ${sure(fleets[1], 'fleets[1]').label} · LV 3`, 'LV 2', 'LV 3', 'LV 3'].sort());
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

describe('the wide grid\'s window of three cabinets (PRD 1633)', () => {
  const marquees = (index: number, xp: XpStatus = LEVEL_3) => {
    const html = renderToStaticMarkup(createElement(ScreenContext.Provider, { value: { form: 'full', grid: WIDE, page: 0, pages: 1 } },
      createElement(GamesOverlay, { xp, me: player, index, onPick: () => {} })));
    return [...html.matchAll(/class="(cabinet[^"]*)"[^>]*><span class="marquee">([^<]*)</g)].map((m) => ({ title: m[2], active: (m[1] ?? '').includes('active') }));
  };
  const FIRST = ['ENTROPY INVADERS', 'SUPER OMNI WORLD', 'OMNI KART'];
  const MIDDLE = ['SUPER OMNI WORLD', 'OMNI KART', 'OMNI DUET'];
  const LAST = ['OMNI KART', 'OMNI DUET', 'OMNI PONG'];

  it.each([
    [0, FIRST], [1, FIRST], [2, FIRST], [3, MIDDLE], [4, LAST],
  ] as const)('with the cursor on cabinet %i, shows %o, the one under the cursor chosen', (at, titles) => {
    const shown = marquees(at);
    expect(shown.map((c) => c.title)).toEqual(titles);
    expect(shown.filter((c) => c.active).map((c) => c.title)).toEqual([GAMES_IN_ORDER[at]]);
  });

  it('shows OMNI DUET locked with LV 4 below its level, and the rest of the room as it was', () => {
    const text = room(LEVEL_3, WIDE, 3);
    expect(text).toContain('OMNI DUET');
    expect(text).toContain('LV 4');
    expect(text).not.toContain('ENTROPY INVADERS');
    expect(text).toContain('CHOOSE');
  });

  it('shows OMNI PONG locked with LV 5 below its level, cabinets 3 to 5 in the window (PRD 2101)', () => {
    const text = room(LEVEL_3, WIDE, 4);
    expect(text).toContain('OMNI PONG');
    expect(text).toContain('LV 5');
    expect(text).toContain('OMNI KART');
    expect(text).not.toContain('SUPER OMNI WORLD');
  });

  it('turns back to the first three when the cursor comes back to the first cabinet', () => {
    expect(marquees(4).map((c) => c.title)).toEqual(LAST);
    expect(marquees(0).map((c) => c.title)).toEqual(FIRST);
  });

  it('keeps a cursor past the last cabinet on the last window', () => {
    expect(marquees(7).map((c) => c.title)).toEqual(LAST);
  });
});

describe('the screen of a lit cabinet', () => {
  const ALL_LIT = xpStatus(true, { xp: 180, level: 3, unlocked: ['invaders', 'platformer', 'kart'] });
  /** Each cabinet's markup, by its marquee. */
  const byTitle = (grid: Grid, me: Player | null = player, index = 0) => {
    const html = renderToStaticMarkup(createElement(ScreenContext.Provider, { value: { form: 'full', grid, page: 0, pages: 1 } },
      createElement(GamesOverlay, { xp: ALL_LIT, me, index, onPick: () => {} })));
    return new Map(html.split('<button').slice(1).map((c) => [sure(/class="marquee">([^<]*)</.exec(c)?.[1], 'a marquee'), c]));
  };

  it('shows each game\'s own screen: the Invaders formation, a slice of stage 1-1, a still of the race', () => {
    const cabs = byTitle(WIDE);
    expect(sure(cabs.get('ENTROPY INVADERS'), 'the Invaders cabinet')).toContain('cab-row');
    for (const title of ['SUPER OMNI WORLD', 'OMNI KART']) {
      const cab = sure(cabs.get(title), title);
      expect(cab, title).not.toContain('cab-row');
      expect(cab, title).toContain('cab-still');
    }
  });

  it('puts the player in their own game: their hero running in Super Omni World, their kart and hero on the circuit', () => {
    const cabs = byTitle(WIDE);
    expect(sure(cabs.get('SUPER OMNI WORLD'), 'the Super Omni World cabinet')).toContain('cab-runner');
    expect(sure(cabs.get('OMNI KART'), 'the OMNI KART cabinet')).toContain('cab-kart');
    const visitor = byTitle(WIDE, null);
    expect(sure(visitor.get('OMNI KART'), 'the OMNI KART cabinet')).not.toContain('cab-kart');
  });

  it.each([[WIDE, 156, 62], [TALL, 196, 46]])('draws the still the size of the screen\'s inside on its grid (%o)', (grid, w, h) => {
    const cab = sure(byTitle(grid, player, 2).get('OMNI KART'), 'the OMNI KART cabinet');
    expect(cab).toContain(`class="cab-still" width="${w}" height="${h}"`);
  });
});

describe('the crew\'s top five on the lit cabinet', () => {
  const markup = (grid: Grid, scores: Record<string, ScoresRead>) => renderToStaticMarkup(createElement(ScreenContext.Provider, { value: { form: 'full', grid, page: 0, pages: 1 } },
    createElement(GamesOverlay, { xp: LEVEL_3, me: player, index: 0, scores, onPick: () => {} })));

  it.each([WIDE, TALL])('shows the five best with their names and scores, best first (%o)', (grid) => {
    const text = room(LEVEL_3, grid, 0, player, { invaders: CREW });
    const rows = [['1 DIME', '12 480'], ['2 INKY', '9 210'], ['3 BONNY-B', '7 730'], ['4 KRAKEN-K', '5 100'], ['5 AGENT-K', '2 990']];
    const at = rows.map(([who, best]) => {
      const i = text.indexOf(sure(who, 'who'));
      expect(i, who).toBeGreaterThanOrEqual(0);
      expect(text[i + 1], who).toBe(best);
      return i;
    });
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(text).toContain('CREW TOP 5');
    expect(text).not.toContain('NO SCORES YET');
    expect(text).toContain('A · PLAY');
  });

  it('shows each best in its game\'s text: a race time on OMNI KART\'s cabinet, digits on the others', () => {
    const times: ScoresRead = { top: [line('u-a', 'ACE', 1023), line(player.id, 'INKY', 1850)], mine: 1850 };
    const kart = cabinets(xpStatus(true, { xp: 600, level: 6, unlocked: ['invaders', 'kart'] }));
    const at = kart.findIndex((c) => c.kind === 'game' && c.game.id === 'kart');
    expect(at).toBeGreaterThanOrEqual(0);
    const text = room(xpStatus(true, { xp: 600, level: 6, unlocked: ['invaders', 'kart'] }), TALL, at, player, { invaders: CREW, kart: times });
    expect(text).toContain('1:42.3');
    expect(text).toContain('3:05.0');
    expect(text).not.toContain('1 023');
    expect(room(LEVEL_3, WIDE, 0, player, { invaders: CREW })).toContain('9 210');
  });

  it('highlights the player\'s own line, and no other', () => {
    const html = markup(WIDE, { invaders: CREW });
    expect(html.match(/class="mine"/g)).toHaveLength(1);
    expect(sure(/<li class="mine">(.*?)<\/li>/.exec(html)?.[1], '/<li class="mine">(.*?)<\/li>/.exec(html)?.[1]').replace(/<[^>]+>/g, ' ')).toMatch(/2\s+INKY\s+9 210/);
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

describe('OMNI KART\'s cabinet shows its circuits in turn (PRD 1923)', () => {
  const ALL_LIT = xpStatus(true, { xp: 600, level: 6, unlocked: ['invaders', 'platformer', 'kart'] });
  const KART_AT = cabinets(ALL_LIT).findIndex((c) => c.kind === 'game' && c.game.id === 'kart');
  const comet: ScoresRead = { top: [line('u-a', 'ACE', 1023), line(player.id, 'INKY', 1850)], mine: 1850 };
  const frost: ScoresRead = { top: [line('u-b', 'BEA', 2310), line('u-c', 'CAL', 2400), line('u-d', 'DEV', 2555)], mine: null };
  /** OMNI KART's cabinet, as the room draws it on `grid` at `turn`. */
  const kartAt = (grid: Grid, turn: number, scores: Record<string, ScoresRead | undefined>, me: Player | null = player) => {
    const html = renderToStaticMarkup(createElement(ScreenContext.Provider, { value: { form: 'full', grid, page: 0, pages: 1 } },
      createElement(GamesOverlay, { xp: ALL_LIT, me, index: KART_AT, scores, turn, onPick: () => {} })));
    return sure(html.split('<button').find((c) => c.includes('>OMNI KART<')), 'the OMNI KART cabinet');
  };
  const words = (html: string) => html.replace(/<!-- -->/g, '').replace(/<[^>]+>/g, '\n').split('\n').map((s) => s.trim()).filter(Boolean);

  it('turns every five seconds', () => {
    expect(TURN_MS).toBe(5000);
  });

  it.each([WIDE, TALL])('shows COMET RING, then FROST EIGHT, then COMET RING again, each with its own board under CREW TOP 5 (%o)', (grid) => {
    const scores = { kart: comet, 'kart-frost-eight': frost };
    const first = words(kartAt(grid, 0, scores)), second = words(kartAt(grid, 1, scores));
    expect(first).toEqual(expect.arrayContaining(['CREW TOP 5', 'COMET RING', '1 ACE', '1:42.3', '2 INKY', '3:05.0']));
    expect(first).not.toContain('FROST EIGHT');
    expect(first).not.toContain('1 BEA');
    expect(second).toEqual(expect.arrayContaining(['CREW TOP 5', 'FROST EIGHT', '1 BEA', '3 DEV']));
    expect(second).not.toContain('COMET RING');
    expect(second).not.toContain('1 ACE');
    expect(words(kartAt(grid, 2, scores))).toContain('COMET RING');
    expect(words(kartAt(grid, 3, scores))).toContain('FROST EIGHT');
  });

  it('puts the circuit\'s name at the right of the heading, on the heading\'s own line', () => {
    expect(kartAt(WIDE, 1, {})).toContain('<span class="cab-head"><b>CREW TOP 5</b><i>FROST EIGHT</i></span>');
  });

  it('draws the circuit\'s own still, the size of the screen\'s inside, each turn', () => {
    const still = (turn: number) => sure(/<canvas[^>]*class="cab-still"[^>]*>/.exec(kartAt(WIDE, turn, {}))?.[0], 'the still');
    expect(still(0)).toContain('width="156" height="62"');
    expect(still(1)).toContain('width="156" height="62"');
  });

  it('keeps the player in their kart over either still', () => {
    for (const turn of [0, 1]) expect(kartAt(WIDE, turn, {})).toContain('cab-kart');
  });

  it('shows each turn its own NO SCORES YET or SCORES OUT OF REACH', () => {
    const only = { kart: comet, 'kart-frost-eight': { top: [], mine: null } };
    expect(words(kartAt(WIDE, 0, only))).not.toContain('NO SCORES YET');
    expect(words(kartAt(WIDE, 1, only))).toContain('NO SCORES YET');
    const out = { kart: comet, 'kart-frost-eight': 'unreadable' as const };
    expect(words(kartAt(WIDE, 0, out))).not.toContain('SCORES OUT OF REACH');
    expect(words(kartAt(WIDE, 1, out))).toContain('SCORES OUT OF REACH');
    const other = { kart: 'unreadable' as const, 'kart-frost-eight': frost };
    expect(words(kartAt(WIDE, 0, other))).toContain('SCORES OUT OF REACH');
    expect(words(kartAt(WIDE, 1, other))).not.toContain('SCORES OUT OF REACH');
  });

  it('highlights the player\'s own line on the turn it is on, and plays whatever the turn', () => {
    const scores = { kart: comet, 'kart-frost-eight': { top: [...frost.top, line(player.id, 'INKY', 2900)], mine: 2900 } };
    for (const turn of [0, 1]) {
      const cab = kartAt(WIDE, turn, scores);
      expect(cab.match(/class="mine"/g)).toHaveLength(1);
      expect(words(cab)).toContain('A · PLAY');
    }
  });

  it('turns only the game with circuits: the other cabinets show one board and no name beside the heading', () => {
    const html = renderToStaticMarkup(createElement(ScreenContext.Provider, { value: { form: 'full', grid: WIDE, page: 0, pages: 1 } },
      createElement(GamesOverlay, { xp: ALL_LIT, me: player, index: 0, scores: { invaders: CREW }, turn: 1, onPick: () => {} })));
    expect(html.match(/cab-head/g)).toHaveLength(1);
    expect(words(html)).toContain('1 DIME');
  });
});

describe('the game room without a level', () => {
  it.each([
    ['a visitor', xpStatus(false, null), null, 'LINK GITHUB TO EARN XP', 'VISITOR'],
    ['a player with no row', xpStatus(true, null), player, 'NO XP YET · SCORE YOUR FIRST POINT', `P1 INKY · ${sure(fleets[1], 'fleets[1]').label}`],
    ['a player whose row holds level 0', xpStatus(true, { xp: 0, level: 0, unlocked: [] }), player, 'NO XP YET · SCORE YOUR FIRST POINT', `P1 INKY · ${sure(fleets[1], 'fleets[1]').label}`],
    ['a player whose XP could not be read', xpStatus(true, 'unreadable'), player, 'XP OUT OF REACH', `P1 INKY · ${sure(fleets[1], 'fleets[1]').label}`],
  ] as const)('tells %s why, shows no level of theirs, and keeps every cabinet locked', (_, xp, me, line, badge) => {
    for (const grid of [WIDE, TALL]) {
      const text = room(xp, grid, 0, me);
      expect(text, grid.name).toContain(line);
      expect(text, grid.name).toContain(badge);
      expect(text, grid.name).not.toContain('A · PLAY');
      expect(text.some((s) => /\d XP\b/.test(s)), grid.name).toBe(false);
      // The only levels on screen are the ones the games unlock at, on their locked cabinets: the
      // tall grid shows one cabinet a page.
      expect(levels(text), grid.name).toEqual(grid === TALL ? ['LV 1'] : ['LV 1', 'LV 2', 'LV 3']);
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
    expect(pages[2]).toContain('OMNI KART');
    expect(pages[2]).not.toContain('SOON');
    expect(pages[2]).not.toContain('ENTROPY INVADERS');
    expect(pages[3]).toContain('OMNI DUET');
    expect(pages[3]).toContain('LV 4');
    expect(pages[3]).not.toContain('OMNI KART');
    expect(pages[4]).toContain('OMNI PONG');
    expect(pages[4]).toContain('LV 5');
    expect(pages[4]).not.toContain('OMNI DUET');
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
  const ctx = new Proxy<Record<string | symbol, unknown>>({}, {
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

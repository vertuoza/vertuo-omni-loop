import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildGalaxy, demoEvents, DEMO_PROJECTS, lookOf, type WoundKind } from '@omni/galaxy';
import { heroLook, woundTint } from '@omni/design';
import { setFleets } from '../fleets';
import { HOUSE_BRAND } from '../brand';
import { markFor } from '../mark';
import { DEFAULT_THEME } from '../theme';
import { gridFor, TALL, WIDE, type Grid } from '../grid';
import { ScreenContext } from '../Screen';
import { alienAt, FIELDS, hudOf, newGame, press, type Game, type GameHud } from '../games/invaders';
import type { FleetRow, ScoreLine } from '../types';
import { failed, saved, SEND_TRIES, sending, type ScoreSend } from './invaders-score';
import type { FrameState } from './common.ts';
import { layoutMap } from './map.ts';

// Every sprite the scene draws, by name, with its tint and where it lands.
const drawn = vi.hoisted(() => [] as { name: string; x: number; y: number; tint: unknown }[]);
vi.mock('@omni/design', async (original) => {
  const real = await original<typeof import('@omni/design')>();
  return {
    ...real,
    drawSprite: (_ctx: unknown, name: string, x: number, y: number, o: { tint?: unknown } = {}) => { drawn.push({ name, x, y, tint: o.tint ?? null }); },
  };
});

const { drawInvaders, TALL_SCENES } = await import('./invaders.ts');
const { InvadersOverlay } = await import('./invaders.tsx');

const now = new Date('2026-09-25T10:00:00Z');
const view = buildGalaxy(demoEvents(now), { projects: DEMO_PROJECTS, now, source: 'demo' });
const fleets: FleetRow[] = Object.entries(DEMO_PROJECTS.teams)
  .map(([name, t]) => ({ name, ...lookOf(name, t) }))
  .sort((a, b) => a.sort - b.sort);
const hero = { v: 1 as const, body: 'boy' as const, skin: 2, hair: 1, suit: 0, cape: 2 };
const team = fleets[2]!.name;
// Close values of our own: the scene shows and pays what it is given, never a number of its own.
const VALUES: Record<WoundKind, number> = { ...view.rules.woundClose, beacon: 41, transmission: 3 };

function frame(game: Game, grid: Grid): FrameState {
  return {
    scene: 'invaders', grid, page: 0, view, layout: layoutMap(view, grid), sel: 0, fleetSel: 0, t: 5, sceneT: 2, reduced: false,
    mark: markFor(HOUSE_BRAND.name), theme: DEFAULT_THEME, game,
    join: { fleets, pick: 0, lockedAt: null, team, away: false, hero },
  };
}

function textOf(el: ReactElement, grid: Grid): string[] {
  const html = renderToStaticMarkup(createElement(ScreenContext.Provider, { value: { form: 'full', grid, page: 0, pages: 1 } }, el));
  return html
    .replace(/<!-- -->/g, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"')
    .split('\n').map((s) => s.trim()).filter(Boolean);
}

const screen = (hud: GameHud, grid: Grid, more: { hi?: ScoreLine | null; send?: ScoreSend | null } = {}) =>
  textOf(createElement(InvadersOverlay, { hud, values: VALUES, hero, team, ...more }), grid);
const DIME: ScoreLine = { id: 'u-dime', name: 'DIME', hero: null, team: null, best: 12480 };

// A 2D context that swallows every call.
function sink() {
  return new Proxy({} as Record<string | symbol, unknown>, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'createLinearGradient') return () => ({ addColorStop() {} });
      if (prop === 'createImageData') return (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });
      return () => {};
    },
    set(target, prop, value) { target[prop] = value; return true; },
  }) as unknown as CanvasRenderingContext2D;
}

class FakeOffscreenCanvas {
  width: number;
  height: number;
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }
  getContext() { return sink(); }
}

beforeAll(() => { setFleets(fleets); vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas); });
afterAll(() => { vi.unstubAllGlobals(); });
beforeEach(() => { drawn.length = 0; });

describe('Entropy Invaders on the two grids', () => {
  it('is laid out on the tall grid too, so the Game Boy held upright draws it on 320×288', () => {
    expect([...TALL_SCENES]).toEqual(['invaders']);
    expect(gridFor('handheld', 'invaders')).toBe(TALL);
    for (const form of ['full', 'advance'] as const) expect(gridFor(form, 'invaders')).toBe(WIDE);
  });

  it.each([['wide', WIDE, 50], ['tall', TALL, 30]] as const)('draws the %s field: the formation, every alien inside the grid', (layout, grid, count) => {
    const game = newGame({ layout, values: VALUES, seed: 3 });
    drawInvaders(sink(), frame(game, grid));
    const aliens = drawn.filter((d) => d.name === 'entropy');
    expect(aliens).toHaveLength(count);
    for (const a of aliens) {
      expect(a.x).toBeGreaterThanOrEqual(0);
      expect(a.x + 24).toBeLessThanOrEqual(grid.w);
      expect(a.y + 24).toBeLessThanOrEqual(grid.h);
    }
    expect(FIELDS[layout]).toMatchObject({ w: grid.w, h: grid.h });
  });
});

describe('who fights whom', () => {
  it('flies the player\'s own hero, in their fleet\'s colours', () => {
    const game = newGame({ layout: 'wide', values: VALUES, seed: 3 });
    drawInvaders(sink(), frame(game, WIDE));
    const look = heroLook(hero, fleets[2]!.color);
    const heroes = drawn.filter((d) => d.name.startsWith('hero-'));
    expect(heroes).toHaveLength(1);
    expect(heroes[0]).toMatchObject({ name: look.sprite, tint: look.tint, x: game.heroX, y: FIELDS.wide.hero.y });
    expect(drawn.some((d) => d.name === 'ship' || d.name === 'omni')).toBe(false);
  });

  it('sends the alien Entropy, one wound kind per row, the one that pays most on top', () => {
    const game = newGame({ layout: 'wide', values: VALUES, seed: 3 });
    drawInvaders(sink(), frame(game, WIDE));
    for (let row = 0; row < game.rows; row++) {
      const y = alienAt(game, row, 0).y;
      const tints = drawn.filter((d) => d.name === 'entropy' && d.y === y).map((d) => JSON.stringify(d.tint));
      expect(tints, `row ${row}`).toHaveLength(game.cols);
      expect(new Set(tints), `row ${row}`).toEqual(new Set([JSON.stringify(woundTint(game.kinds[row]!))]));
    }
    expect(game.kinds[0]).toBe('beacon');
    expect(game.kinds.at(-1)).toBe('transmission');
  });

  it('draws only the aliens still there', () => {
    const game = newGame({ layout: 'tall', values: VALUES, seed: 3 });
    drawInvaders(sink(), frame({ ...game, alive: game.alive.map((_, i) => i % 2 === 0) }, TALL));
    expect(drawn.filter((d) => d.name === 'entropy')).toHaveLength(15);
  });
});

describe('the text layer', () => {
  const ready = hudOf(newGame({ layout: 'wide', values: VALUES, seed: 3 }));
  const playing = hudOf(press(newGame({ layout: 'wide', values: VALUES, seed: 3 }), 'a').game);

  it.each([WIDE, TALL])('shows the score table on the ready screen, with the close values it is given (%o)', (grid) => {
    const text = screen({ ...ready, layout: grid.name }, grid);
    expect(text).toContain('ENTROPY INVADERS');
    expect(text).toContain('SCORE ADVANCE TABLE');
    const rows = [['= 41 PTS', 'BEACON'], [`= ${VALUES['fault-line']} PTS`, 'FAULT LINE'], [`= ${VALUES['unconfirmed-ground']} PTS`, 'UNCONFIRMED GROUND'],
      [`= ${VALUES['under-fire']} PTS`, 'ZONE UNDER FIRE'], ['= 3 PTS', 'TRANSMISSION']];
    const at = rows.map(([pts, name]) => {
      const i = text.indexOf(pts!);
      expect(text[i + 1], pts).toBe(name);
      return i;
    });
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(text.join(' ')).toContain('HOLD ◀ ▶ TO FLY · HOLD A TO FIRE');
  });

  it('shows the score, the wave and the lives while playing, and how to pause', () => {
    const text = screen({ ...playing, score: 1240, wave: 2, lives: 2 }, WIDE);
    expect(text).toContain('SCORE');
    expect(text).toContain('01 240');
    expect(text).toContain('WAVE');
    expect(text).toContain('2');
    expect(text).toContain('PAUSE');
    expect(text).not.toContain('SCORE ADVANCE TABLE');
  });

  it('shows the score up to its cap', () => {
    expect(screen({ ...playing, score: 9_999_999 }, WIDE)).toContain('9 999 999');
  });

  it('pauses with the way back to the game room', () => {
    const text = screen({ ...playing, phase: 'paused' }, TALL);
    expect(text).toContain('PAUSED');
    expect(text).toContain('RESUME');
    expect(text).toContain('GAME ROOM');
  });

  it('ends on the score', () => {
    const text = screen({ ...playing, phase: 'over', score: 385, wave: 3, lives: 0 }, WIDE);
    expect(text).toContain('GAME OVER');
    expect(text).toContain('00 385');
    expect(text).toContain('GAME ROOM');
  });
});

describe('the crew\'s best on the score line', () => {
  const play = (layout: 'wide' | 'tall') => ({ ...hudOf(press(newGame({ layout, values: VALUES, seed: 3 }), 'a').game), score: 1240 });

  it('shows HI with the name and score of the crew\'s best on the wide grid', () => {
    const text = screen(play('wide'), WIDE, { hi: DIME });
    const i = text.indexOf('HI · DIME');
    expect(i).toBeGreaterThanOrEqual(0);
    expect(text[i + 1]).toBe('12 480');
    expect(text).toContain('01 240');
  });

  it('shows HI and its score without the name on the tall grid, where the wave and the way to pause keep their place', () => {
    const text = screen(play('tall'), TALL, { hi: DIME });
    expect(text[text.indexOf('HI') + 1]).toBe('12 480');
    expect(text.join(' ')).not.toContain('DIME');
    expect(text).toContain('WAVE');
    expect(text).toContain('PAUSE');
  });

  it('shows no HI before anyone has a score', () => {
    const text = screen(hudOf(newGame({ layout: 'wide', values: VALUES, seed: 3 })), WIDE, { hi: null });
    expect(text.some((s) => s.startsWith('HI'))).toBe(false);
  });
});

describe('the game over, sending its score', () => {
  const over: GameHud = { layout: 'wide', phase: 'over', score: 385, lives: 0, wave: 3 };
  const lost = failed(sending(385));

  it('says the score is being saved, and A goes back to the room', () => {
    const text = screen(over, WIDE, { send: sending(385) });
    expect(text).toContain('SAVING SCORE…');
    expect(text).not.toContain('RETRY');
    expect(text).toContain('GAME ROOM');
  });

  it.each([WIDE, TALL])('shows NEW BEST when the score is one (%o)', (grid) => {
    const text = screen({ ...over, layout: grid.name }, grid, { send: saved(sending(385), 385, 200) });
    expect(text).toContain('NEW BEST');
    expect(text).toContain('00 385');
  });

  it('shows the player\'s best instead when the score is not one', () => {
    const text = screen(over, WIDE, { send: saved(sending(385), 12480, 12480) });
    expect(text).not.toContain('NEW BEST');
    expect(text).toContain('YOUR BEST 12 480');
  });

  it.each([WIDE, TALL])('says SCORE NOT SAVED when sending failed: A retries, B goes back to the room (%o)', (grid) => {
    const text = screen({ ...over, layout: grid.name }, grid, { send: lost });
    expect(text).toContain('SCORE NOT SAVED');
    const a = text.indexOf('A'), b = text.indexOf('B');
    expect(text[a + 1]).toBe('RETRY');
    expect(text[b + 1]).toBe('GAME ROOM');
  });

  it('after its one retry fails too, keeps SCORE NOT SAVED and A goes back to the room', () => {
    const text = screen(over, WIDE, { send: failed(sending(385, SEND_TRIES)) });
    expect(text).toContain('SCORE NOT SAVED');
    expect(text).not.toContain('RETRY');
    expect(text[text.indexOf('A') + 1]).toBe('GAME ROOM');
  });
});

import { readFileSync } from 'node:fs';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildGalaxy, demoEvents, DEMO_PROJECTS, lookOf } from '@omni/galaxy';
import { heroLook } from '@omni/design';
import { setFleets } from '../fleets';
import { HOUSE_BRAND } from '../brand';
import { markFor } from '../mark';
import { DEFAULT_THEME } from '../theme';
import { gridFor, TALL, WIDE, type Grid } from '../grid';
import { ScreenContext } from '../Screen';
import { xpStatus } from '../games/room';
import { levelUpFor, type LevelUp } from '../levelup';
import type { FleetRow } from '../types';
import type { FrameState } from './common.ts';
import { layoutMap } from './map.ts';

// Every sprite the scene draws, by name, with its tint, its scale and where it lands.
const drawn = vi.hoisted(() => [] as { name: string; x: number; y: number; tint: unknown; scale: number }[]);
vi.mock('@omni/design', async (original) => {
  const real = await original<typeof import('@omni/design')>();
  return {
    ...real,
    drawSprite: (_ctx: unknown, name: string, x: number, y: number, o: { tint?: unknown; scale?: number } = {}) => {
      drawn.push({ name, x, y, tint: o.tint ?? null, scale: o.scale ?? 1 });
    },
  };
});

const { drawLevelUp, TALL_SCENES } = await import('./levelup.ts');
const { LevelUpOverlay } = await import('./levelup.tsx');

const now = new Date('2026-09-25T10:00:00Z');
const view = buildGalaxy(demoEvents(now), { projects: DEMO_PROJECTS, now, source: 'demo' });
const fleets: FleetRow[] = Object.entries(DEMO_PROJECTS.teams)
  .map(([name, t]) => ({ name, ...lookOf(name, t) }))
  .sort((a, b) => a.sort - b.sort);
const hero = { v: 1 as const, body: 'girl' as const, skin: 3, hair: 2, suit: 1, cape: 0 };
const team = fleets[1]!.name;

/** The first point: LV 1, and Entropy Invaders opened. */
const FIRST: LevelUp = levelUpFor(xpStatus(true, { xp: 1, level: 1, unlocked: ['invaders'] }), null)!;
/** LV 2, which opens no game. */
const SECOND: LevelUp = levelUpFor(xpStatus(true, { xp: 60, level: 2, unlocked: ['invaders'] }), 1)!;

function frame(grid: Grid, o: { t?: number; sceneT?: number; reduced?: boolean } = {}): FrameState {
  return {
    scene: 'levelup', grid, page: 0, view, layout: layoutMap(view, grid), sel: 0, fleetSel: 0,
    t: o.t ?? 5, sceneT: o.sceneT ?? 2, reduced: o.reduced ?? false, mark: markFor(HOUSE_BRAND.name), theme: DEFAULT_THEME,
    join: { fleets, pick: 0, lockedAt: null, team, away: false, hero },
  };
}

/** A 2D context that writes down every call and every setting, with its arguments, in order. */
function recorder() {
  const calls: string[] = [];
  const ctx = new Proxy({} as Record<string | symbol, unknown>, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
        return (...a: unknown[]) => { calls.push(`${String(prop)}(${a.join()})`); return { addColorStop: (...b: unknown[]) => calls.push(`stop(${b.join()})`) }; };
      }
      if (prop === 'createImageData') return (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });
      return (...a: unknown[]) => { calls.push(`${String(prop)}(${a.map((v) => (typeof v === 'number' ? v.toFixed(3) : typeof v === 'object' ? 'img' : v)).join()})`); };
    },
    set(target, prop, value) { calls.push(`${String(prop)}=${value}`); target[prop] = value; return true; },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

/** Everything a frame draws, sprites included. */
function draw(f: FrameState): string[] {
  drawn.length = 0;
  const { ctx, calls } = recorder();
  drawLevelUp(ctx, f);
  return [...calls, ...drawn.map((d) => `sprite ${d.name} ${d.x},${d.y} ×${d.scale}`)];
}

/** Draws that cover the whole screen: only a flash does. */
const flashes = (calls: string[], grid: Grid) => calls.filter((c) => c === `fillRect(0.000,0.000,640.000,360.000)` || c === `fillRect(0.000,0.000,${grid.w}.000,${grid.h}.000)`);

function textOf(el: ReactElement, grid: Grid): string[] {
  const html = renderToStaticMarkup(createElement(ScreenContext.Provider, { value: { form: 'full', grid, page: 0, pages: 1 } }, el));
  return html
    .replace(/<!-- -->/g, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"')
    .split('\n').map((s) => s.trim()).filter(Boolean);
}
const screen = (levelUp: LevelUp, grid: Grid) => textOf(createElement(LevelUpOverlay, { levelUp }), grid);

class FakeOffscreenCanvas {
  width: number;
  height: number;
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }
  getContext() { return recorder().ctx; }
}

beforeAll(() => { setFleets(fleets); vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas); });
afterAll(() => { vi.unstubAllGlobals(); });
beforeEach(() => { drawn.length = 0; });

describe('the level-up on the two grids', () => {
  it('is laid out on the tall grid too, so the Game Boy held upright draws it on 320×288', () => {
    expect([...TALL_SCENES]).toEqual(['levelup']);
    expect(gridFor('handheld', 'levelup')).toBe(TALL);
    for (const form of ['full', 'advance'] as const) expect(gridFor(form, 'levelup')).toBe(WIDE);
  });

  it.each([['wide', WIDE], ['tall', TALL]] as const)('draws the player\'s own hero at 2×, in their fleet\'s colours, inside the %s grid', (_, grid) => {
    draw(frame(grid));
    const look = heroLook(hero, fleets[1]!.color);
    const heroes = drawn.filter((d) => d.name.startsWith('hero-'));
    expect(heroes).toHaveLength(1);
    expect(heroes[0]).toMatchObject({ name: look.sprite, tint: look.tint, scale: 2 });
    expect(heroes[0]!.x).toBeGreaterThanOrEqual(0);
    expect(heroes[0]!.x + 64).toBeLessThanOrEqual(grid.w);
    expect(heroes[0]!.y + 96).toBeLessThanOrEqual(grid.h);
  });
});

describe('its rays and flashes', () => {
  it.each([['wide', WIDE], ['tall', TALL]] as const)('turn, breathe and flash on the %s grid', (_, grid) => {
    expect(draw(frame(grid, { t: 1, sceneT: 1 }))).not.toEqual(draw(frame(grid, { t: 4, sceneT: 4 })));
    expect(flashes(draw(frame(grid, { sceneT: 0.05 })), grid)).toHaveLength(1);
    expect(flashes(draw(frame(grid, { sceneT: 2 })), grid)).toHaveLength(0);
  });

  it.each([['wide', WIDE], ['tall', TALL]] as const)('are still with reduced motion on the %s grid: every frame the same, and no flash', (_, grid) => {
    const first = draw(frame(grid, { t: 0.5, sceneT: 0.05, reduced: true }));
    expect(first.length).toBeGreaterThan(0);
    for (const at of [{ t: 1.2, sceneT: 0.4 }, { t: 3, sceneT: 2.5 }, { t: 17.3, sceneT: 9.9 }]) {
      expect(draw(frame(grid, { ...at, reduced: true })), JSON.stringify(at)).toEqual(first);
    }
    expect(flashes(first, grid)).toHaveLength(0);
  });

  it('holds the text layer\'s every animation still with reduced motion', () => {
    const css = readFileSync(new URL('./levelup.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const at = css.indexOf('@media (prefers-reduced-motion: reduce)');
    expect(at).toBeGreaterThan(0);
    const open = css.indexOf('{', at);
    let depth = 0, end = open;
    for (; end < css.length; end++) {
      if (css[end] === '{') depth++;
      if (css[end] === '}' && --depth === 0) break;
    }
    const reduced = css.slice(open + 1, end), rest = css.slice(0, at) + css.slice(end + 1);
    const still = new Set<string>();
    for (const [, sel, body] of reduced.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      if (/animation:\s*none/.test(body!)) for (const s of sel!.split(',')) still.add(s.trim());
    }
    const animated = [...rest.matchAll(/([^{}@]+)\{([^}]*)\}/g)]
      .filter(([, , body]) => /(^|;|\s)animation\s*:/.test(body!))
      .flatMap(([, sel]) => sel!.split(',').map((s) => s.trim()));
    expect(animated.length).toBeGreaterThan(0);
    expect(animated.filter((s) => !still.has(s)), 'animated with reduced motion').toEqual([]);
  });
});

describe('what it says', () => {
  it.each([['wide', WIDE], ['tall', TALL]] as const)('celebrates the first point and the game it opened on the %s grid', (_, grid) => {
    const text = screen(FIRST, grid);
    expect(text).toEqual(expect.arrayContaining(['FIRST POINT EARNED', 'LEVEL UP!', 'LV 1', '1 / 50 XP · NEXT LV 2', 'NEW GAME UNLOCKED', 'ENTROPY INVADERS']));
    expect(text).toEqual(expect.arrayContaining(['A', 'PLAY NOW', 'B', 'LATER']));
  });

  it.each([['wide', WIDE], ['tall', TALL]] as const)('shows no NEW GAME UNLOCKED when the level opened none, on the %s grid', (_, grid) => {
    const text = screen(SECOND, grid);
    expect(text).toEqual(expect.arrayContaining(['60 XP EARNED', 'LEVEL UP!', 'LV 2', '60 / 150 XP · NEXT LV 3', 'A', 'CONTINUE']));
    expect(text).not.toContain('NEW GAME UNLOCKED');
    expect(text).not.toContain('ENTROPY INVADERS');
    expect(text).not.toContain('PLAY NOW');
  });

  it('fills the XP bar from the new level\'s floor', () => {
    const html = (l: LevelUp) => renderToStaticMarkup(createElement(ScreenContext.Provider, { value: { form: 'full', grid: WIDE, page: 0, pages: 1 } }, createElement(LevelUpOverlay, { levelUp: l })));
    expect(html(SECOND)).toMatch(/width:10%/); // (60 − 50) / (150 − 50)
    expect(html(FIRST)).toMatch(/width:0%/);
  });
});

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEMO_PROJECTS, lookOf } from '@omni/galaxy';
import { spriteSize } from '@omni/sprites';
import { gridFor } from '../grid';
import { setFleets } from '../fleets';
import { HOUSE_BRAND } from '../brand';
import { markFor, type Mark } from '../mark';
import { ScreenContext } from '../Screen';
import type { FleetRow } from '../types';
import { TALL, WIDE, type FrameState, type Grid, type SceneName } from './common.ts';
import { drawFrame } from './index.ts';
import { TALL_SCENES } from './join.ts';
import { CoinOverlay, GateOverlay, IntroOverlay, LinkOverlay, OutsiderOverlay, ReadyOverlay, WelcomeOverlay } from './join.tsx';

// Every sprite drawn, where and how large: the join scenes' actors on the canvas.
const sprites = vi.hoisted(() => [] as { name: string; x: number; y: number; scale: number }[]);
vi.mock('@omni/sprites', async (original) => {
  const m = await original<typeof import('@omni/sprites')>();
  return {
    ...m,
    drawSprite: (_ctx: unknown, name: string, x: number, y: number, o: { scale?: number } = {}) => {
      sprites.push({ name, x: Math.round(x), y: Math.round(y), scale: o.scale ?? 1 });
    },
  };
});

// A 2D context that keeps the rectangles filled in a colour, and the offscreen canvases the nebulae render into.
function recorder() {
  const rects: { x: number; y: number; w: number; h: number; color: unknown }[] = [];
  const state: Record<string | symbol, unknown> = {};
  const ctx = new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'createImageData') return (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });
      if (prop === 'createLinearGradient') return () => ({ addColorStop() {} });
      if (prop === 'fillRect') return (x: number, y: number, w: number, h: number) => { rects.push({ x, y, w, h, color: target.fillStyle }); };
      return () => {};
    },
    set(target, prop, value) { target[prop] = value; return true; },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, rects };
}

class FakeOffscreenCanvas {
  constructor(public width: number, public height: number) {}
  getContext() { return recorder().ctx; }
}

const fleets: FleetRow[] = Object.entries(DEMO_PROJECTS.teams)
  .map(([name, t]) => ({ name, ...lookOf(name, t) }))
  .sort((a, b) => a.sort - b.sort);
const JOIN: SceneName[] = ['coin', 'away', 'outsider', 'gate', 'intro', 'link', 'ready', 'welcome'];

function frame(scene: SceneName, sceneT: number, grid: Grid, away = false, mark: Mark = markFor(HOUSE_BRAND.name)): FrameState {
  return {
    scene, grid, page: 0, view: null, layout: [], sel: 0, fleetSel: 0, t: 5, sceneT, reduced: false, mark,
    join: { fleets, pick: 0, lockedAt: null, team: fleets[1].name, away, hero: { v: 1, body: 'girl', skin: 1, hair: 0, suit: 0, cape: 1 } },
  };
}

/** The sprites a frame draws, each as the box it covers on the grid. */
function spritesOf(s: FrameState) {
  sprites.length = 0;
  const { ctx, rects } = recorder();
  drawFrame(ctx, s, 'title');
  const boxes = sprites.map(({ name, x, y, scale }) => {
    const { w, h } = spriteSize(name);
    return { name, x, y, w: w * scale, h: h * scale };
  });
  return { boxes, rects };
}

describe('the join group on the tall grid', () => {
  it('lists every join scene as tall, so the Game Boy held upright draws them on 320×288', () => {
    expect([...TALL_SCENES].sort()).toEqual([...JOIN].sort());
    for (const scene of JOIN) {
      expect(gridFor('handheld', scene), scene).toBe(TALL);
      expect(gridFor('advance', scene), scene).toBe(WIDE);
      expect(gridFor('full', scene), scene).toBe(WIDE);
    }
  });
});

describe('the join scenes drawn on the tall grid', () => {
  beforeAll(() => { vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas); setFleets(fleets); });
  afterAll(() => { vi.unstubAllGlobals(); });
  beforeEach(() => { sprites.length = 0; });

  // Each scene once its entrance has played: the coin, the gate and the link at rest, the intro with
  // every fleet in, the ready hero risen, the welcome on its pedestal.
  const settled: [string, FrameState][] = [
    ['coin', frame('coin', 0.5, TALL)],
    ['outsider', frame('outsider', 0.5, TALL)],
    ['gate', frame('gate', 0.5, TALL)],
    ['intro, OMNI-MAN risen', frame('intro', 9, TALL)],
    ['intro, every fleet in', frame('intro', 16.3, TALL)],
    ['link', frame('link', 0.5, TALL)],
    ['ready', frame('ready', 2, TALL)],
    ['welcome', frame('welcome', 2, TALL)],
  ];

  it.each(settled)('keeps every sprite of %s inside the screen', (_, s) => {
    const { boxes } = spritesOf(s);
    expect(boxes.length).toBeGreaterThan(0);
    for (const b of boxes) {
      expect(b.x, `${b.name} left`).toBeGreaterThanOrEqual(0);
      expect(b.y, `${b.name} top`).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w, `${b.name} right`).toBeLessThanOrEqual(TALL.w);
      expect(b.y + b.h, `${b.name} bottom`).toBeLessThanOrEqual(TALL.h);
    }
  });

  it('lines the intro\'s fleets up apart from one another, every one of them shown', () => {
    const { boxes } = spritesOf(frame('intro', 16.3, TALL));
    const mascots = boxes.filter((b) => b.name !== 'omni');
    expect(mascots).toHaveLength(Math.min(5, fleets.length));
    for (let i = 1; i < mascots.length; i++) expect(mascots[i].x, `fleet ${i}`).toBeGreaterThanOrEqual(mascots[i - 1].x + mascots[i - 1].w);
  });

  it('opens the intro with the brand\'s letter, as the boot drew it', () => {
    // At 1.8 s the intro's mark is whole, before its flash: the pixel lines filled in a gradient.
    const drawn = (mark: Mark) => spritesOf(frame('intro', 1.8, WIDE, false, mark)).rects
      .filter((r) => typeof r.color !== 'string' && r.w > 0)
      .map((r) => [(r.x - 284) / 2, (r.y - 96) / 2, r.w / 2]);
    for (const name of ['Vertuoza', 'Acme']) {
      const { runs } = markFor(name);
      const lines = runs.map(([x, y, w]) => [x, y, w]);
      expect(drawn(markFor(name)), name).toEqual([...lines.map(([x, y, w]) => [x, y + 1, w]), ...lines]); // the shade, then the gradient
    }
  });

  it('centres the loading bar of a trip away from the arcade on the screen', () => {
    for (const s of [frame('away', 0.3, TALL), frame('coin', 0.3, TALL, true), frame('link', 0.3, TALL, true)]) {
      const bar = spritesOf(s).rects.filter((r) => r.w === 8 && r.h === 8 && (r.color === '#6ff0ff' || r.color === '#1a1f55'));
      expect(bar, s.scene).toHaveLength(12);
      const left = Math.min(...bar.map((r) => r.x)), right = Math.max(...bar.map((r) => r.x + r.w));
      expect(left + right, s.scene).toBe(TALL.w);
      for (const r of bar) expect(r.y + r.h, s.scene).toBeLessThanOrEqual(TALL.h);
    }
  });
});

describe('the join group\'s text layer', () => {
  beforeAll(() => { setFleets(fleets); });

  const words = (el: ReactElement, grid: Grid) => renderToStaticMarkup(
    createElement(ScreenContext.Provider, { value: { form: grid === TALL ? 'handheld' : 'full', grid, page: 0, pages: 1 } }, el),
  );
  const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

  // Every state of every join scene, the coin's and the link's included.
  const states: [string, ReactElement, string[]][] = [
    ['coin', createElement(CoinOverlay, { away: false, error: null, demo: true, closed: false }), ['INSERT COIN', 'SIGN IN WITH YOUR VERTUOZA ACCOUNT', '@vertuoza.com accounts only', 'SIGN IN WITH GOOGLE', 'BACK']],
    ['coin, with the error line', createElement(CoinOverlay, { away: false, error: 'Sign-in failed.', demo: true, closed: false }), ['INSERT COIN', 'Sign-in failed.', 'SIGN IN WITH GOOGLE']],
    ['coin, closed', createElement(CoinOverlay, { away: false, error: null, demo: false, closed: true }), ['INSERT COIN', 'SIGN-IN IS NOT OPEN YET', 'Only @vertuoza.com accounts will get in.', 'BACK']],
    ['coin, away on the demo', createElement(CoinOverlay, { away: true, error: null, demo: true, closed: false }), ['LEAVING THE ARCADE…', 'GOOGLE SIGN-IN', 'Demo galaxy: no real sign-in, you come back as a guest.']],
    ['outsider', createElement(OutsiderOverlay, { email: 'ada@example.com' }), ['WRONG CARTRIDGE', 'OMNI LOOP IS FOR @VERTUOZA.COM ACCOUNTS', 'ada@example.com', 'SIGN OUT', 'BACK']],
    ['gate', createElement(GateOverlay, { name: null }), ['WELCOME, RECRUIT', 'PRESS START', 'Browsers need a key press before they play sound.']],
    ['gate, a player back', createElement(GateOverlay, { name: 'ADA' }), ['WELCOME BACK, ADA', 'PRESS START']],
    ['intro', createElement(IntroOverlay, { fleets }), ['ENTROPY IS WINNING.', 'THE GALAXY NEEDS HEROES.', 'CHOOSE YOUR FLEET.', ...fleets.slice(0, 5).map((f) => f.label), 'SKIP']],
    ['link, idle', createElement(LinkOverlay, { state: 'ask', name: 'ADA', login: null, error: null, demo: true }), ['TO PLAY, ADA, LINK YOUR GITHUB.', 'YOUR PULL REQUESTS WILL SCORE', 'FOR THE FLEET YOU JOIN.', 'makes you a player.', 'LINK GITHUB', 'VISIT ONLY']],
    ['link, away', createElement(LinkOverlay, { state: 'away', name: 'ADA', login: null, error: null, demo: true }), ['LEAVING THE ARCADE…', 'GITHUB', 'Demo galaxy: no real GitHub, you come back with a made-up login.']],
    ['link, done', createElement(LinkOverlay, { state: 'done', name: 'ADA', login: 'ada-l', error: null, demo: true }), ['✓ LINKED AS @ADA-L', 'Your pull requests will score for your fleet.', 'PRESS START']],
    ['link, error', createElement(LinkOverlay, { state: 'error', name: 'ADA', login: null, error: 'Linking GitHub failed.', demo: true }), ['TO PLAY, ADA, LINK YOUR GITHUB.', 'Linking GitHub failed.', 'TRY AGAIN', 'VISIT ONLY']],
    ['ready', createElement(ReadyOverlay, { name: 'ADA', team: fleets[1].name }), ['PLAYER 1 READY', `ADA · ${fleets[1].label}`, 'PRESS ANY KEY']],
    ['welcome', createElement(WelcomeOverlay, { name: 'ADA', team: fleets[1].name }), ['WELCOME BACK,', 'ADA', fleets[1].label]],
  ];

  it.each(states)('shows every word of %s on the tall grid, the same as on the wide one', (_, el, expected) => {
    const tall = text(words(el, TALL));
    for (const w of expected) expect(tall).toContain(w);
    expect(tall).toBe(text(words(el, WIDE)));
  });

  it('marks the error lines as alerts on both grids', () => {
    for (const grid of [TALL, WIDE]) {
      expect(words(createElement(CoinOverlay, { away: false, error: 'Sign-in failed.', demo: true, closed: false }), grid)).toMatch(/role="alert"[^>]*>Sign-in failed\./);
      expect(words(createElement(LinkOverlay, { state: 'error', name: 'ADA', login: null, error: 'Linking GitHub failed.', demo: true }), grid)).toMatch(/role="alert"[^>]*>Linking GitHub failed\./);
    }
  });
});

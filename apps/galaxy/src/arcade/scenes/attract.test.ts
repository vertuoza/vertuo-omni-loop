import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildGalaxy, demoEvents, DEMO_PROJECTS, lookOf, type GalaxyView } from '@omni/galaxy';
import { drawSprite, spriteSize } from '@omni/sprites';
import { gridFor, pagesFor } from '../grid';
import { ScreenContext, type ScreenInfo } from '../Screen';
import { setFleets } from '../fleets';
import type { FleetRow } from '../types';
import { TALL, WIDE, type FrameState, type Grid, type SceneName } from './common.ts';
import { drawBoot, drawStory, drawTitle, hallPage, hallPages, PAGES, TALL_SCENES } from './attract.ts';
import { BootOverlay, HeroesOverlay, TitleOverlay } from './attract.tsx';

// The sprites are drawn on a recording context: which sprite, where and how large.
vi.mock('@omni/sprites', async (original) => ({
  ...(await original<typeof import('@omni/sprites')>()),
  drawSprite: vi.fn(),
  drawPlanet: vi.fn(),
}));

const now = new Date('2026-09-25T10:00:00Z');
const view = buildGalaxy(demoEvents(now), { projects: DEMO_PROJECTS, now, source: 'demo' });
const fleets: FleetRow[] = Object.entries(DEMO_PROJECTS.teams)
  .map(([name, t]) => ({ name, ...lookOf(name, t) }))
  .sort((a, b) => a.sort - b.sort);
const withHeroes = (n: number): GalaxyView => ({ ...view, heroes: view.heroes.slice(0, n) });

/** A 2D context that records the rectangles it fills, in grid pixels, through translate/save/restore. */
function recorder() {
  const rects: { x: number; y: number; w: number; h: number; style: unknown }[] = [];
  let at = { x: 0, y: 0 };
  const saved: (typeof at)[] = [];
  const state: Record<string | symbol, unknown> = {};
  const ctx = new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'createLinearGradient') return () => ({ addColorStop() {} });
      if (prop === 'createImageData') return (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });
      if (prop === 'translate') return (x: number, y: number) => { at = { x: at.x + x, y: at.y + y }; };
      if (prop === 'save') return () => { saved.push(at); };
      if (prop === 'restore') return () => { at = saved.pop() ?? { x: 0, y: 0 }; };
      if (prop === 'fillRect') return (x: number, y: number, w: number, h: number) => { rects.push({ x: x + at.x, y: y + at.y, w, h, style: target.fillStyle }); };
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

function frame(scene: SceneName, grid: Grid, sceneT = 2): FrameState {
  return {
    scene, grid, page: 0, view, layout: [], sel: 0, fleetSel: 0, t: 5, sceneT, reduced: true,
    join: { fleets, pick: 0, lockedAt: null, team: null, away: false, hero: { v: 1, body: 'girl', skin: 1, hair: 0, suit: 0, cape: 1 } },
  };
}

/** Every sprite drawn since the last reset, as the box it covers on the grid. */
function spritesDrawn() {
  return vi.mocked(drawSprite).mock.calls.map(([, name, x, y, o]) => {
    const { w, h } = spriteSize(name);
    const k = o?.scale ?? 1;
    return { name, x, y, w: w * k, h: h * k };
  });
}

const inside = (b: { x: number; y: number; w: number; h: number }, g: Grid) => b.x >= 0 && b.y >= 0 && b.x + b.w <= g.w && b.y + b.h <= g.h;

function screen(info: Partial<ScreenInfo>, el: ReactElement) {
  const value: ScreenInfo = { form: 'handheld', grid: TALL, page: 0, pages: 1, ...info };
  return renderToStaticMarkup(createElement(ScreenContext.Provider, { value }, el));
}
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

beforeAll(() => { vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas); setFleets(fleets); });
afterAll(() => { vi.unstubAllGlobals(); });
beforeEach(() => { vi.mocked(drawSprite).mockClear(); });

describe('the attract group on the tall grid', () => {
  it('lists the boot, the title and the Hall of Heroes as tall', () => {
    expect([...TALL_SCENES].sort()).toEqual(['boot', 'heroes', 'title']);
    for (const scene of TALL_SCENES) {
      expect(gridFor('handheld', scene), scene).toBe(TALL);
      expect(gridFor('advance', scene), scene).toBe(WIDE);
      expect(gridFor('full', scene), scene).toBe(WIDE);
    }
  });
});

describe('the boot on the tall grid', () => {
  it('draws the Vertuoza mark in the middle of the screen, on black to its edges', () => {
    const { ctx, rects } = recorder();
    drawBoot(ctx, frame('boot', TALL, 5));
    const black = rects.find((r) => r.style === '#000')!;
    expect(black.x).toBeLessThanOrEqual(0);
    expect(black.y).toBeLessThanOrEqual(0);
    expect(black.x + black.w).toBeGreaterThanOrEqual(TALL.w);
    expect(black.y + black.h).toBeGreaterThanOrEqual(TALL.h);
    const mark = rects.filter((r) => typeof r.style !== 'string' && r.w > 0);
    const left = Math.min(...mark.map((r) => r.x)), right = Math.max(...mark.map((r) => r.x + r.w));
    const top = Math.min(...mark.map((r) => r.y)), bottom = Math.max(...mark.map((r) => r.y + r.h));
    expect((left + right) / 2).toBe(TALL.w / 2);
    expect(top).toBeGreaterThan(0);
    expect(bottom).toBeLessThan(TALL.h / 2 + 20); // the words go under it
  });

  it('draws it where it always was on the wide grid', () => {
    const { ctx, rects } = recorder();
    drawBoot(ctx, frame('boot', WIDE, 5));
    const mark = rects.filter((r) => typeof r.style !== 'string' && r.w > 0);
    expect(Math.min(...mark.map((r) => r.x))).toBe(284);
    expect(Math.min(...mark.map((r) => r.y))).toBe(96);
  });
});

describe('the title on the tall grid', () => {
  it('flies the commander and the five fleets inside the screen', () => {
    drawTitle(recorder().ctx, frame('title', TALL));
    const drawn = spritesDrawn();
    expect(drawn.map((s) => s.name)).toContain('omni');
    expect(drawn).toHaveLength(1 + Math.min(5, fleets.length));
    for (const s of drawn) expect(inside(s, TALL), `${s.name} at ${s.x},${s.y}`).toBe(true);
  });

  it('marches Entropy across the bottom of the screen in the story', () => {
    drawStory(recorder().ctx, frame('title', TALL, 3));
    const shown = spritesDrawn().filter((s) => s.name === 'entropy' && s.x + s.w > 0 && s.x < TALL.w);
    expect(shown.length).toBeGreaterThanOrEqual(3);
    for (const s of shown) {
      expect(s.y).toBeGreaterThan(TALL.h / 2);
      expect(s.y + s.h).toBeLessThanOrEqual(TALL.h);
    }
  });

  it('marches nine of them across the wide screen, as before', () => {
    drawStory(recorder().ctx, frame('title', WIDE, 3));
    const drawn = spritesDrawn().filter((s) => s.name === 'entropy');
    expect(drawn).toHaveLength(9);
    for (const s of drawn) expect(s.y).toBe(296);
  });

  it('shows the same words on the tall grid as on the wide one, in every phase', () => {
    for (const phase of ['title', 'story', 'hiscore'] as const) {
      const props = { view, phase, sceneT: 30, who: 'DEMO · P1 GUEST', signedIn: true };
      const tall = text(screen({ grid: TALL }, createElement(TitleOverlay, props)));
      const wide = text(screen({ form: 'full', grid: WIDE }, createElement(TitleOverlay, props)));
      expect(tall, phase).toBe(wide);
    }
    expect(text(screen({ grid: TALL }, createElement(BootOverlay)))).toBe('VERTUOZA PRESENTS');
  });

  it('shows every high score it shows today: the top five, on one page', () => {
    const html = text(screen({ grid: TALL }, createElement(TitleOverlay, { view, phase: 'hiscore', sceneT: 30, who: '', signedIn: false })));
    for (const h of view.heroes.slice(0, 5)) expect(html).toContain(h.name.toUpperCase());
    expect(html).not.toContain('PAGE');
  });
});

describe('the Hall of Heroes', () => {
  it('takes one page on the wide grid, whatever the table holds', () => {
    for (const n of [0, 3, 8, 12]) expect(hallPages(n, WIDE)).toBe(1);
  });

  it('takes a page for every four heroes of its eight on the tall grid', () => {
    expect(hallPages(0, TALL)).toBe(1);
    expect(hallPages(4, TALL)).toBe(1);
    expect(hallPages(5, TALL)).toBe(2);
    expect(hallPages(8, TALL)).toBe(2);
    expect(hallPages(20, TALL)).toBe(2);
  });

  it('declares its pages, so ◀ ▶ turn them on the tall grid', () => {
    expect(view.heroes.length).toBeGreaterThan(8);
    expect(pagesFor('heroes', { view, grid: TALL }, PAGES)).toBe(2);
    expect(pagesFor('heroes', { view, grid: WIDE }, PAGES)).toBe(1);
    expect(pagesFor('heroes', { view: withHeroes(4), grid: TALL }, PAGES)).toBe(1);
    expect(pagesFor('title', { view, grid: TALL }, PAGES)).toBe(1);
  });

  it('shows every row of the wide table on exactly one tall page, in order', () => {
    const wide = hallPage(view.heroes, WIDE, 0);
    expect(wide).toEqual(view.heroes.slice(0, 8));
    const pages = Array.from({ length: hallPages(view.heroes.length, TALL) }, (_, p) => hallPage(view.heroes, TALL, p));
    expect(pages.map((p) => p.length)).toEqual([4, 4]);
    expect(pages.flat()).toEqual(wide);
    expect(hallPage(view.heroes, TALL, 9)).toEqual(pages[1]); // past the last page: the last page
  });

  it('shows four rows a page and "PAGE n/N" on the tall grid', () => {
    const first = text(screen({ page: 0, pages: 2 }, createElement(HeroesOverlay, { view, crew: [] })));
    const second = text(screen({ page: 1, pages: 2 }, createElement(HeroesOverlay, { view, crew: [] })));
    expect(first).toMatch(/1ST .* 2ND .* 3RD .* 4TH /);
    expect(first).not.toMatch(/\b5TH\b/);
    expect(first).toContain('PAGE 1/2');
    expect(second).toMatch(/5TH .* 6TH .* 7TH .* 8TH /);
    expect(second).not.toMatch(/\b4TH\b/);
    expect(second).toContain('PAGE 2/2');
    for (const page of [first, second]) {
      expect(page).toContain(`SEASON ${view.season}`);
      expect(page).toContain('TOP FLEETS');
      expect(page).toMatch(/RANK HERO FLEET SCORE/);
    }
  });

  it('shows its whole table and no page on the wide grid, as today', () => {
    const wide = text(screen({ form: 'full', grid: WIDE }, createElement(HeroesOverlay, { view, crew: [] })));
    for (const h of view.heroes.slice(0, 8)) expect(wide).toContain(h.name.toUpperCase());
    expect(wide).not.toContain(view.heroes[8].name.toUpperCase());
    expect(wide).not.toContain('PAGE');
  });

  it('says so when nobody has scored, on one page', () => {
    const empty = text(screen({}, createElement(HeroesOverlay, { view: withHeroes(0), crew: [] })));
    expect(empty).toContain('NO SCORES THIS SEASON YET');
    expect(empty).not.toContain('PAGE');
  });
});

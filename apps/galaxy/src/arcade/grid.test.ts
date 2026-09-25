import { describe, expect, it } from 'vitest';
import { buildGalaxy, demoEvents, DEMO_PROJECTS } from '@omni/galaxy';
import { fit, frameFor, gridFor, pagesFor, TALL, turnPage, WIDE } from './grid';
import type { SceneName } from './scenes/common.ts';

const SCENES: SceneName[] = [
  'boot', 'title', 'menu', 'map', 'planet', 'fleets', 'heroes', 'briefing', 'coin', 'away', 'gate', 'intro', 'select',
  'name', 'hero', 'link', 'ready', 'welcome', 'outsider',
];

describe('the two grids', () => {
  it('are 640×360 and 320×288', () => {
    expect(WIDE).toEqual({ name: 'wide', w: 640, h: 360 });
    expect(TALL).toEqual({ name: 'tall', w: 320, h: 288 });
  });
});

describe('gridFor', () => {
  const listed = new Set<SceneName>(['menu', 'map']);

  it('gives the wide grid on full and on advance, listed or not', () => {
    for (const form of ['full', 'advance'] as const) {
      for (const scene of SCENES) expect(gridFor(form, scene, listed), `${form} ${scene}`).toBe(WIDE);
    }
  });

  it('gives the tall grid on handheld to a scene its group lists as tall', () => {
    expect(gridFor('handheld', 'menu', listed)).toBe(TALL);
    expect(gridFor('handheld', 'map', listed)).toBe(TALL);
  });

  it('gives the wide grid on handheld to any other scene, letterboxed in the tall lens', () => {
    expect(gridFor('handheld', 'title', listed)).toBe(WIDE);
    expect(frameFor('handheld')).toBe(TALL);
    const lens = fit({ w: 341, h: 307 }, TALL);
    const screen = fit(lens, WIDE);
    expect(screen.w).toBe(lens.w);
    expect(screen.h).toBeLessThan(lens.h);
    expect(screen.y).toBeGreaterThan(0);
  });

  it('reads the lists the scene groups declare', () => {
    // Shell first: until a group lists its scenes, every scene is wide, and still reachable.
    for (const scene of SCENES) expect([WIDE, TALL]).toContain(gridFor('handheld', scene));
  });
});

describe('frameFor', () => {
  it('shapes the screen for the grid each form draws on', () => {
    expect(frameFor('full')).toBe(WIDE);
    expect(frameFor('advance')).toBe(WIDE);
    expect(frameFor('handheld')).toBe(TALL);
  });
});

describe('fit', () => {
  it('fills a 1440×900 window with a 1440×810 screen, centred', () => {
    expect(fit({ w: 1440, h: 900 }, WIDE)).toEqual({ scale: 2.25, w: 1440, h: 810, x: 0, y: 45 });
  });

  it('keeps the shape, fractions allowed, with bars on the two sides it does not reach', () => {
    const r = fit({ w: 1000, h: 400 }, WIDE);
    expect(r.scale).toBeCloseTo(400 / 360);
    expect(r.h).toBeCloseTo(400);
    expect(r.x).toBeCloseTo((1000 - r.w) / 2);
    expect(r.y).toBe(0);
  });

  it('puts the tall grid at 1.0× or more in a 393px-wide Game Boy lens', () => {
    expect(fit({ w: 341, h: 400 }, TALL).scale).toBeGreaterThanOrEqual(1);
  });
});

describe('pagesFor', () => {
  const now = new Date('2026-09-25T10:00:00Z');
  const view = buildGalaxy(demoEvents(now), { projects: DEMO_PROJECTS, now, source: 'demo' });

  it('gives one page to a scene no group declares pages for', () => {
    expect(pagesFor('heroes', { view, grid: TALL }, {})).toBe(1);
    expect(pagesFor('briefing', { view: null, grid: TALL }, {})).toBe(1);
  });

  it('gives the pages a group declares, and never fewer than one', () => {
    const declared = { heroes: ({ grid }: { grid: typeof TALL }) => (grid.name === 'tall' ? 3 : 1), briefing: () => 0 };
    expect(pagesFor('heroes', { view, grid: TALL }, declared)).toBe(3);
    expect(pagesFor('heroes', { view, grid: WIDE }, declared)).toBe(1);
    expect(pagesFor('briefing', { view, grid: TALL }, declared)).toBe(1);
  });

  it('gives one page without a galaxy', () => {
    expect(pagesFor('heroes', { view: null, grid: TALL }, { heroes: () => 4 })).toBe(1);
  });
});

describe('turnPage', () => {
  it('turns forward with ▶ and back with ◀, round from the last page to the first', () => {
    expect(turnPage(0, 3, 'right')).toBe(1);
    expect(turnPage(2, 3, 'right')).toBe(0);
    expect(turnPage(0, 3, 'left')).toBe(2);
    expect(turnPage(1, 3, 'left')).toBe(0);
  });

  it('turns from the last page when the page shown is past it (the grid changed under it)', () => {
    expect(turnPage(4, 2, 'left')).toBe(0);
    expect(turnPage(4, 2, 'right')).toBe(0);
  });

  it('stays on a single page', () => {
    expect(turnPage(0, 1, 'right')).toBe(0);
    expect(turnPage(0, 1, 'left')).toBe(0);
  });
});

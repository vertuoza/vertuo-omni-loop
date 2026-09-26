import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildGalaxy, demoEvents, DEMO_PROJECTS, lookOf } from '@omni/galaxy';
import { drawFrame, layoutMap, TALL, WIDE, type FrameState, type Grid, type SceneName } from './index';
import { setFleets } from '../fleets';
import { HOUSE_BRAND } from '../brand';
import { markFor } from '../mark';
import { DEFAULT_THEME } from '../theme';
import type { FleetRow } from '../types';

// Every scene the arcade can open, each listed once: a scene missing here fails the typecheck.
const SCENES: Record<SceneName, true> = {
  boot: true, title: true, menu: true, map: true, planet: true, fleets: true, heroes: true, briefing: true,
  coin: true, away: true, gate: true, intro: true, select: true, name: true, hero: true, link: true, ready: true,
  welcome: true, outsider: true,
};

// A 2D context that counts what is drawn on it, and the offscreen canvases the sprites render into.
function recorder() {
  const drawn = { fills: 0, images: 0 };
  const state: Record<string | symbol, unknown> = {};
  const ctx = new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'createImageData') return (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });
      if (prop === 'createLinearGradient') return () => ({ addColorStop() {} });
      if (prop === 'fillRect' || prop === 'fill') return () => { drawn.fills++; };
      if (prop === 'drawImage') return () => { drawn.images++; };
      return () => {};
    },
    set(target, prop, value) { target[prop] = value; return true; },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, drawn };
}

class FakeOffscreenCanvas {
  constructor(public width: number, public height: number) {}
  getContext() { return recorder().ctx; }
}

const now = new Date('2026-09-25T10:00:00Z');
const view = buildGalaxy(demoEvents(now), { projects: DEMO_PROJECTS, now, source: 'demo' });
const fleets: FleetRow[] = Object.entries(DEMO_PROJECTS.teams)
  .map(([name, t]) => ({ name, ...lookOf(name, t) }))
  .sort((a, b) => a.sort - b.sort);

function frame(scene: SceneName, sceneT = 2, grid: Grid = WIDE): FrameState {
  return {
    scene, grid, page: 0, view, layout: layoutMap(view, grid), sel: 0, fleetSel: 0, t: 5, sceneT, reduced: false, mark: markFor(HOUSE_BRAND.name), theme: DEFAULT_THEME,
    join: {
      fleets, pick: 1, lockedAt: null, team: fleets[1].name, away: false,
      hero: { v: 1, body: 'girl', skin: 1, hair: 0, suit: 0, cape: 1 },
    },
  };
}

describe('layoutMap', () => {
  it('lays the planets out on the wide grid as it always has, inside it', () => {
    const slots = layoutMap(view, WIDE);
    expect(slots.map((s) => s.index)).toEqual(view.planets.map((_, i) => i));
    for (const s of slots) {
      expect(s.x - s.r).toBeGreaterThanOrEqual(0);
      expect(s.x + s.r).toBeLessThanOrEqual(WIDE.w);
      expect(s.y - s.r).toBeGreaterThanOrEqual(0);
      expect(s.y + s.r).toBeLessThanOrEqual(WIDE.h);
    }
  });

  it('lays every planet out on any grid it is given, in that grid\'s pixels', () => {
    for (const s of layoutMap(view, TALL)) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(TALL.w);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThanOrEqual(TALL.h);
    }
  });
});

describe('drawFrame', () => {
  beforeAll(() => { vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas); setFleets(fleets); });
  afterAll(() => { vi.unstubAllGlobals(); });

  it.each(Object.keys(SCENES) as SceneName[])('draws a frame for %s', (scene) => {
    const { ctx, drawn } = recorder();
    drawFrame(ctx, frame(scene), 'title');
    expect(drawn.fills + drawn.images).toBeGreaterThan(0);
  });

  it.each(Object.keys(SCENES) as SceneName[])('draws a frame for %s on the tall grid', (scene) => {
    const { ctx, drawn } = recorder();
    drawFrame(ctx, frame(scene, 2, TALL), 'title');
    expect(drawn.fills + drawn.images).toBeGreaterThan(0);
  });

  it.each(['title', 'story', 'hiscore'] as const)('draws the title in its %s phase', (phase) => {
    const { ctx, drawn } = recorder();
    drawFrame(ctx, frame('title'), phase);
    expect(drawn.fills + drawn.images).toBeGreaterThan(0);
  });

  it('draws the intro at every beat, and the joining screens while the player is away', () => {
    for (const sceneT of [1, 6, 15, 19.8]) {
      const { ctx, drawn } = recorder();
      drawFrame(ctx, frame('intro', sceneT), 'title');
      expect(drawn.fills + drawn.images).toBeGreaterThan(0);
    }
    for (const scene of ['coin', 'link'] as const) {
      const { ctx, drawn } = recorder();
      drawFrame(ctx, { ...frame(scene), join: { ...frame(scene).join, away: true } }, 'title');
      expect(drawn.fills).toBeGreaterThan(0);
    }
  });
});

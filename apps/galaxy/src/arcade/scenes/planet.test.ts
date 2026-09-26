import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildGalaxy, demoEvents, DEMO_PROJECTS, lookOf, type Planet } from '@omni/galaxy';
import { gridFor } from '../grid';
import { setFleets } from '../fleets';
import { HOUSE_BRAND } from '../brand';
import { markFor } from '../mark';
import { DEFAULT_THEME } from '../theme';
import type { FleetRow } from '../types';
import { TALL, WIDE, type FrameState, type Grid } from './common.ts';
import { drawPlanetScene, planetStage, TALL_BAND, TALL_SCENES } from './planet.ts';

const now = new Date('2026-09-25T10:00:00Z');
const view = buildGalaxy(demoEvents(now), { projects: DEMO_PROJECTS, now, source: 'demo' });
const fleets: FleetRow[] = Object.entries(DEMO_PROJECTS.teams)
  .map(([name, t]) => ({ name, ...lookOf(name, t) }))
  .sort((a, b) => a.sort - b.sort);

/** A box a sprite or the planet was drawn in, in grid pixels. */
interface Box { x: number; y: number; w: number; h: number }

// A 2D context that keeps every image drawn on it, and the offscreen canvases the sprites and the
// planet render into.
function recorder() {
  const images: Box[] = [];
  const state: Record<string | symbol, unknown> = {};
  const ctx = new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'createImageData') return (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });
      if (prop === 'createLinearGradient') return () => ({ addColorStop() {} });
      if (prop === 'drawImage') {
        return (img: { width: number; height: number }, x: number, y: number, w = img.width, h = img.height) => { images.push({ x, y, w, h }); };
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

function frame(sel: number, t: number, grid: Grid): FrameState {
  return {
    scene: 'planet', grid, page: 0, view, layout: [], sel, fleetSel: 0, t, sceneT: t, reduced: false, mark: markFor(HOUSE_BRAND.name), theme: DEFAULT_THEME,
    join: { fleets, pick: 0, lockedAt: null, team: null, away: false, hero: { v: 1, body: 'girl', skin: 1, hair: 0, suit: 0, cape: 1 } },
  };
}

/** A planet of the demo galaxy with every fleet on station, one of them without a mascot (a hero stand-in, 48 px tall). */
function crowded(): Planet {
  const p = view.planets.find((x) => x.state === 'distress')!;
  const teams = ['no-mascot-fleet', ...fleets.map((f) => f.name)]; // five fly: the stand-in among them
  return { ...p, zones: teams.map((team, i) => ({ id: `s${i + 1}`, region: 'vertuo-core', wave: 1, state: 'claimed', contributor: 'dime', team, at: p.chartedAt! })) } as Planet;
}

describe('the planet on the tall grid', () => {
  it('is listed as tall: the Game Boy held upright draws it on 320×288, every other form on the wide grid', () => {
    expect(TALL_SCENES).toContain('planet');
    expect(gridFor('handheld', 'planet')).toBe(TALL);
    expect(gridFor('full', 'planet')).toBe(WIDE);
    expect(gridFor('advance', 'planet')).toBe(WIDE);
  });
});

describe('planetStage', () => {
  it('keeps the wide stage where it has always been', () => {
    expect(planetStage(WIDE)).toEqual({
      cx: 176, cy: 204, r: 92,
      orbit: { rx: 126, ry: 30 },
      station: { rx: 148, ry: 68, dy: -8 },
      mark: 2,
      skull: { x: 160, y: 68 },
      sparkle: 184,
      nebula: { x: -40, y: 40, w: 360, h: 300 },
    });
  });

  it('puts the tall stage in the band above the panel, clear of the header on its left', () => {
    const s = planetStage(TALL);
    expect(s.cy - s.r).toBeGreaterThanOrEqual(0);
    expect(s.cy + s.r).toBeLessThanOrEqual(TALL_BAND);
    expect(s.cx + s.r).toBeLessThanOrEqual(TALL.w);
    expect(TALL_BAND).toBeLessThan(TALL.h / 3);
  });
});

describe('drawPlanetScene on the tall grid', () => {
  beforeAll(() => { vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas); setFleets(fleets); });
  afterAll(() => { vi.unstubAllGlobals(); });

  // The header takes the band's left, from x 0 to the stage's left edge.
  const HEADER = 200;

  const drawn = (p: Planet, t: number) => {
    const { ctx, images } = recorder();
    drawPlanetScene(ctx, { ...frame(0, t, TALL), view: { ...view, planets: [p] } });
    const n = planetStage(TALL).nebula;
    return images.filter((b) => !(b.w === n.w && b.h === n.h)); // the nebula is the backdrop, and may run off
  };
  const isPlanet = (b: Box) => b.w === b.h && b.w > 48;

  it('draws the planet, its Entropy in orbit and its fleets on station inside the band, over a whole orbit', () => {
    const { r } = planetStage(TALL);
    for (const p of [...view.planets, crowded()]) {
      for (let t = 0; t < 20; t += 0.25) {
        const boxes = drawn(p, t);
        expect(boxes.filter(isPlanet), `#${p.prd}`).toHaveLength(1);
        for (const b of boxes) {
          const where = `#${p.prd} at t=${t}: ${JSON.stringify(b)}`;
          if (isPlanet(b)) {
            // The canvas the planet renders into has room for a ring: the disc, its glow and its ring are what shows.
            const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
            expect(cy - r - 3, where).toBeGreaterThanOrEqual(0);
            expect(cy + r + 3, where).toBeLessThanOrEqual(TALL_BAND);
            expect(cx - r * 1.6, where).toBeGreaterThanOrEqual(HEADER);
            expect(cx + r * 1.6, where).toBeLessThanOrEqual(TALL.w);
            continue;
          }
          expect(b.x, where).toBeGreaterThanOrEqual(HEADER);
          expect(b.x + b.w, where).toBeLessThanOrEqual(TALL.w);
          expect(b.y, where).toBeGreaterThanOrEqual(0);
          expect(b.y + b.h, where).toBeLessThanOrEqual(TALL_BAND);
        }
      }
    }
  });

  it('draws every fleet on station and every Entropy unit in orbit', () => {
    const p = crowded();
    const boxes = drawn(p, 3);
    const entropy = boxes.filter((b) => b.w === 24 && b.h === 24).length;
    const heroes = boxes.filter((b) => (b.w === 32 && b.h === 32) || (b.w === 32 && b.h === 48)).length;
    expect(entropy).toBe(Math.min(8, p.openWounds.length));
    expect(heroes).toBe(Math.min(5, new Set(p.zones.map((z) => z.team)).size));
  });
});

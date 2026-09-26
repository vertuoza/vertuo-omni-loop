import { describe, expect, it } from 'vitest';
import { buildGalaxy, demoEvents, DEMO_PROJECTS, type GalaxyView, type Planet } from '@omni/galaxy';
import { gridFor } from '../grid';
import { planetAt } from '../Screen';
import { TALL, WIDE, type MapSlot } from './common.ts';
import { layoutMap, neighbour, TALL_MAP, TALL_SCENES } from './map.ts';

const now = new Date('2026-09-25T10:00:00Z');
const view = buildGalaxy(demoEvents(now), { projects: DEMO_PROJECTS, now, source: 'demo' });

const DIRS = ['up', 'down', 'left', 'right'] as const;

/** Every planet the D-pad reaches from `from`, pressing the four directions as often as it likes. */
function reachable(layout: MapSlot[], from: number): Set<number> {
  const seen = new Set([from]);
  const queue = [from];
  while (queue.length) {
    const at = queue.shift()!;
    for (const dir of DIRS) {
      const next = neighbour(layout, at, dir);
      if (!seen.has(next)) { seen.add(next); queue.push(next); }
    }
  }
  return seen;
}

/** Two planets overlap when their discs share a pixel. */
function overlaps(layout: MapSlot[]): string[] {
  const found: string[] = [];
  layout.forEach((a, i) => layout.slice(i + 1).forEach((b) => {
    if (Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r) found.push(`#${a.prd} and #${b.prd}`);
  }));
  return found;
}

function outside(layout: MapSlot[], grid: { w: number; h: number }): string[] {
  return layout.filter((s) => s.x - s.r < 0 || s.x + s.r > grid.w || s.y - s.r < 0 || s.y + s.r > grid.h).map((s) => `#${s.prd}`);
}

// A galaxy of the given sectors, each with planets of the given classes: the only fields the layout reads.
function galaxy(sectors: Record<string, number[]>): GalaxyView {
  let prd = 100;
  const planets = Object.entries(sectors).flatMap(([sector, classes]) =>
    classes.map((c) => ({ prd: prd++, sector, class: c }) as unknown as Planet));
  return { ...view, sectors: Object.keys(sectors).map((name) => ({ name, repos: [], fleets: [] })), planets };
}

describe('the map on the wide grid', () => {
  it('lays the demo galaxy out exactly as it always has', () => {
    // Pinned before the tall layout was added: the wide map at 1440×900 and 852×393 does not move.
    expect(layoutMap(view, WIDE)).toEqual([
      { prd: 985, x: 47, y: 99, r: 14, index: 0 },
      { prd: 2299, x: 140, y: 108, r: 18, index: 1 },
      { prd: 2332, x: 307, y: 113, r: 18, index: 2 },
      { prd: 2350, x: 73, y: 165, r: 18, index: 3 },
      { prd: 2388, x: 487, y: 97, r: 14, index: 4 },
      { prd: 2410, x: 147, y: 168, r: 22, index: 5 },
      { prd: 2455, x: 582, y: 102, r: 14, index: 6 },
      { prd: 2471, x: 328, y: 218, r: 18, index: 7 },
      { prd: 2502, x: 490, y: 164, r: 14, index: 8 },
      { prd: 2520, x: 569, y: 172, r: 18, index: 9 },
      { prd: 2533, x: 489, y: 232, r: 14, index: 10 },
      { prd: 2541, x: 48, y: 233, r: 14, index: 11 },
    ]);
  });
});

describe('the map on the tall grid', () => {
  const tall = layoutMap(view, TALL);

  it('is listed as tall, so the Game Boy held upright draws it on 320×288', () => {
    expect(TALL_SCENES).toContain('map');
    expect(gridFor('handheld', 'map')).toBe(TALL);
    expect(gridFor('full', 'map')).toBe(WIDE);
    expect(gridFor('advance', 'map')).toBe(WIDE);
  });

  it('lays out every planet of the demo galaxy, once each', () => {
    expect(tall.map((s) => s.index)).toEqual(view.planets.map((_, i) => i));
    expect(tall.map((s) => s.prd)).toEqual(view.planets.map((p) => p.prd));
  });

  it('keeps every planet inside 320×288 with its radius', () => {
    expect(outside(tall, TALL)).toEqual([]);
  });

  it('keeps every planet apart: no two overlap', () => {
    expect(overlaps(tall)).toEqual([]);
  });

  it('lets the D-pad reach every planet from any planet', () => {
    for (const s of tall) expect(reachable(tall, s.index).size, `from #${s.prd}`).toBe(tall.length);
  });

  it('keeps the planets between the sector labels and the dialog, with room above each for its icon', () => {
    for (const s of tall) {
      expect(s.y - s.r - TALL_MAP.icon, `#${s.prd}`).toBeGreaterThanOrEqual(TALL_MAP.top);
      expect(s.y + s.r, `#${s.prd}`).toBeLessThanOrEqual(TALL_MAP.bottom);
    }
  });

  it('keeps each planet in its sector\'s column', () => {
    const colW = TALL.w / view.sectors.length;
    for (const s of tall) {
      const col = view.sectors.findIndex((sec) => sec.name === view.planets[s.index].sector);
      expect(s.x - s.r, `#${s.prd}`).toBeGreaterThanOrEqual(col * colW);
      expect(s.x + s.r, `#${s.prd}`).toBeLessThanOrEqual((col + 1) * colW);
    }
  });

  it('draws a bigger class as a bigger planet, the same size in every sector', () => {
    const byClass = new Map<number, Set<number>>();
    for (const s of tall) {
      const c = view.planets[s.index].class;
      byClass.set(c, (byClass.get(c) ?? new Set()).add(s.r));
    }
    for (const radii of byClass.values()) expect(radii.size).toBe(1);
    const sizes = [...byClass.entries()].sort(([a], [b]) => a - b).map(([, r]) => [...r][0]);
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b));
  });

  it('finds each planet under a tap on it, in the tall grid\'s pixels', () => {
    for (const s of tall) expect(planetAt(tall, { x: s.x, y: s.y })?.prd).toBe(s.prd);
  });

  it.each([
    ['one planet', { solo: [2] }],
    ['a crowded sector', { crowd: [1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4, 1, 2] }],
    ['four sectors', { a: [4, 4, 4], b: [1], c: [2, 3, 1, 2, 3, 1, 2], d: [3, 3] }],
    ['a sector with no planet', { a: [2, 2], empty: [], b: [1, 3, 4] }],
  ])('keeps %s inside the tall grid, apart and reachable', (_, sectors) => {
    const g = galaxy(sectors);
    const slots = layoutMap(g, TALL);
    expect(slots).toHaveLength(g.planets.length);
    expect(outside(slots, TALL)).toEqual([]);
    expect(overlaps(slots)).toEqual([]);
    for (const s of slots) expect(reachable(slots, s.index).size).toBe(slots.length);
  });
});

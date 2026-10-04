import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadConfig } from 'vertuo-omni-plan/kit/lib/config.ts';
import { createContext } from 'vertuo-omni-plan/kit/lib/context.ts';
import { readGraph } from 'vertuo-omni-plan/kit/lib/knowledge/graph.ts';
import { KINDS, type EntryKind, type KnowledgeEntry, type KnowledgeGraph } from '../../data/knowledge';
import { TALL, WIDE, type Grid } from './common.ts';
import {
  CHART_LINES, chartKey, chartStep, layoutChart, layoutSystem, orbitStep, sunAt, SYSTEM_LINES, worldAt,
  type ChartCursor, type ChartLayout, type Dir, type SystemLayout,
} from './chart-layout.ts';
import { sure } from '../test/sure';
import { assertDefined } from 'vertuo-omni-plan/kit/test/assert.ts';

// This repository's own knowledge, read through the kit as the app reads it on the server.
const root = fileURLToPath(new URL('../../../../../', import.meta.url));
const REPO = readGraph({ ctx: createContext(root, loadConfig(root)) }) as KnowledgeGraph;

const entry = (id: string, kind: EntryKind, domain: string, over: Partial<KnowledgeEntry> = {}): KnowledgeEntry => ({
  id, kind, domain, domains: [domain], statement: `${id} holds.`, why: null, status: 'proposed', serves: null,
  enforced: false, enforcedBy: null, prd: null, file: `.omni-loop/knowledge/domains/${domain}/x.md`, ...over,
});

/** A graph of one domain holding `principles`, `rules` and `invariants` entries. */
function synthetic(principles: number, rules: number, invariants: number, name = 'crowd'): KnowledgeGraph {
  const code = name.toUpperCase();
  const entries = [
    ...Array.from({ length: principles }, (_, i) => entry(`P-${code}-${i + 1}`, 'principle', name, { status: i % 3 ? 'proposed' : 'law' })),
    ...Array.from({ length: rules }, (_, i) => entry(`BR-${code}-${i + 1}`, 'rule', name, { serves: `P-${code}-${(i % Math.max(1, principles)) + 1}` })),
    ...Array.from({ length: invariants }, (_, i) => entry(`N-${code}-${i + 1}`, 'invariant', name)),
  ];
  return {
    version: 1, repo: 'acme/widgets',
    domains: [{ name, code, scope: 'domain', counts: { principles, rules, invariants, laws: 0, proposed: entries.length } }],
    entries,
    links: entries.filter((e) => e.serves && principles).map((e) => ({ from: e.id, to: sure(e.serves, 'e.serves'), kind: 'serves' as const })),
    loose: [], unserved: [],
  };
}

const GRIDS: [string, Grid][] = [['wide', WIDE], ['tall', TALL]];
const DIRS: Dir[] = ['up', 'down', 'left', 'right'];

/** Two worlds overlap when their discs share a pixel. */
function overlaps(layout: SystemLayout): string[] {
  const found: string[] = [];
  layout.worlds.forEach((a, i) => { layout.worlds.slice(i + 1).forEach((b) => {
    if (Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r) found.push(`${a.entry.id} and ${b.entry.id}`);
  }); });
  return found;
}

function outside(layout: SystemLayout, grid: Grid): string[] {
  const d = SYSTEM_LINES[grid.name].diagram;
  return layout.worlds
    .filter((w) => w.x - w.r < d.x || w.x + w.r > d.x + d.w || w.y - w.r < d.y || w.y + w.r > d.y + d.h)
    .map((w) => w.entry.id);
}

/** Every world the D-pad reaches from `from`, pressing the four directions as often as it likes. */
function reachable(step: (from: number, dir: Dir) => number, from: number): Set<number> {
  const seen = new Set([from]);
  const queue = [from];
  while (queue.length) {
    const at = sure(queue.shift(), 'queue.shift()');
    for (const dir of DIRS) {
      const next = step(at, dir);
      if (!seen.has(next)) { seen.add(next); queue.push(next); }
    }
  }
  return seen;
}

/** Checks everything a system's layout promises, for `graph`'s domain `name` on `grid`. */
function holds(graph: KnowledgeGraph, name: string, grid: Grid) {
  const layout = layoutSystem(graph, name, grid);
  const mine = graph.entries.filter((e) => e.domain === name);
  // Every entry seated, once.
  expect(layout.worlds.map((w) => w.entry.id).sort()).toEqual(mine.map((e) => e.id).sort());
  expect(outside(layout, grid)).toEqual([]);
  expect(overlaps(layout)).toEqual([]);
  // Principles inside rules inside invariants: each kind's orbits are further out than the one before.
  const kindAt = layout.orbits.map((o) => KINDS.indexOf(o.kind));
  expect(kindAt).toEqual([...kindAt].sort((a, b) => a - b));
  for (const kind of KINDS) expect(layout.orbits.some((o) => o.kind === kind), `${kind} keeps its orbit`).toBe(true);
  layout.orbits.forEach((o, i) => { if (i) expect(o.ry).toBeGreaterThan(sure(layout.orbits[i - 1], 'layout.orbits[i - 1]').ry); });
  // Each world on an orbit of its own kind, in id order orbit by orbit.
  for (const w of layout.worlds) expect(sure(layout.orbits[w.orbit], 'layout.orbits[w.orbit]').kind).toBe(w.entry.kind);
  for (const kind of KINDS) {
    const ids = layout.worlds.filter((w) => w.entry.kind === kind).map((w) => w.entry.id);
    expect(ids).toEqual([...ids].sort((a, b) => a.localeCompare(b, 'en', { numeric: true })));
  }
  // The worlds sit on their orbit's ellipse, around the sun, clear of it.
  for (const w of layout.worlds) {
    const o = layout.orbits[w.orbit];
    assertDefined(o, 'o');
    expect(((w.x - layout.cx) / o.rx) ** 2 + ((w.y - layout.cy) / o.ry) ** 2).toBeCloseTo(1, 2);
    expect(Math.hypot(w.x - layout.cx, w.y - layout.cy)).toBeGreaterThanOrEqual(layout.sun + w.r);
  }
  return layout;
}

describe('the system: one domain as an orrery', () => {
  it.each(GRIDS)('seats this repository\'s product on the %s grid: every entry, inside, apart, by kind', (_, grid) => {
    const layout = holds(REPO, 'product', grid);
    expect(layout.worlds.length).toBeGreaterThan(50);
    expect(sure(layout.worlds[0], 'layout.worlds[0]').r).toBeLessThanOrEqual(SYSTEM_LINES[grid.name].world.max);
  });

  it.each([
    ['150 rules', 0, 150, 0],
    ['50 of each kind', 50, 50, 50],
    ['120 principles', 120, 20, 10],
    ['150 invariants', 0, 0, 150],
  ])('seats a synthetic domain of %s on both grids', (_, p, r, n) => {
    for (const [, grid] of GRIDS) holds(synthetic(p, r, n), 'crowd', grid);
  });

  it.each(GRIDS)('spills a crowded orbit outward, onto more orbits of its kind, on the %s grid', (_, grid) => {
    const layout = holds(synthetic(10, 150, 10), 'crowd', grid);
    const rules = layout.orbits.map((o, i) => ({ ...o, i })).filter((o) => o.kind === 'rule');
    expect(rules.length).toBeGreaterThan(1);
    const principles = layout.orbits.filter((o) => o.kind === 'principle');
    for (const o of rules) for (const p of principles) expect(o.ry).toBeGreaterThan(p.ry);
    // The orbits of a kind are next to one another.
    expect(rules.map((o) => o.i)).toEqual(rules.map((_, k) => sure(rules[0], 'rules[0]').i + k));
  });

  it.each(GRIDS)('shrinks the worlds of a crowded system, never below the smallest size, on the %s grid', (_, grid) => {
    const { max, min } = SYSTEM_LINES[grid.name].world;
    const few = sure(layoutSystem(synthetic(3, 2, 1), 'crowd', grid).worlds[0], 'layoutSystem(synthetic(3, 2, 1), "crowd", grid).worlds[0]').r;
    const many = sure(layoutSystem(synthetic(100, 150, 50), 'crowd', grid).worlds[0], 'layoutSystem(synthetic(100, 150, 50), "crowd", grid).worlds[0]').r;
    expect(few).toBe(max);
    expect(many).toBeLessThan(few);
    expect(many).toBeGreaterThanOrEqual(min);
  });

  it('keeps an empty kind\'s orbit, and an empty system three empty orbits', () => {
    const layout = holds(synthetic(2, 3, 0), 'crowd', WIDE);
    expect(layout.orbits.find((o) => o.kind === 'invariant')?.count).toBe(0);
    const empty = layoutSystem(synthetic(0, 0, 0), 'crowd', TALL);
    expect(empty.worlds).toEqual([]);
    expect(empty.orbits.map((o) => o.kind)).toEqual(KINDS);
  });

  it('holds still: the same graph gives the same layout', () => {
    expect(layoutSystem(REPO, 'product', WIDE)).toEqual(layoutSystem(REPO, 'product', WIDE));
  });
});

describe('the D-pad on a system', () => {
  const layouts = GRIDS.flatMap(([name, grid]) => [
    [`this repository on the ${name} grid`, layoutSystem(REPO, 'product', grid)],
    [`150 entries on the ${name} grid`, layoutSystem(synthetic(40, 90, 20), 'crowd', grid)],
  ] as [string, SystemLayout][]);

  it.each(layouts)('walks an orbit with ◀ ▶ and wraps round it: %s', (_, layout) => {
    for (let orbit = 0; orbit < layout.orbits.length; orbit++) {
      const ring = layout.worlds.filter((w) => w.orbit === orbit);
      if (!ring.length) continue;
      let at = sure(ring[0], 'ring[0]').index;
      const seen: number[] = [];
      for (let i = 0; i < ring.length; i++) { seen.push(at); at = orbitStep(layout, at, 'right'); }
      expect(at).toBe(sure(ring[0], 'ring[0]').index);
      expect(seen).toEqual(ring.map((w) => w.index));
      expect(orbitStep(layout, sure(ring[0], 'ring[0]').index, 'left')).toBe(sure(ring[ring.length - 1], 'ring[ring.length - 1]').index);
    }
  });

  it.each(layouts)('moves ▲ in and ▼ out to the world nearest in angle on the next orbit: %s', (_, layout) => {
    const apart = (a: number, b: number) => { const d = Math.abs(a - b) % (2 * Math.PI); return Math.min(d, 2 * Math.PI - d); };
    for (const w of layout.worlds) {
      for (const [dir, step] of [['up', -1], ['down', 1]] as const) {
        let orbit = w.orbit + step;
        while (orbit >= 0 && orbit < layout.orbits.length && !sure(layout.orbits[orbit], 'layout.orbits[orbit]').count) orbit += step;
        const next = orbitStep(layout, w.index, dir);
        if (orbit < 0 || orbit >= layout.orbits.length) { expect(next).toBe(w.index); continue; }
        const to = layout.worlds[next];
        assertDefined(to, 'to');
        expect(to.orbit).toBe(orbit);
        const best = Math.min(...layout.worlds.filter((x) => x.orbit === orbit).map((x) => apart(x.angle, w.angle)));
        expect(apart(to.angle, w.angle)).toBeCloseTo(best, 9);
      }
    }
  });

  it.each(layouts)('reaches every world from any world: %s', (_, layout) => {
    for (const w of layout.worlds) {
      expect(reachable((from, dir) => orbitStep(layout, from, dir), w.index).size, w.entry.id).toBe(layout.worlds.length);
    }
  });

  it.each(layouts)('finds each world under a tap on it: %s', (_, layout) => {
    for (const w of layout.worlds) expect(worldAt(layout, { x: w.x, y: w.y })?.entry.id).toBe(w.entry.id);
    expect(worldAt(layout, { x: layout.cx, y: layout.cy })).toBeNull();
  });
});

/** A graph of `n` domains, the product first, each holding `n - i` principles, and a lane between each two neighbours. */
function domains(n: number): KnowledgeGraph {
  const names = ['product', ...Array.from({ length: n - 1 }, (_, i) => `d${String(i + 1).padStart(2, '0')}`)];
  const parts = names.map((name, i) => synthetic(n - i, i % 3, 1, name));
  const lanes = names.slice(1, -1).map((a, i) => entry(`X-${a}-${names[i + 2]}-1`.toUpperCase(), 'rule', a, { domain: null, domains: [a, sure(names[i + 2], 'names[i + 2]')] }));
  return {
    version: 1, repo: 'acme/widgets',
    domains: parts.map((p, i) => ({ ...sure(p.domains[0], 'p.domains[0]'), scope: i === 0 ? 'product' : 'domain' })),
    entries: [...parts.flatMap((p) => p.entries), ...lanes],
    links: [], loose: [], unserved: [],
  };
}

function sunsOutside(layout: ChartLayout, grid: Grid): string[] {
  const { band } = CHART_LINES[grid.name];
  return layout.suns.filter((s) => s.x - s.r < band.x || s.x + s.r > band.x + band.w || s.y - s.r < band.y || s.y + s.r > band.y + band.h).map((s) => s.name);
}

describe('the chart: a sun per domain', () => {
  it.each(GRIDS)('puts this repository\'s one domain in the middle of the %s grid, at the largest size', (_, grid) => {
    const layout = layoutChart(REPO, grid);
    const { band, label, sun } = CHART_LINES[grid.name];
    expect(layout.suns).toHaveLength(1);
    expect(sure(layout.suns[0], 'layout.suns[0]').name).toBe('product');
    expect(sure(layout.suns[0], 'layout.suns[0]').x).toBe(Math.round(band.x + band.w / 2));
    expect(sure(layout.suns[0], 'layout.suns[0]').y).toBe(Math.round(band.y + band.h / 2 - label / 2));
    expect(sure(layout.suns[0], 'layout.suns[0]').r).toBe(sun.max);
    expect(sunsOutside(layout, grid)).toEqual([]);
  });

  it.each([2, 3, 7, 12])('lays %d domains out inside the band, apart, sized by what they hold, every sun in reach of the D-pad', (n) => {
    for (const [, grid] of GRIDS) {
      const graph = domains(n);
      const layout = layoutChart(graph, grid);
      expect(layout.suns.map((s) => s.name)).toEqual(graph.domains.map((d) => d.name));
      expect(sunsOutside(layout, grid)).toEqual([]);
      layout.suns.forEach((a, i) => { layout.suns.slice(i + 1).forEach((b) => {
        expect(Math.hypot(a.x - b.x, a.y - b.y), `${a.name} and ${b.name}`).toBeGreaterThan(a.r + b.r);
      }); });
      // Each name runs under its sun, inside the band and clear of the names beside it.
      for (const s of layout.suns) {
        expect(s.label).toBeGreaterThan(0);
        expect(s.x - s.label / 2).toBeGreaterThanOrEqual(CHART_LINES[grid.name].band.x);
        expect(s.x + s.label / 2).toBeLessThanOrEqual(CHART_LINES[grid.name].band.x + CHART_LINES[grid.name].band.w);
      }
      layout.suns.forEach((a, i) => { layout.suns.slice(i + 1).forEach((b) => {
        if (Math.abs(a.y - b.y) < CHART_LINES[grid.name].band.h / 4) {
          expect(Math.abs(a.x - b.x), `${a.name} and ${b.name}'s names`).toBeGreaterThanOrEqual((a.label + b.label) / 2);
        }
      }); });
      const bySize = [...layout.suns].sort((a, b) => a.system.size - b.system.size);
      bySize.forEach((s, i) => { if (i) expect(s.r).toBeGreaterThanOrEqual(sure(bySize[i - 1], 'bySize[i - 1]').r); });
      for (const s of layout.suns) {
        expect(reachable((from, dir) => chartStep(layout, from, dir), s.index).size, s.name).toBe(n);
        expect(sunAt(layout, { x: s.x, y: s.y })?.name).toBe(s.name);
      }
    }
  });

  it('draws a lane for each cross-domain pair, between their two suns, with its entry count', () => {
    const layout = layoutChart(domains(4), WIDE);
    expect(layout.lanes).toEqual([
      { from: 1, to: 2, count: 1 },
      { from: 2, to: 3, count: 1 },
    ]);
  });

  it('burns the product gold, and each domain the same colour on every load', () => {
    const layout = layoutChart(domains(5), WIDE);
    expect(sure(layout.suns[0], 'layout.suns[0]').seed % 4).toBe(0);
    for (const s of layout.suns.slice(1)) expect(s.seed % 4).not.toBe(0);
    expect(layoutChart(domains(5), WIDE)).toEqual(layout);
  });

  it('charts nothing for an empty graph', () => {
    expect(layoutChart({ ...REPO, domains: [], entries: [], links: [] }, WIDE)).toEqual({ suns: [], lanes: [] });
  });
});

describe('the pad on the star chart', () => {
  const graph = domains(3);
  const chart = layoutChart(graph, WIDE);
  const system = layoutSystem(graph, 'product', WIDE);
  const at = { chart, system, pages: () => 3 };
  const cursor = (over: Partial<ChartCursor> = {}): ChartCursor => ({ scene: 'chart', sun: 0, world: 0, card: false, cardPage: 0, ...over });

  it('enters a sun\'s system with A or START, and goes back to the menu with B', () => {
    for (const a of ['a', 'start'] as const) expect(chartKey(cursor(), a, at)).toEqual({ patch: { scene: 'system', card: false }, sound: 'select' });
    expect(chartKey(cursor(), 'b', at)).toEqual({ patch: { scene: 'menu' }, sound: 'back' });
  });

  it('moves between suns with the D-pad and SELECT, back to the first world of the sun it reaches', () => {
    const right = chartKey(cursor(), 'right', at);
    expect(right?.patch).toEqual({ sun: chartStep(chart, 0, 'right'), world: 0 });
    expect(chartKey(cursor({ sun: 2 }), 'select', at)?.patch).toEqual({ sun: 0, world: 0 });
  });

  it('opens the reading card with A, pages it with ▲ ▼ inside its pages, and closes it with B', () => {
    const inSystem = cursor({ scene: 'system' });
    expect(chartKey(inSystem, 'a', at)).toEqual({ patch: { card: true, cardPage: 0 }, sound: 'select' });
    const card = cursor({ scene: 'system', card: true });
    expect(chartKey(card, 'down', at)).toEqual({ patch: { cardPage: 1 }, sound: 'tab' });
    expect(chartKey({ ...card, cardPage: 2 }, 'down', at)).toBeNull();
    expect(chartKey(card, 'up', at)).toBeNull();
    expect(chartKey({ ...card, cardPage: 2 }, 'up', at)?.patch).toEqual({ cardPage: 1 });
    expect(chartKey(card, 'left', at)).toBeNull(); // the orbit waits under the card
    expect(chartKey(card, 'b', at)).toEqual({ patch: { card: false }, sound: 'back' });
  });

  it('goes back B by B: the card, then the chart, then the menu', () => {
    let cur = cursor({ scene: 'system', card: true, cardPage: 1 });
    const scenes: string[] = [];
    for (let i = 0; i < 3; i++) {
      const move = sure(chartKey(cur, 'b', at), 'chartKey(cur, "b", at)');
      scenes.push(move.patch.scene ?? (move.patch.card === false ? 'card closed' : '?'));
      if (move.patch.scene === 'menu') break;
      cur = { ...cur, ...move.patch } as ChartCursor;
    }
    expect(scenes).toEqual(['card closed', 'chart', 'menu']);
  });

  it('walks a system\'s worlds with the D-pad and SELECT', () => {
    const inSystem = cursor({ scene: 'system' });
    expect(chartKey(inSystem, 'right', at)?.patch).toEqual({ world: orbitStep(system, 0, 'right') });
    expect(chartKey(inSystem, 'select', at)?.patch).toEqual({ world: 1 % system.worlds.length });
  });

  it('does nothing but go back on an empty chart or an empty system', () => {
    const empty = { chart: { suns: [], lanes: [] }, system: layoutSystem(graph, 'nowhere', WIDE), pages: () => 1 };
    expect(chartKey(cursor(), 'a', empty)).toBeNull();
    expect(chartKey(cursor(), 'right', empty)).toBeNull();
    expect(chartKey(cursor({ scene: 'system' }), 'a', empty)).toBeNull();
    expect(chartKey(cursor({ scene: 'system' }), 'b', empty)?.patch.scene).toBe('chart');
  });
});

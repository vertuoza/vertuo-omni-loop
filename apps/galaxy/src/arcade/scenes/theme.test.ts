import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildGalaxy, demoEvents, DEMO_PROJECTS, lookOf } from '@omni/galaxy';
import { setFleets } from '../fleets';
import { markFor } from '../mark';
import { DEFAULT_THEME, resolveTheme, stripesOf, TOKENS, type Theme, type Token } from '../theme';
import type { FleetRow } from '../types';
import { TALL, WIDE, type FrameState, type Grid, type SceneName } from './common.ts';
import { drawFrame, layoutMap } from './index.ts';

// The canvas in a workspace's theme: every sprite drawn, with the options it was drawn with, and
// every colour the arcade's own code fills with (the sprite package's planets, stars and nebulae are
// its own, and stubbed out here).
const sprites = vi.hoisted(() => [] as { name: string; flat?: unknown; glow?: string | null }[]);
vi.mock('@omni/design', async (original) => {
  const m = await original<typeof import('@omni/design')>();
  return {
    ...m,
    drawSprite: (_ctx: unknown, name: string, _x: number, _y: number, o: { flat?: unknown; glow?: string | null } = {}) => {
      sprites.push({ name, flat: o.flat, glow: o.glow });
    },
    drawPlanet: () => {},
    drawStarfield: () => {},
    makeNebula: () => ({}),
  };
});

/** A 2D context that keeps every colour it is given: fills, and the stops of its gradients. */
function recorder(colours: Set<string>) {
  const state: Record<string | symbol, unknown> = {};
  const ctx = new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'createLinearGradient') return () => ({ addColorStop: (_: number, c: string) => colours.add(c) });
      return () => {};
    },
    set(target, prop, value) {
      if (prop === 'fillStyle' && typeof value === 'string') colours.add(value);
      target[prop] = value;
      return true;
    },
  });
  return ctx as unknown as CanvasRenderingContext2D;
}

const now = new Date('2026-09-25T10:00:00Z');
const view = buildGalaxy(demoEvents(now), { projects: DEMO_PROJECTS, now, source: 'demo' });
const fleets: FleetRow[] = Object.entries(DEMO_PROJECTS.teams)
  .map(([name, t]) => ({ name, ...lookOf(name, t) }))
  .sort((a, b) => a.sort - b.sort);
const SCENES: SceneName[] = [
  'boot', 'title', 'menu', 'map', 'planet', 'fleets', 'heroes', 'briefing', 'coin', 'away', 'gate', 'intro',
  'select', 'name', 'hero', 'ready', 'welcome', 'outsider',
];

/** A theme that overrides every token, each with a colour no default has: #1000xx. */
const EVERY: Theme = resolveTheme(Object.fromEntries(
  (Object.keys(TOKENS) as Token[]).map((t, i) => [t, `#1000${i.toString(16).padStart(2, '0')}`]),
));

function frame(scene: SceneName, grid: Grid, theme: Theme, sceneT: number): FrameState {
  // The planet shown is the one in distress, so its pulse is drawn.
  const sel = Math.max(0, view.planets.findIndex((p) => p.state === 'distress'));
  return {
    scene, grid, page: 0, view, layout: layoutMap(view, grid), sel, fleetSel: 0, t: 5.3, sceneT, reduced: false,
    mark: markFor('Vertuoza', theme), theme,
    join: { fleets, pick: 1, lockedAt: null, team: fleets[1]!.name, away: false, hero: { v: 1, body: 'girl', skin: 1, hair: 0, suit: 0, cape: 1 } },
  };
}

/** Every scene, on both grids, in every title phase and at the intro's beats, in one theme. */
function drawEverything(theme: Theme) {
  const colours = new Set<string>();
  sprites.length = 0;
  for (const grid of [WIDE, TALL]) {
    for (const scene of SCENES) {
      for (const sceneT of scene === 'intro' ? [1, 6, 15] : [0.5, 2]) {
        for (const phase of scene === 'title' ? (['title', 'story', 'hiscore'] as const) : (['title'] as const)) {
          drawFrame(recorder(colours), frame(scene, grid, theme, sceneT), phase);
        }
      }
    }
    drawFrame(recorder(colours), { ...frame('coin', grid, theme, 2), join: { ...frame('coin', grid, theme, 2).join, away: true } }, 'title');
  }
  return { colours, sprites: [...sprites] };
}

describe('the canvas in a workspace\'s theme', () => {
  beforeAll(() => { setFleets(fleets); });
  afterAll(() => { setFleets([]); });

  it('draws every sprite in the theme\'s stripes', () => {
    for (const theme of [DEFAULT_THEME, EVERY]) {
      const drawn = drawEverything(theme).sprites;
      expect(drawn.length).toBeGreaterThan(0);
      for (const s of drawn) expect(s.flat, s.name).toEqual(stripesOf(theme));
    }
    expect(stripesOf(EVERY)).toEqual({ 1: EVERY['stripe-1'], 2: EVERY['stripe-2'], 3: EVERY['stripe-3'], 4: EVERY['stripe-4'] });
  });

  it('draws with the theme\'s colours: the void, the plasma, the cyan, the red, the yellow and the mark', () => {
    const { colours, sprites: drawn } = drawEverything(EVERY);
    const drawnWith = (t: Token) => colours.has(EVERY[t]) || drawn.some((s) => s.glow === EVERY[t]);
    for (const t of ['void', 'plasma', 'plasma-dark', 'cyan', 'red', 'yellow', 'mark-1', 'mark-2', 'mark-3', 'mark-shade-1', 'mark-shade-2', 'mark-shade-3'] as const) {
      expect(drawnWith(t), t).toBe(true);
    }
    // OmniMan glows in the theme's plasma, never in today's.
    const omni = drawn.filter((s) => s.name === 'omni');
    expect(omni.length).toBeGreaterThan(0);
    for (const s of omni) expect(s.glow).toBe(EVERY.plasma);
  });

  it('draws today\'s colours with the theme {}', () => {
    const { colours, sprites: drawn } = drawEverything(DEFAULT_THEME);
    for (const t of ['void', 'plasma', 'plasma-dark', 'cyan', 'red', 'yellow', 'mark-1', 'mark-3', 'mark-shade-1'] as const) {
      expect(colours.has(TOKENS[t]) || drawn.some((s) => s.glow === TOKENS[t]), t).toBe(true);
    }
    expect([...colours].filter((c) => c.startsWith('#1000'))).toEqual([]);
  });
});

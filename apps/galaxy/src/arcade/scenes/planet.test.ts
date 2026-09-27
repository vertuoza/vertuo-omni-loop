import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildGalaxy, demoEvents, DEMO_PROJECTS, lookOf, type Planet } from '@omni/galaxy';
import { gridFor } from '../grid';
import { setFleets } from '../fleets';
import { HOUSE_BRAND } from '../brand';
import { Press } from '../hint';
import { markFor } from '../mark';
import { ScreenContext } from '../Screen';
import { DEFAULT_THEME } from '../theme';
import type { DossiersRead, FleetRow, PlanetDossier } from '../types';
import { TALL, WIDE, type FrameState, type Grid } from './common.ts';
import { drawPlanetScene, planetStage, TALL_BAND, TALL_SCENES } from './planet.ts';
import { DOSSIER_TAB, dossierLink, dossierOf, PLANET_TABS, PlanetOverlay, type DossierShown } from './planet.tsx';

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

// ── The DOSSIER tab (PRD 216) ────────────────────────────────────────────────

/** The text a screen shows, one run of text per entry, as a player reads it on `grid` in `form`. */
function textOf(el: ReactElement, grid: Grid, form: 'full' | 'handheld' = 'full'): string[] {
  return htmlOf(el, grid, form)
    .replace(/<!-- -->/g, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"')
    .split('\n').map((t) => t.trim()).filter(Boolean);
}

function htmlOf(el: ReactElement, grid: Grid, form: 'full' | 'handheld' = 'full'): string {
  const screen = createElement(ScreenContext.Provider, { value: { form, grid, page: 0, pages: 1 } }, el);
  return renderToStaticMarkup(createElement(Press.Provider, { value: () => {} }, screen));
}

const ISO = (day: number, hour = 10) => `2026-09-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00Z`;

const DOSSIER: PlanetDossier = {
  id: 'd-2410', url: '/prd/d-2410',
  latest: { 'before-after': { version: 1, at: ISO(22) }, spec: { version: 2, at: ISO(24) }, plan: null },
  asked: 4, answered: 3,
  last: [
    { question: 'Where does a client\'s Peppol ID live?', answer: 'On the client\'s company record', more: 1, at: ISO(24) },
    { question: 'Should a failed delivery fall back to email?', answer: 'Yes, after two retries', more: 0, at: ISO(23) },
    { question: 'Which Peppol access point should send the invoices?', answer: 'Storecove', more: 0, at: ISO(22) },
  ],
};

describe('the planet\'s tabs', () => {
  const p = view.planets.find((x) => x.state === 'distress')!;
  const tabs = (grid: Grid) => {
    const html = htmlOf(createElement(PlanetOverlay, { view, planet: p, tab: 0, onTab: () => {}, dossier: 'none' }), grid);
    return [...html.matchAll(/role="tab"[^>]*>([^<]+)</g)].map((m) => m[1].replace(/ \d+$/, ''));
  };

  it('read STATUS · ZONES · ENTROPY · LOG · DOSSIER, on the wide grid and the tall one', () => {
    expect(PLANET_TABS).toEqual(['STATUS', 'ZONES', 'ENTROPY', 'LOG', 'DOSSIER']);
    expect(DOSSIER_TAB).toBe(4);
    expect(tabs(WIDE)).toEqual([...PLANET_TABS]);
    expect(tabs(TALL)).toEqual([...PLANET_TABS]);
  });
});

describe('the DOSSIER tab', () => {
  beforeAll(() => { setFleets(fleets); });
  const p = view.planets.find((x) => x.state === 'distress')!;
  const shown = (dossier: DossierShown, grid: Grid, tab = DOSSIER_TAB, form: 'full' | 'handheld' = 'full') =>
    textOf(createElement(PlanetOverlay, { view, planet: p, tab, onTab: () => {}, dossier }), grid, form);
  const body = (text: string[]) => text.slice(text.indexOf('DOSSIER') + 1, text.lastIndexOf('◀ ▶ TABS · ▲ ▼ NEXT PLANET · B MAP'));

  it('shows each artifact\'s latest version and date, and says so for one with none yet', () => {
    const text = body(shown(DOSSIER, WIDE));
    expect(text.slice(0, 6)).toEqual(['BEFORE/AFTER', 'V1 · 22 SEP', 'SPEC', 'V2 · 24 SEP', 'PLAN', 'NONE YET']);
  });

  it('counts the rounds asked and answered', () => {
    expect(body(shown(DOSSIER, WIDE))).toContain('4 ASKED · 3 ANSWERED');
  });

  it('lists the last three answered, newest first, each question with its answer, and how many more the round held', () => {
    const text = body(shown(DOSSIER, WIDE));
    const from = text.indexOf('LAST ANSWERS');
    expect(from).toBeGreaterThan(0);
    expect(text.slice(from + 1, from + 8)).toEqual([
      'Where does a client\'s Peppol ID live?', 'On the client\'s company record', '+1',
      'Should a failed delivery fall back to email?', 'Yes, after two retries',
      'Which Peppol access point should send the invoices?', 'Storecove',
    ]);
  });

  it('keeps each answered question to one line: the question and its answer cut, never wrapped', () => {
    const html = htmlOf(createElement(PlanetOverlay, { view, planet: p, tab: DOSSIER_TAB, onTab: () => {}, dossier: DOSSIER }), WIDE);
    expect(html.match(/<li class="dossier-answer"/g)).toHaveLength(3);
  });

  it('says so when no round is answered yet', () => {
    expect(body(shown({ ...DOSSIER, asked: 1, answered: 0, last: [] }, WIDE))).toContain('NO ANSWER YET');
  });

  it('offers [START] OPEN, a key and a tap, when the dossier has a page to open', () => {
    const text = body(shown(DOSSIER, WIDE));
    expect(text.slice(-2)).toEqual(['START', 'OPEN']);
    const html = htmlOf(createElement(PlanetOverlay, { view, planet: p, tab: DOSSIER_TAB, onTab: () => {}, dossier: DOSSIER }), WIDE);
    expect(html).toMatch(/<button type="button" class="j-hit"><span class="j-key"[^>]*>START<\/span>OPEN<\/button>/);
    // On the Game Boy the pad's START reads START too.
    expect(body(shown(DOSSIER, TALL, DOSSIER_TAB, 'handheld')).slice(-2)).toEqual(['START', 'OPEN']);
  });

  it('shows no OPEN hint in a build with no page to open (the single-file artifact)', () => {
    const text = body(shown({ ...DOSSIER, url: null }, WIDE));
    expect(text).not.toContain('OPEN');
    expect(text).toContain('4 ASKED · 3 ANSWERED');
  });

  it('says NO DOSSIER YET for a planet without one', () => {
    expect(body(shown('none', WIDE))[0]).toMatch(/^NO DOSSIER YET/);
  });

  it('says DOSSIERS OUT OF REACH when the read failed, and leaves the rest of the planet unchanged', () => {
    expect(body(shown('unreadable', WIDE))).toEqual(['DOSSIERS OUT OF REACH']);
    for (const tab of [0, 1, 2, 3]) {
      for (const grid of [WIDE, TALL]) expect(shown('unreadable', grid, tab), `tab ${tab} on ${grid.name}`).toEqual(shown(DOSSIER, grid, tab));
    }
  });

  it('shows the same rows on the tall grid as on the wide one: a tall layout drops nothing', () => {
    for (const d of [DOSSIER, { ...DOSSIER, url: null }, { ...DOSSIER, last: [] }, 'none', 'unreadable'] as DossierShown[]) {
      expect(shown(d, TALL)).toEqual(shown(d, WIDE));
    }
  });
});

describe('dossierOf', () => {
  const read: DossiersRead = { 2410: DOSSIER, 2332: 'unreadable' };

  it('gives a planet its dossier, none when it has none, and out of reach when it or every dossier could not be read', () => {
    expect(dossierOf(read, 2410)).toBe(DOSSIER);
    expect(dossierOf(read, 2332)).toBe('unreadable');
    expect(dossierOf(read, 985)).toBe('none');
    expect(dossierOf('unreadable', 2410)).toBe('unreadable');
    expect(dossierOf(undefined, 2410)).toBe('none');
  });
});

describe('dossierLink', () => {
  const read: DossiersRead = { 2410: DOSSIER, 2332: 'unreadable', 2520: { ...DOSSIER, id: 'd-2520', url: null } };

  it('gives START the page of the planet\'s dossier on the DOSSIER tab only', () => {
    expect(dossierLink(read, 2410, DOSSIER_TAB)).toBe('/prd/d-2410');
    for (const tab of [0, 1, 2, 3]) expect(dossierLink(read, 2410, tab)).toBeNull();
  });

  it('gives none for a planet with no dossier, one out of reach, or one with no page to open', () => {
    expect(dossierLink(read, 985, DOSSIER_TAB)).toBeNull();
    expect(dossierLink(read, 2332, DOSSIER_TAB)).toBeNull();
    expect(dossierLink(read, 2520, DOSSIER_TAB)).toBeNull();
    expect(dossierLink('unreadable', 2410, DOSSIER_TAB)).toBeNull();
  });
});

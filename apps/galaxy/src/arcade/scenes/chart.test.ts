import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildGalaxy, demoEvents, DEMO_PROJECTS, lookOf } from '@omni/galaxy';
import type { KnowledgeEntry, KnowledgeGraph } from '../../data/knowledge';
import { HOUSE_BRAND } from '../brand';
import { setFleets } from '../fleets';
import { gridFor, TALL, WIDE, type Grid } from '../grid';
import { markFor } from '../mark';
import { ScreenContext } from '../Screen';
import { DEFAULT_THEME, resolveTheme } from '../theme';
import type { FleetRow } from '../types';
import { layoutChart, layoutSystem, type ChartSource } from './chart-layout.ts';
import { kindColor, kindCss, TALL_SCENES, WARM_PER_FRAME, worldSeed } from './chart.ts';
import { CARD_FIT, cardPages, ChartOverlay, servesLine, SystemOverlay, wrap } from './chart.tsx';
import type { FrameState } from './common.ts';
import { drawFrame, layoutMap } from './index.ts';

const entry = (id: string, kind: KnowledgeEntry['kind'], domain: string | null, over: Partial<KnowledgeEntry> = {}): KnowledgeEntry => ({
  id, kind, domain, domains: domain ? [domain] : [], statement: `${id} holds.`, why: null, status: 'proposed', serves: null,
  enforced: false, enforcedBy: null, prd: null, file: `.omni-loop/knowledge/${domain ?? 'cross-domain'}/x.md`, ...over,
});

const LONG = 'A slice that stops early says which law it would break and why, and its siblings finish their own work before the wave is merged into the feature branch, one pull request at a time, each checked against the branch as it stands then.';

const GRAPH: KnowledgeGraph = {
  version: 1,
  repo: 'acme/widgets',
  domains: [
    { name: 'product', code: 'PRODUCT', scope: 'product', counts: { principles: 2, rules: 2, invariants: 1, laws: 1, proposed: 4 } },
    { name: 'quote', code: 'QUOTE', scope: 'domain', counts: { principles: 1, rules: 0, invariants: 0, laws: 0, proposed: 1 } },
  ],
  entries: [
    entry('P-PRODUCT-1', 'principle', 'product', { status: 'law', statement: 'Every change is reviewed by a person.', why: 'Nobody merges alone.', prd: 3 }),
    entry('P-PRODUCT-2', 'principle', 'product', { statement: LONG, why: `${LONG} It says so in P-PRODUCT-1.`, prd: 7 }),
    entry('BR-PRODUCT-1', 'rule', 'product', { serves: 'P-PRODUCT-1', statement: 'One approval, from outside the team.', prd: 3, enforcedBy: 'unenforced' }),
    entry('BR-PRODUCT-2', 'rule', 'product', { serves: 'P-PRODUCT-1', enforced: true, enforcedBy: 'kit/lib/gate.mjs' }),
    entry('N-PRODUCT-1', 'invariant', 'product', { serves: 'P-PRODUCT-9', statement: 'The ledger is append-only.' }),
    entry('P-QUOTE-1', 'principle', 'quote'),
    entry('X-PRODUCT-QUOTE-1', 'rule', null, { domains: ['product', 'quote'] }),
  ],
  links: [
    { from: 'BR-PRODUCT-1', to: 'P-PRODUCT-1', kind: 'serves' },
    { from: 'BR-PRODUCT-2', to: 'P-PRODUCT-1', kind: 'serves' },
    { from: 'P-PRODUCT-2', to: 'P-PRODUCT-1', kind: 'cites' },
  ],
  loose: ['N-PRODUCT-1', 'X-PRODUCT-QUOTE-1'],
  unserved: ['P-PRODUCT-2', 'P-QUOTE-1'],
};
const byId = (id: string) => GRAPH.entries.find((e) => e.id === id)!;

/** The text a screen shows, one run of text per entry, as a player reads it on `grid`. */
function textOf(el: ReactElement, grid: Grid): string[] {
  const html = renderToStaticMarkup(createElement(ScreenContext.Provider, { value: { form: 'handheld', grid, page: 0, pages: 1 } }, el));
  return html
    .replace(/<!-- -->/g, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"')
    .split('\n').map((s) => s.trim()).filter(Boolean);
}

describe('the star chart on the tall grid', () => {
  it('lists chart and system as tall, so the Game Boy held upright draws them on 320×288', () => {
    expect([...TALL_SCENES].sort()).toEqual(['chart', 'system']);
    for (const scene of ['chart', 'system'] as const) {
      expect(gridFor('handheld', scene)).toBe(TALL);
      expect(gridFor('full', scene)).toBe(WIDE);
      expect(gridFor('advance', scene)).toBe(WIDE);
    }
  });
});

// ── The canvas ───────────────────────────────────────────────────────────────

// A 2D context that keeps where each image lands (a sun, a world, the nebula) and counts the fills.
function recorder() {
  const images: { x: number; y: number; w: number; h: number }[] = [];
  const drawn = { fills: 0 };
  const ctx = new Proxy<Record<string | symbol, unknown>>({}, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'createImageData') return (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });
      if (prop === 'createLinearGradient') return () => ({ addColorStop() {} });
      if (prop === 'fillRect') return () => { drawn.fills++; };
      if (prop === 'drawImage') {
        return (img: { width: number; height: number }, x: number, y: number, w?: number, h?: number) => { images.push({ x, y, w: w ?? img.width, h: h ?? img.height }); };
      }
      return () => {};
    },
    set(target, prop, value) { target[prop] = value; return true; },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, images, drawn };
}

class FakeOffscreenCanvas {
  width: number;
  height: number;
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }
  getContext() { return recorder().ctx; }
}

const now = new Date('2026-09-25T10:00:00Z');
const view = buildGalaxy(demoEvents(now), { projects: DEMO_PROJECTS, now, source: 'demo' });
const fleets: FleetRow[] = Object.entries(DEMO_PROJECTS.teams).map(([name, t]) => ({ name, ...lookOf(name, t) })).sort((a, b) => a.sort - b.sort);

function frame(scene: 'chart' | 'system', grid: Grid, source: ChartSource = GRAPH, world = 0): FrameState {
  const graph = source && source !== 'none' ? source : null;
  const layout = graph ? layoutChart(graph, grid) : { suns: [], lanes: [] };
  return {
    scene, grid, page: 0, view, layout: layoutMap(view, grid), sel: 0, fleetSel: 0, t: 5, sceneT: 2, reduced: false,
    mark: markFor(HOUSE_BRAND.name), theme: DEFAULT_THEME,
    join: { fleets, pick: 0, lockedAt: null, team: null, away: false, hero: { v: 1, body: 'girl', skin: 1, hair: 0, suit: 0, cape: 1 } },
    chart: { source, layout, system: graph ? layoutSystem(graph, 'product', grid) : null, sun: 0, world },
  };
}

describe('the star chart\'s colours', () => {
  it('follow the workspace\'s theme: principles its yellow, rules its cyan', () => {
    const theme = resolveTheme({ yellow: '#000001', cyan: '#000002' });
    expect(kindColor('principle', theme)).toBe('#000001');
    expect(kindColor('rule', theme)).toBe('#000002');
    expect(kindColor('principle', DEFAULT_THEME)).toBe(DEFAULT_THEME.yellow);
    expect(kindCss('principle')).toBe('var(--yellow)');
    expect(kindCss('rule')).toBe('var(--cyan)');
  });
});

describe('the star chart on the canvas', () => {
  beforeAll(() => { vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas); setFleets(fleets); });
  afterAll(() => { vi.unstubAllGlobals(); });

  const inside = (images: { x: number; y: number; w: number; h: number }[], grid: Grid) => images.every((i) => i.x < grid.w && i.y < grid.h && i.x + i.w > 0 && i.y + i.h > 0);

  it.each([['wide', WIDE], ['tall', TALL]] as const)('draws the chart on the %s grid: a sun for each domain, on the screen', (_, grid) => {
    const { ctx, images, drawn } = recorder();
    drawFrame(ctx, frame('chart', grid), 'title');
    expect(drawn.fills).toBeGreaterThan(0);
    expect(images.length).toBe(1 + GRAPH.domains.length); // the nebula, then the suns
    expect(inside(images, grid)).toBe(true);
  });

  it.each([['wide', WIDE], ['tall', TALL]] as const)('draws a system on the %s grid: its sun and every world, on the screen', (_, grid) => {
    const { ctx, images } = recorder();
    drawFrame(ctx, frame('system', grid), 'title');
    expect(images.length).toBe(1 + GRAPH.entries.filter((e) => e.domain === 'product').length); // the sun, then the worlds
    expect(inside(images, grid)).toBe(true);
  });

  it.each([['out of reach', null], ['in a build without it', 'none']] as const)('draws bare space %s', (_, source) => {
    for (const scene of ['chart', 'system'] as const) {
      const { ctx, images, drawn } = recorder();
      drawFrame(ctx, frame(scene, WIDE, source), 'title');
      expect(drawn.fills).toBeGreaterThan(0);
      expect(images.length).toBeLessThanOrEqual(1); // the nebula at most: no sun, no world
    }
  });

  it('builds a large system\'s worlds a few a frame, and draws every one once they are built', () => {
    const crowd: KnowledgeGraph = {
      ...GRAPH,
      entries: Array.from({ length: 40 }, (_, i) => entry(`BR-CROWD-${i + 1}`, 'rule', 'product')),
    };
    const at = (t: number): FrameState => ({ ...frame('system', WIDE, crowd), t });
    const first = recorder();
    drawFrame(first.ctx, at(1), 'title');
    expect(first.images.length).toBe(1 + WARM_PER_FRAME); // the sun, and the first worlds built
    for (let i = 0; i < 40; i++) drawFrame(recorder().ctx, at(1 + i / 60), 'title');
    const later = recorder();
    drawFrame(later.ctx, at(3), 'title');
    expect(later.images.length).toBe(1 + 40);
  });

  it('seeds each world by its id', () => {
    expect(worldSeed('BR-PRODUCT-1')).toBe(worldSeed('BR-PRODUCT-1'));
    expect(worldSeed('BR-PRODUCT-1')).not.toBe(worldSeed('BR-PRODUCT-2'));
  });
});

// ── The text layers ──────────────────────────────────────────────────────────

describe('the chart\'s text', () => {
  it.each([['wide', WIDE], ['tall', TALL]] as const)('names the chart, each sun, each lane and the selected system on the %s grid', (_, grid) => {
    const text = textOf(createElement(ChartOverlay, { source: GRAPH, layout: layoutChart(GRAPH, grid), sun: 0, onEnter: () => {} }), grid);
    expect(text).toContain('STAR CHART · ACME/WIDGETS');
    expect(text).toContain('2 SYSTEMS · 7 WORLDS');
    for (const name of ['PRODUCT', 'QUOTE']) expect(text.filter((t) => t === name).length).toBeGreaterThanOrEqual(1);
    expect(text).toContain('5 WORLDS');
    expect(text).toContain('1'); // the lane's count
    expect(text).toContain('2 PRINCIPLES');
    expect(text).toContain('A · ENTER');
    expect(text).toContain('READ IT AT /KNOWLEDGE');
  });

  it('says the chart is out of reach, with no entry in it', () => {
    const text = textOf(createElement(ChartOverlay, { source: null, layout: { suns: [], lanes: [] }, sun: 0, onEnter: () => {} }), WIDE);
    expect(text).toContain('THE STAR CHART IS OUT OF REACH');
    expect(text.join(' ')).not.toMatch(/P-PRODUCT|holds/);
  });

  it('says a build without a star chart has none', () => {
    const text = textOf(createElement(ChartOverlay, { source: 'none', layout: { suns: [], lanes: [] }, sun: 0, onEnter: () => {} }), TALL);
    expect(text).toContain('NO STAR CHART IN THIS BUILD');
  });

  it('says so when the knowledge base holds no domain', () => {
    const empty = { ...GRAPH, domains: [], entries: [], links: [] };
    const text = textOf(createElement(ChartOverlay, { source: empty, layout: layoutChart(empty, WIDE), sun: 0, onEnter: () => {} }), WIDE);
    expect(text).toContain('0 SYSTEMS · 0 WORLDS');
    expect(text.some((t) => t.startsWith('NO SYSTEMS CHARTED YET'))).toBe(true);
  });
});

describe('the system\'s text', () => {
  const panel = (id: string, grid: Grid, card = false, cardPage = 0) => {
    const layout = layoutSystem(GRAPH, 'product', grid);
    const world = layout.worlds.findIndex((w) => w.entry.id === id);
    return textOf(createElement(SystemOverlay, { graph: GRAPH, layout, world, card, cardPage, onRead: () => {}, onPage: () => {} }), grid);
  };

  it.each([['wide', WIDE], ['tall', TALL]] as const)('shows the selected world in the panel on the %s grid: id, kind, status, statement, what it serves', (_, grid) => {
    const rule = panel('BR-PRODUCT-1', grid);
    expect(rule).toEqual(expect.arrayContaining(['PRODUCT SYSTEM', 'BR-PRODUCT-1', 'RULE', 'PROPOSED', 'One approval, from outside the team.', 'SERVES P-PRODUCT-1', 'A · READ']));
    const principle = panel('P-PRODUCT-1', grid);
    expect(principle).toEqual(expect.arrayContaining(['P-PRODUCT-1', 'PRINCIPLE', 'LAW', 'SERVED BY 2']));
  });

  it('says what an entry serves, or what serves it', () => {
    expect(servesLine(GRAPH, byId('BR-PRODUCT-1'))).toBe('SERVES P-PRODUCT-1');
    expect(servesLine(GRAPH, byId('N-PRODUCT-1'))).toBe('SERVES NO PRINCIPLE');
    expect(servesLine(GRAPH, byId('P-PRODUCT-1'))).toBe('SERVED BY 2');
    expect(servesLine(GRAPH, byId('P-PRODUCT-2'))).toBe('SERVED BY NONE');
  });

  it.each([['wide', WIDE], ['tall', TALL]] as const)('opens the reading card with the whole entry on the %s grid', (_, grid) => {
    const text = panel('BR-PRODUCT-2', grid, true).join(' ');
    for (const part of ['SERVES', 'P-PRODUCT-1: Every change is reviewed by a person.', 'ENFORCED BY', 'kit/lib/gate.mjs', 'FROM', 'No PRD named.', 'CLOSE']) {
      expect(text).toContain(part);
    }
    const principle = panel('P-PRODUCT-1', grid, true).join(' ');
    for (const part of ['WHY', 'Nobody merges alone.', 'SERVED BY 2', 'BR-PRODUCT-1, BR-PRODUCT-2', 'PRD #3']) expect(principle).toContain(part);
    const unenforced = panel('BR-PRODUCT-1', grid, true).join(' ');
    expect(unenforced).toContain('PRD #3');
    expect(unenforced).not.toContain('ENFORCED BY');
  });

  it.each([['wide', WIDE], ['tall', TALL]] as const)('pages a long entry on the %s grid: every word on one page, a page never past its lines', (_, grid) => {
    const e = byId('P-PRODUCT-2');
    const pages = cardPages(GRAPH, e, grid.name);
    expect(pages.length).toBeGreaterThan(1);
    const { chars, lines } = CARD_FIT[grid.name];
    for (const page of pages) {
      expect(page.length).toBeLessThanOrEqual(lines);
      expect(page[page.length - 1]!.tone === 'label' && page !== pages[pages.length - 1]).toBe(false);
      for (const line of page) if (line.tone === 'text') expect(line.text.length).toBeLessThanOrEqual(chars);
    }
    const all = pages.flat().map((l) => l.text).join(' ');
    for (const word of `${e.statement} ${e.why}`.split(/\s+/)) expect(all).toContain(word);
    expect(all).toContain('CITES');
    expect(all).toContain('PRD #7');
    // Each page shows on the card, with where it is.
    pages.forEach((page, i) => {
      const text = panel('P-PRODUCT-2', grid, true, i);
      expect(text).toContain(`PAGE ${i + 1}/${pages.length}`);
      for (const line of page) expect(text).toContain(line.text);
    });
  });

  it('shows a short entry on one page, with no page count', () => {
    expect(cardPages(GRAPH, byId('BR-PRODUCT-1'), 'tall')).toHaveLength(1);
    expect(panel('BR-PRODUCT-1', TALL, true).some((t) => t.startsWith('PAGE'))).toBe(false);
  });

  it('says so when a system holds no world', () => {
    const layout = layoutSystem(GRAPH, 'nowhere', WIDE);
    const text = textOf(createElement(SystemOverlay, { graph: GRAPH, layout, world: 0, card: false, cardPage: 0, onRead: () => {}, onPage: () => {} }), WIDE);
    expect(text).toContain('NO WORLDS IN THIS SYSTEM YET.');
  });
});

describe('wrap', () => {
  it('breaks between words, and cuts a word longer than a line', () => {
    expect(wrap('one two three four', 9)).toEqual(['one two', 'three', 'four']);
    expect(wrap('abcdefghijkl mn', 5)).toEqual(['abcde', 'fghij', 'kl mn']);
    expect(wrap('  ', 5)).toEqual([]);
  });
});

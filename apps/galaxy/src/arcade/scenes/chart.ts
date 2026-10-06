// The star chart on the canvas (PRD 149): the knowledge base as space. `chart` draws a sun per domain
// with the dotted lanes of their cross-domain files; `system` draws one domain as an orrery, its
// entries as worlds on still orbits (principles inside, rules in the middle, invariants outside),
// laws terraformed and proposed entries barren, and the selected world's links. Where everything
// sits is chart-layout.ts; the labels, the panel and the reading card are the text layer, chart.tsx.
import { defined } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { drawPlanet, drawSun } from '@omni/design';
import { servedBy, serving, type EntryKind, type KnowledgeGraph } from '../../data/knowledge';
import { sunSeed, type WorldSlot } from './chart-layout.ts';
import { nebulaFor, space, type FrameState, type Pages, type SceneName } from './common.ts';
import { brackets } from './map.ts';
import type { Theme, Token } from '../theme';

/** Both scenes are laid out on the tall grid too: the Game Boy held upright draws them on 320×288 (grid.ts reads this list). */
export const TALL_SCENES: readonly SceneName[] = ['chart', 'system'];
/** One page each: the reading card turns its own pages. */
export const PAGES: Pages = {};

/** Each kind's colour: its orbits on the canvas, its name in the text layer. A kind coloured by a
 * theme token (`token`) takes the workspace's colour; `color` is the one no token names. */
export const KIND_LOOK: Record<EntryKind, { token: Token | null; color: string | null; label: string; plural: string }> = {
  principle: { token: 'yellow', color: null, label: 'PRINCIPLE', plural: 'PRINCIPLES' },
  rule: { token: 'cyan', color: null, label: 'RULE', plural: 'RULES' },
  invariant: { token: null, color: '#ff8fd0', label: 'INVARIANT', plural: 'INVARIANTS' },
};

/** A kind's colour on the canvas, in the frame's theme. */
export const kindColor = (kind: EntryKind, theme: Theme) => {
  const { token, color } = KIND_LOOK[kind];
  return token ? theme[token] : defined(color, `the ${kind} colour`);
};

/** A kind's colour in the text layer: the custom property the theme writes on the arcade's root. */
export const kindCss = (kind: EntryKind) => {
  const { token, color } = KIND_LOOK[kind];
  return token ? `var(--${token})` : defined(color, `the ${kind} colour`);
};

/** The graph a frame shows, if it has one: out of reach and a build without a chart draw bare space. */
export function graphOf(s: FrameState): KnowledgeGraph | null {
  const source = s.chart?.source;
  return source && source !== 'none' ? source : null;
}

/** An entry's seed, from its id: the same continents on every load. */
export function worldSeed(id: string): number {
  let h = 2166136261;
  for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** A world as the galaxy map's planet renderer draws it: a law terraformed, a proposed entry barren. */
export function worldLook(w: WorldSlot, theme: Theme) {
  const law = w.entry.status === 'law';
  return { seed: worldSeed(w.entry.id), progress: law ? 1 : 0, mood: 'alive' as const, atmosphere: law ? theme.cyan : '#7a64b8' };
}

/** A dotted line from (ax, ay) to (bx, by), `skipA` and `skipB` pixels clear of its two ends, its dots marching. */
function dotted(ctx: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, o: { skipA: number; skipB: number; every: number; size: number; color: string; shade: string; t: number }) {
  const dx = bx - ax, dy = by - ay;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;
  const off = Math.floor(o.t * 12) % o.every;
  for (let d = o.skipA + off; d < len - o.skipB; d += o.every) {
    const x = Math.round(ax + (dx * d) / len), y = Math.round(ay + (dy * d) / len);
    ctx.fillStyle = o.shade;
    ctx.fillRect(x, y + 1, o.size, o.size);
    ctx.fillStyle = o.color;
    ctx.fillRect(x, y, o.size, o.size);
  }
}

// ── chart ────────────────────────────────────────────────────────────────────

export function drawChart(ctx: CanvasRenderingContext2D, s: FrameState) {
  space(ctx, s, 0.1);
  const { w, h } = s.grid;
  ctx.drawImage(nebulaFor(`chart-${s.grid.name}`, 1, Math.round(w * 0.9), Math.round(h * 0.8)), Math.round(w * 0.05), Math.round(h * 0.06));
  if (!graphOf(s) || !s.chart) return;
  const { suns, lanes } = s.chart.layout;
  const t = s.reduced ? 0 : s.t;
  // Lanes first: a cross-domain file between two suns.
  for (const lane of lanes) {
    const a = defined(suns[lane.from], "a lane's first sun"), b = defined(suns[lane.to], "a lane's second sun");
    dotted(ctx, a.x, a.y, b.x, b.y, { skipA: a.r * 1.4 + 3, skipB: b.r * 1.4 + 3, every: 7, size: 2, color: '#a88cff', shade: '#2a1f5c', t });
  }
  for (const sun of suns) drawSun(ctx, { cx: sun.x, cy: sun.y, r: sun.r, seed: sun.seed, t });
  const cur = suns[s.chart.sun];
  if (cur) brackets(ctx, cur.x, cur.y, Math.round(cur.r * 1.25), s.t, s.theme.yellow);
}

// ── system ───────────────────────────────────────────────────────────────────

/** An orbit: a still, dotted ellipse in its kind's colour. */
function orbitLine(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, color: string) {
  const perimeter = 2 * Math.PI * Math.sqrt((rx * rx + ry * ry) / 2);
  const dots = Math.max(24, Math.round(perimeter / 4));
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.45;
  for (let i = 0; i < dots; i++) {
    const a = (i / dots) * Math.PI * 2;
    ctx.fillRect(Math.round(cx + rx * Math.sin(a)), Math.round(cy - ry * Math.cos(a)), 1, 1);
  }
  ctx.globalAlpha = 1;
}

/**
 * A world's first drawing builds its planet's texture, a few milliseconds each: at most
 * `WARM_PER_FRAME` worlds are built a frame, the rest wait as dim discs, so a large system opens at
 * once and fills in over a few frames instead of freezing its first one.
 */
export const WARM_PER_FRAME = 6;
const warmed = new Set<number>();

function disc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color;
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.round(Math.sqrt(r * r - dy * dy));
    ctx.fillRect(Math.round(x) - half, Math.round(y) + dy, half * 2, 1);
  }
}

export function drawSystem(ctx: CanvasRenderingContext2D, s: FrameState) {
  space(ctx, s, 0.05);
  const graph = graphOf(s);
  const layout = s.chart?.system;
  if (!graph || !layout || !s.chart) return;
  const t = s.reduced ? 0 : s.t;
  const system = s.chart.layout.suns[s.chart.sun]?.system;
  for (const o of layout.orbits) orbitLine(ctx, layout.cx, layout.cy, o.rx, o.ry, kindColor(o.kind, s.theme));
  drawSun(ctx, { cx: layout.cx, cy: layout.cy, r: layout.sun, seed: system ? sunSeed(system) : 0, t });
  // The selected world's links: to the principle it serves, and from every entry that serves it.
  const cur = layout.worlds[s.chart.world];
  if (cur) {
    const at = new Map(layout.worlds.map((w) => [w.entry.id, w]));
    const up = serving(graph, cur.entry.id);
    const to = up ? at.get(up.id) : undefined;
    if (to) dotted(ctx, cur.x, cur.y, to.x, to.y, { skipA: cur.r + 2, skipB: to.r + 2, every: 4, size: 2, color: kindColor('principle', s.theme), shade: '#6b2a00', t });
    for (const e of servedBy(graph, cur.entry.id)) {
      const from = at.get(e.id);
      if (from) dotted(ctx, from.x, from.y, cur.x, cur.y, { skipA: from.r + 2, skipB: cur.r + 2, every: 4, size: 1, color: kindColor(e.kind, s.theme), shade: '#0b0a26', t });
    }
  }
  let budget = WARM_PER_FRAME;
  for (const w of layout.worlds) {
    const look = worldLook(w, s.theme);
    if (!warmed.has(look.seed)) {
      if (budget <= 0) { disc(ctx, w.x, w.y, w.r, '#2a1f5c'); continue; }
      budget--;
      warmed.add(look.seed);
    }
    const rot = s.reduced ? look.seed % 7 : s.t * 0.15 + (look.seed % 7);
    drawPlanet(ctx, { cx: w.x, cy: w.y, r: w.r, rot, ...look });
  }
  if (cur) brackets(ctx, Math.round(cur.x), Math.round(cur.y), cur.r, s.t, s.theme.yellow);
}

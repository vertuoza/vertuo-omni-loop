// The attract group on the canvas: the boot, the title's three phases (title, story, high scores)
// and the Hall of Heroes, on the wide grid (640×360) and on the tall one (320×288).
import { drawLogo, drawPlanet, logoPixels, spriteSize, WOUND_TINT, woundTint } from '@omni/design';
import { fleet, MASCOTS } from '../fleets';
import { keysOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { bootMark, frameOf, H, nebulaFor, plasmaTrail, RING, space, sprite, TALL, W, type FrameState, type Grid, type Pages, type SceneName } from './common.ts';

/**
 * The attract group's scenes laid out on the tall grid (`boot`, `title`, `heroes`). A scene not
 * listed is drawn on the wide grid, letterboxed in the Game Boy's lens (grid.ts reads this list).
 */
export const TALL_SCENES: readonly SceneName[] = ['boot', 'title', 'heroes'];

// ── The Hall of Heroes' pages ────────────────────────────────────────────────

/** The Hall of Heroes shows the season's top eight; the tall grid shows them four to a page. */
export const HALL_ROWS = 8;
export const HALL_ROWS_TALL = 4;

/** How many pages the Hall of Heroes takes on `grid`, for `count` heroes: one on the wide grid. */
export function hallPages(count: number, grid: Grid): number {
  if (grid.name !== 'tall') return 1;
  return Math.max(1, Math.ceil(Math.min(count, HALL_ROWS) / HALL_ROWS_TALL));
}

/** The rows of the Hall of Heroes on `page` of `grid`: every row the wide table shows is on one tall page. */
export function hallPage<T>(heroes: readonly T[], grid: Grid, page: number): T[] {
  const rows = heroes.slice(0, HALL_ROWS);
  if (grid.name !== 'tall') return rows;
  const at = Math.min(Math.max(0, page), hallPages(heroes.length, grid) - 1);
  return rows.slice(at * HALL_ROWS_TALL, (at + 1) * HALL_ROWS_TALL);
}

/** How many pages a tall `heroes` takes, for ◀ ▶ to turn. Undeclared, it is one. */
export const PAGES: Pages = { heroes: ({ view, grid }) => hallPages(view.heroes.length, grid) };

// ── The scenes ───────────────────────────────────────────────────────────────

/** How far the boot's mark moves on the tall grid: centred across it, and 26 px higher than on the wide one. */
const BOOT_TALL = { dx: (TALL.w - W) / 2, dy: -26 };

/** The crest's mark on the boot: 4×, the V's 72 pixels tall, from where the V's top was. */
const BOOT_CREST = { scale: 4, y: 96, reveal: 0.9 };

// The house brand's boot: the crest's mark on black, wiped in from the left in the V's time.
function bootCrest(ctx: CanvasRenderingContext2D, s: FrameState) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  const { scale, y, reveal } = BOOT_CREST;
  const { w } = logoPixels('mark');
  drawLogo(ctx, 'mark', W / 2 - (w * scale) / 2, y, { scale, reveal: s.reduced ? 1 : Math.min(1, s.sceneT / reveal) });
}

export function drawBoot(ctx: CanvasRenderingContext2D, s: FrameState) {
  // The house brand draws the crest's mark; a workspace's brand its letter.
  const draw = s.logo ? bootCrest : bootMark;
  if (s.grid.name !== 'tall') { draw(ctx, s); return; }
  // The mark is drawn for the wide grid: moved onto the tall one, its black still reaches every edge.
  ctx.save();
  ctx.translate(BOOT_TALL.dx, BOOT_TALL.dy);
  draw(ctx, s);
  ctx.restore();
}

/** Where the title's scenery goes on each grid: the nebulae, the two planets, the commander and the fleets. */
interface TitleLayout {
  nebulae: readonly [x: number, y: number][]; // 'title' (400×240), then 'title2' (320×200)
  world: { cx: number; cy: number; r: number };
  ringed: { cx: number; cy: number; r: number };
  omni: { x: number; y: number; scale: number };
  trail: { x: number; y: number; len: number };
  // Each fleet's spot: x, y (its top on a 32 px mascot), its beat and its phase.
  spots: readonly (readonly [x: number, y: number, rate: number, phase: number])[];
  fleetScale: number;
}

const TITLE: Record<Grid['name'], TitleLayout> = {
  wide: {
    nebulae: [[300, 0], [-80, 80]],
    world: { cx: 40, cy: 440, r: 176 },
    ringed: { cx: 584, cy: 52, r: 30 },
    omni: { x: 288, y: 120, scale: 2 },
    trail: { x: 310, y: 214, len: 30 },
    spots: [[104, 124, 2, 0.3], [176, 208, 1.2, 0.5], [396, 212, 1.8, 0.1], [456, 116, 2.2, 0.7], [520, 206, 3, 0.2]],
    fleetScale: 2,
  },
  // The words take the top (the logo, the tagline) and the bottom (the call, the footer): the
  // commander flies in the middle, two fleets on the left and three on the right.
  tall: {
    nebulae: [[40, 30], [-150, 96]],
    world: { cx: 6, cy: 322, r: 104 },
    ringed: { cx: 290, cy: 196, r: 16 },
    omni: { x: 128, y: 78, scale: 2 },
    trail: { x: 150, y: 172, len: 14 },
    spots: [[22, 92, 2, 0.3], [62, 152, 1.2, 0.5], [206, 150, 1.8, 0.1], [232, 90, 2.2, 0.7], [270, 132, 3, 0.2]],
    fleetScale: 1,
  },
};

export function drawTitle(ctx: CanvasRenderingContext2D, s: FrameState) {
  const at = TITLE[s.grid.name];
  space(ctx, s, 3);
  ctx.drawImage(nebulaFor('title', 0, 400, 240), ...at.nebulae[0]!);
  ctx.drawImage(nebulaFor('title2', 2, 320, 200), ...at.nebulae[1]!);
  const rot = s.reduced ? 0.6 : s.t * 0.02;
  drawPlanet(ctx, { ...at.world, seed: 2332, rot, progress: 0.62, atmosphere: '#8fd8ff' });
  drawPlanet(ctx, { ...at.ringed, seed: 985, rot: rot * 3, progress: 0, ring: RING, atmosphere: '#7a64b8' });
  const bob = (phase: number, amp = 4) => (s.reduced ? 0 : Math.round(Math.sin(s.t * 2 + phase) * amp));
  plasmaTrail(ctx, s, at.trail.x, at.trail.y + bob(0), at.trail.len);
  sprite(ctx, s, 'omni', at.omni.x, at.omni.y + bob(0), { scale: at.omni.scale, frame: frameOf(s, 1.5), glow: s.theme.plasma });
  // The fleets fly in formation around the commander: the first five active ones. With none (signed
  // out, or a workspace with no fleets yet), the mascot parade flies instead (PRD 400).
  const flying = s.join.fleets.length
    ? s.join.fleets.map((f) => fleet(f.name))
    : MASCOTS.map((m) => ({ sprite: m, tint: null }));
  flying.slice(0, at.spots.length).forEach((look, i) => {
    const [x, y, rate, phase] = at.spots[i]!;
    const k = at.fleetScale;
    sprite(ctx, s, look.sprite, x, y + bob(i + 1) - (spriteSize(look.sprite).h - 32) * k, { scale: k, tint: look.tint ?? undefined, flip: i === 4, frame: frameOf(s, rate, phase) });
  });
}

/** Where the story's planet hangs on each grid. */
const STORY_PLANET: Record<Grid['name'], { cx: number; cy: number; r: number }> = {
  wide: { cx: 572, cy: 80, r: 44 },
  tall: { cx: 282, cy: 24, r: 24 },
};

export function drawStory(ctx: CanvasRenderingContext2D, s: FrameState) {
  const { w, h } = s.grid;
  space(ctx, s, 1);
  // Entropy marches across the bottom of the screen, 80 px apart, one more than the screen holds.
  const kinds = keysOf(WOUND_TINT);
  const lap = w + 80;
  for (let i = 0; i < lap / 80; i++) {
    const x = ((i * 80 - s.sceneT * 36) % lap + lap) % lap - 40;
    const y = h - 64 + (s.reduced ? 0 : Math.round(Math.sin(s.t * 3 + i) * 3));
    sprite(ctx, s, 'entropy', x, y, { tint: woundTint(kinds[i % kinds.length]!), frame: frameOf(s, 3, i * 0.5) });
  }
  drawPlanet(ctx, { ...STORY_PLANET[s.grid.name], seed: 2410, rot: s.t * 0.06, progress: 0.15, atmosphere: '#7a64b8' });
}

/** The Hall of Heroes' nebula, the same one on both grids: behind the table's middle. */
const HEROES_NEBULA: Record<Grid['name'], [x: number, y: number]> = { wide: [80, 20], tall: [-80, -16] };

export function drawHeroes(ctx: CanvasRenderingContext2D, s: FrameState) {
  space(ctx, s, 0.8);
  ctx.drawImage(nebulaFor('heroes', 2, 480, 320), ...HEROES_NEBULA[s.grid.name]);
}

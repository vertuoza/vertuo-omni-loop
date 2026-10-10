// Draws each game's still for its lit cabinet's screen (still.ts) from the game's own pieces, and
// checks stills.ts holds them as they are drawn now: OMNI KART's race over its circuit, rendered by
// its Mode 7 floor with its rivals, boxes, props and arch, and a slice of Super Omni World's stage 1-1
// in its tiles. The player's own kart and hero are not in a still: the cabinet draws them over it.
// After a game's art changes, `npx vitest run apps/galaxy/src/arcade/games/stills.test.ts -u` draws
// them again.
import { describe, expect, it } from 'vitest';
import { drawStarfield, fleetSprite, makeStarfield, spritePixels, STAGE_PALETTES, TILES, type Pixels, type SpriteLook } from '@omni/design';
import { at } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { DEFAULT_THEME, stripesOf } from '../theme';
import type { GridName } from '../grid';
import { ARCH_WORLD, BOX_WORLD, DRIVER_ROWS, DRIVER_W, HAZE, KART_W, KART_WORLD, PROP_ART, SEAT, SHADOW } from '../kart/art';
import { chaseCamera, project, renderFloor, viewOf, type Projected, type View } from '../kart/mode7';
import { newRace } from '../kart/race';
import { BEYOND, paintTrack } from '../kart/texture';
import { parseTrack } from '../kart/track';
import { enemyTint, SKY, tileFrame } from '../platformer/art';
import { STAGES } from '../platformer/stages';
import { LETTERS, letterWidth, stillPixels, type Still, type Stills } from './still';
import { sure } from '../test/sure';

/** The inside of a lit cabinet's screen on each grid, in grid pixels (games.css: `.cab-screen` less its border). */
const SCREEN: Readonly<Record<GridName, { w: number; h: number }>> = { wide: { w: 156, h: 62 }, tall: { w: 196, h: 46 } };

// ── A still being drawn: a colour per pixel, row after row ────────────────────

interface Canvas { w: number; h: number; px: string[] }

const blank = (w: number, h: number, colour: string): Canvas => ({ w, h, px: Array.from({ length: w * h }, () => colour) });

/** A colour's red, green, blue and alpha (0 to 1): `#rrggbb`, `#rrggbbaa` or `rgba(r, g, b, a)`. */
function rgbaOf(colour: string): [number, number, number, number] {
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})?$/i.exec(colour);
  if (hex) return [1, 2, 3].map((i) => Number.parseInt(sure(hex[i], 'a channel'), 16)).concat(hex[4] ? Number.parseInt(hex[4], 16) / 255 : 1) as [number, number, number, number];
  const fn = /^rgba\((\d+), *(\d+), *(\d+), *([\d.]+)\)$/.exec(colour);
  if (fn) return [1, 2, 3, 4].map((i) => Number(sure(fn[i], 'a channel'))) as [number, number, number, number];
  throw new Error(`a colour the still cannot read: ${colour}`);
}
const hexOf = (rgb: readonly number[]) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/** Paints `colour` on the pixel at x, y, over what is there by the colour's alpha (and `alpha`). */
function paint(c: Canvas, x: number, y: number, colour: string, alpha = 1) {
  if (x < 0 || y < 0 || x >= c.w || y >= c.h) return;
  const [r, g, b, a] = rgbaOf(colour);
  const k = a * alpha;
  if (k <= 0) return;
  const under = rgbaOf(at(c.px, y * c.w + x, 'a pixel'));
  c.px[y * c.w + x] = hexOf([r, g, b].map((v, i) => v * k + at(under, i, 'a channel') * (1 - k)));
}

/** Fills the rectangle at x, y, `w`×`h`: the pixels whose centres it covers, above row `clip`. */
function fill(c: Canvas, x: number, y: number, w: number, h: number, colour: string, { alpha = 1, clip = c.h } = {}) {
  for (let py = Math.round(y); py < Math.min(Math.round(y + h), clip); py++) {
    for (let px = Math.round(x); px < Math.round(x + w); px++) paint(c, px, py, colour, alpha);
  }
}

/** Draws a sprite's top `rows` at x, y, `sx` (and `sy`) grid pixels per sprite pixel, as a canvas draws it unsmoothed. */
function blit(c: Canvas, s: Pixels, x: number, y: number, sx: number, { sy = sx, rows = s.h } = {}) {
  for (let py = Math.round(y); py < Math.round(y + rows * sy); py++) {
    for (let px = Math.round(x); px < Math.round(x + s.w * sx); px++) {
      const u = Math.floor((px + 0.5 - x) / sx), v = Math.floor((py + 0.5 - y) / sy);
      if (u < 0 || v < 0 || u >= s.w || v >= rows) continue;
      const colour = s.pixels[v * s.w + u];
      if (colour) paint(c, px, py, colour);
    }
  }
}

/** A disc of radius `r` centred at cx, cy: the pixels whose centres it covers. */
function disc(c: Canvas, cx: number, cy: number, r: number, colour: string, alpha = 1, keep: (px: number, py: number) => boolean = () => true) {
  for (let py = Math.floor(cy - r); py <= Math.ceil(cy + r); py++) {
    for (let px = Math.floor(cx - r); px <= Math.ceil(cx + r); px++) {
      if ((px + 0.5 - cx) ** 2 + (py + 0.5 - cy) ** 2 <= r * r && keep(px, py)) paint(c, px, py, colour, alpha);
    }
  }
}

// ── OMNI KART: the race, mid-lap on the straight into the line ────────────────

const SEED = 1359;
const theme = DEFAULT_THEME;
const flat = stripesOf(theme);
const track = parseTrack();
const texture = paintTrack(track);
const kartArt = (name: string, look: SpriteLook = {}) => spritePixels(name, { ...look, flat });

/** The leg of the racing line the still is on, how far into it the player is, and where the pack is ahead of them (along it, and to its side). */
const LEG = 13;
const ME_AT = 24;
const PACK: readonly (readonly [number, number])[] = [[100, -8], [135, 7], [175, -3], [230, 5]];

/** A planet in the sky, drawn flat: its body, its atmosphere's rim, a light on it and its night side. */
function planet(c: Canvas, cx: number, cy: number, r: number, body: string, atmosphere: string) {
  disc(c, cx, cy, r + 1, atmosphere, 0.35);
  disc(c, cx, cy, r, body);
  disc(c, cx - r * 0.3, cy - r * 0.3, r * 0.45, '#ffffff', 0.12);
  disc(c, cx, cy, r, theme.void, 0.35, (_, py) => py + 0.5 > cy);
}

/** A shadow on the floor, as the race draws one under every kart: three rows, the middle one `w` wide. */
function shadow(c: Canvas, cx: number, cy: number, w: number) {
  const row = Math.max(1, Math.round(w * 0.07));
  for (const [i, share] of [[-1, 0.7], [0, 1], [1, 0.7]] as const) {
    const rw = Math.round(w * share);
    fill(c, Math.round(cx - rw / 2), Math.round(cy + i * row), rw, row, SHADOW);
  }
}

function race({ w, h }: { w: number; h: number }): Canvas {
  const a = at(track.waypoints, LEG, 'a waypoint'), b = at(track.waypoints, (LEG + 1) % track.waypoints.length, 'a waypoint');
  const len = Math.hypot(b.x - a.x, b.y - a.y), fx = (b.x - a.x) / len, fy = (b.y - a.y) / len;
  const along = (d: number, side: number) => ({ x: a.x + fx * d - fy * side, y: a.y + fy * d + fx * side });
  const me = along(ME_AT, 0);
  const v: View = viewOf({ w, h }, chaseCamera({ x: me.x, y: me.y, angle: Math.atan2(fy, fx) }));
  const sky = v.horizon;
  const c = blank(w, h, theme.void);

  // The sky: its bands, its stars, two planets and the station, and the haze where it meets the floor.
  const bands = [theme.void, '#0a0824', '#0d0a2c', '#110c34'];
  bands.forEach((colour, i) => { fill(c, 0, Math.floor((sky / bands.length) * i), w, Math.ceil(sky / bands.length), colour); });
  const sink = {
    fillStyle: '' as CanvasRenderingContext2D['fillStyle'],
    fillRect(x: number, y: number, fw: number, fh: number) {
      if (typeof sink.fillStyle !== 'string') throw new Error('a star painted with a gradient');
      fill(c, x, y, fw, fh, sink.fillStyle, { clip: Math.floor(sky) });
    },
  };
  drawStarfield(sink, makeStarfield(SEED, w, sky - 2, Math.round((w * sky) / 120)), 0, { w, h: sky });
  planet(c, w * 0.76, sky - 6, Math.round(sky * 0.4), '#3a6fd8', theme.cyan);
  planet(c, w * 0.19, sky * 0.33, Math.round(sky * 0.15), '#c9a24a', theme.gold);
  blit(c, kartArt('sky-station'), Math.round(w * 0.45), 3, 0.35);
  fill(c, 0, sky - HAZE, w, HAZE, theme['plasma-dark'], { alpha: 0.45 });

  // The floor, by the race's own Mode 7.
  const floor = new Uint32Array(w * h);
  renderFloor(v, texture, floor, BEYOND);
  for (let y = Math.floor(sky) + 1; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = sure(floor[y * w + x], 'a floor pixel');
      c.px[y * w + x] = hexOf([p & 0xff, (p >> 8) & 0xff, (p >> 16) & 0xff]);
    }
  }

  // What stands on the floor, the farthest first.
  const things: { z: number; draw: () => void }[] = [];
  const stand = (x: number, y: number, draw: (on: Projected) => void) => {
    const on = project(v, x, y);
    if (on) things.push({ z: on.z, draw: () => { draw(on); } });
  };
  for (const box of track.boxes) {
    stand(box.x, box.y, (on) => {
      const art = kartArt('item-box'), scale = (BOX_WORLD * on.scale) / art.w;
      if (art.w * scale >= 2) blit(c, art, on.sx - (art.w * scale) / 2, on.sy - art.h * scale - art.h * scale * 0.1, scale);
    });
  }
  for (const prop of track.props) {
    stand(prop.x, prop.y, (on) => {
      const art = kartArt(PROP_ART[prop.kind].sprite), scale = (PROP_ART[prop.kind].world * on.scale) / art.w;
      if (art.w * scale >= 2) blit(c, art, on.sx - (art.w * scale) / 2, on.sy - art.h * scale, scale);
    });
  }
  track.arch.forEach((leg, i) => {
    stand(leg.x, leg.y, (on) => {
      const art = kartArt('arch-leg'), scale = (ARCH_WORLD * on.scale) / art.w;
      if (art.w * scale < 1) return;
      const top = on.sy - art.h * scale;
      const other = at(track.arch, 1 - i, 'the other leg');
      const beyond = i === 0 ? project(v, other.x, other.y) : null;
      if (beyond) {
        const beam = kartArt('arch-beam');
        const left = Math.min(on.sx, beyond.sx), right = Math.max(on.sx, beyond.sx);
        const y = Math.min(top, beyond.sy - art.h * ((ARCH_WORLD * beyond.scale) / art.w));
        blit(c, beam, left, y, Math.max(0, right - left) / beam.w, { sy: Math.max(1, beam.h * scale) / beam.h });
      }
      blit(c, art, on.sx - (art.w * scale) / 2, top, scale);
    });
  });
  newRace({ seed: SEED, track }).rivals.slice(0, PACK.length).forEach((rival, i) => {
    const [d, side] = at(PACK, i, 'a place in the pack');
    const p = along(d, side);
    stand(p.x, p.y, (on) => {
      const scale = (KART_WORLD * on.scale) / KART_W;
      if (scale < 0.15) return;
      const x = on.sx - (KART_W * scale) / 2, y = on.sy - 18 * scale, half = scale / 2;
      shadow(c, on.sx, on.sy - 2 * scale, KART_W * scale * 1.05);
      blit(c, kartArt(rival.driver.sprite, { tint: rival.driver.tint }), Math.round(x + (KART_W * scale - DRIVER_W * half) / 2), Math.round(y + SEAT * scale - DRIVER_ROWS * half), half, { rows: DRIVER_ROWS });
      blit(c, kartArt('kart', { tint: fleetSprite(null, rival.driver.color).tint }), Math.round(x), Math.round(y), scale);
    });
  });
  for (const t of things.sort((p, q) => q.z - p.z)) t.draw();
  return c;
}

// ── Super Omni World: a slice of stage 1-1, its ground on the screen's bottom edge ─

/** The tile's side in the slice, in grid pixels (half the game's), and the stage's first column in it. */
const TILE = 8;
const COL0 = 14;

function stage({ w, h }: { w: number; h: number }): Canvas {
  const st = at(STAGES, 0, 'stage 1-1');
  const rows = Math.ceil(h / TILE), cols = Math.ceil(w / TILE), row0 = st.tiles.length - rows, dy = h - rows * TILE;
  const shown = ({ col, row }: { col: number; row: number }) => col >= COL0 && col < COL0 + cols && row >= row0;
  const c = blank(w, h, sure(SKY.grass, 'the grass sky'));
  const tint = STAGE_PALETTES.grass ?? null;
  for (let row = row0; row < st.tiles.length; row++) {
    for (let col = COL0; col < COL0 + cols; col++) {
      const f = tileFrame(st, row, col);
      if (f >= 0) blit(c, spritePixels(at(TILES, f, 'a tile'), { tint }), (col - COL0) * TILE, dy + (row - row0) * TILE, TILE / 16);
    }
  }
  for (const coin of st.coins.filter(shown)) blit(c, spritePixels('coin'), (coin.col - COL0) * TILE, dy + (coin.row - row0) * TILE, TILE / 16);
  for (const e of st.enemies.filter(shown)) blit(c, spritePixels('entropy', { tint: enemyTint('grass') }), (e.col - COL0) * TILE - 2, dy + (e.row - row0) * TILE - 4, 0.5);
  return c;
}

// ── The stills as stills.ts keeps them ────────────────────────────────────────

/** Each game's still, by its id: the games whose screen is not the Invaders formation. */
const DRAWN: Readonly<Record<string, (screen: { w: number; h: number }) => Canvas>> = { kart: race, platformer: stage };

function encode(c: Canvas): Still {
  const palette = [...new Set(c.px)];
  const place = new Map(palette.map((colour, i) => [colour, i]));
  const width = letterWidth(palette.length);
  const name = (i: number) => (width === 1 ? LETTERS.charAt(i) : LETTERS.charAt(Math.floor(i / LETTERS.length)) + LETTERS.charAt(i % LETTERS.length));
  const rows = Array.from({ length: c.h }, (_, y) => {
    let out = '';
    for (let x = 0; x < c.w;) {
      const colour = at(c.px, y * c.w + x, 'a pixel');
      let end = x + 1;
      while (end < c.w && c.px[y * c.w + end] === colour) end++;
      out += name(sure(place.get(colour), 'a colour of the palette')) + (end - x > 1 ? String(end - x) : '');
      x = end;
    }
    return out;
  });
  return { w: c.w, h: c.h, palette, rows };
}

const drawn = Object.entries(DRAWN).map(([id, draw]) => [id, { wide: draw(SCREEN.wide), tall: draw(SCREEN.tall) }] as const);
const stills = drawn.map(([id, grids]) => [id, { wide: encode(grids.wide), tall: encode(grids.tall) }] as const);

const q = (s: string) => `'${s}'`;
function sourceOf(list: readonly (readonly [string, Stills])[]): string {
  const still = (grid: GridName, s: Still) => [
    `    ${grid}: {`,
    `      w: ${s.w}, h: ${s.h},`,
    '      palette: [',
    ...Array.from({ length: Math.ceil(s.palette.length / 8) }, (_, i) => `        ${s.palette.slice(i * 8, i * 8 + 8).map(q).join(', ')},`),
    '      ],',
    '      rows: [',
    ...s.rows.map((row) => `        ${q(row)},`),
    '      ],',
    '    },',
  ];
  return [
    '// Generated by stills.test.ts from the games\' own art: do not edit it by hand. After a game\'s art',
    '// changes, `npx vitest run apps/galaxy/src/arcade/games/stills.test.ts -u` draws them again.',
    'import type { Stills } from \'./still\';',
    '',
    '/** Each game\'s still on its lit cabinet\'s screen, by the game\'s id; a game with none shows the Invaders formation. */',
    'export const STILLS: Readonly<Record<string, Stills>> = {',
    ...list.flatMap(([id, s]) => [`  ${id}: {`, ...still('wide', s.wide), ...still('tall', s.tall), '  },']),
    '};',
    '',
  ].join('\n');
}

describe('the stills on the lit cabinets\' screens', () => {
  it('draws each still the size of the inside of its screen on each grid', () => {
    for (const [, s] of stills) {
      for (const grid of ['wide', 'tall'] as const) expect([s[grid].w, s[grid].h, s[grid].rows.length]).toEqual([SCREEN[grid].w, SCREEN[grid].h, SCREEN[grid].h]);
    }
  });

  it('reads each still back pixel for pixel', () => {
    for (const [id, grids] of drawn) {
      for (const grid of ['wide', 'tall'] as const) {
        const c = grids[grid];
        const back = stillPixels(encode(c));
        const wrong = c.px.findIndex((colour, i) => hexOf([...back.subarray(i * 4, i * 4 + 3)]) !== colour || back[i * 4 + 3] !== 255);
        expect(wrong, `${id} on the ${grid} grid`).toBe(-1);
      }
    }
  });

  it('keeps them in stills.ts as they are drawn now', async () => {
    await expect(sourceOf(stills)).toMatchFileSnapshot('./stills.ts');
  });
});

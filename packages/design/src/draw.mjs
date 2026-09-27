// Canvas helpers. Everything draws at native resolution (1 unit = 1 pixel); the page scales the
// canvas up with `image-rendering: pixelated`, so every edge stays a hard pixel.
import { forge } from './forge.mjs';
import { SPRITE_DEFS } from './sprites.mjs';

const cache = new Map();
const rgbOf = new Map();
function rgb(hex) {
  let v = rgbOf.get(hex);
  if (!v) { v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)); rgbOf.set(hex, v); }
  return v;
}

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// ── Sprites ──────────────────────────────────────────────────────────────────

const forged = new Map();

// The forged pixel grid of one frame of a sprite (pure; also used by the tests). `flat` recolours
// flat colours, such as the stripes `1` to `4` (see forge.mjs).
export function spritePixels(name, { frame = 0, tint = null, flat = null } = {}) {
  const def = SPRITE_DEFS[name];
  if (!def) throw new Error(`unknown sprite ${name}`);
  const key = `${name}|${frame % 2}|${tint ? JSON.stringify(tint) : ''}|${flat ? JSON.stringify(flat) : ''}`;
  if (!forged.has(key)) forged.set(key, forge(def.w, def.h, (d) => def.draw(d, frame % 2), { tint: tint ?? {}, flat: flat ?? {}, outline: def.outline !== false }));
  return forged.get(key);
}

// A sprite frame as an image, rendered once per (name, frame, tint, flat, flip, silhouette).
export function spriteImage(name, { tint = null, flat = null, flip = false, frame = 0, silhouette = null } = {}) {
  const key = `${name}|${frame % 2}|${tint ? JSON.stringify(tint) : ''}|${flat ? JSON.stringify(flat) : ''}|${flip}|${silhouette ?? ''}`;
  if (cache.has(key)) return cache.get(key);
  const { w, h, pixels } = spritePixels(name, { frame, tint, flat });
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  pixels.forEach((hex, i) => {
    if (!hex) return;
    const x = i % w, y = Math.floor(i / w);
    const k = (y * w + (flip ? w - 1 - x : x)) * 4;
    const [r, g, b] = rgb(silhouette ?? hex);
    img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = b; img.data[k + 3] = 255;
  });
  ctx.putImageData(img, 0, 0);
  cache.set(key, c);
  return c;
}

/** `glow` draws a one-pixel halo of that colour around the silhouette (the plasma aura). */
export function drawSprite(ctx, name, x, y, { scale = 1, tint, flat, flip, alpha = 1, frame = 0, glow = null } = {}) {
  const prev = ctx.globalAlpha;
  x = Math.round(x); y = Math.round(y);
  if (glow) {
    const halo = spriteImage(name, { tint, flat, flip, frame, silhouette: glow });
    ctx.globalAlpha = alpha * 0.55;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ctx.drawImage(halo, x + dx * scale, y + dy * scale, halo.width * scale, halo.height * scale);
  }
  const img = spriteImage(name, { tint, flat, flip, frame });
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
  ctx.globalAlpha = prev;
}

// ── Poster scale ─────────────────────────────────────────────────────────────

export const POSTER_MAX_SCALE = 16;
const posters = new Map();

function posterScale(scale) {
  if (!Number.isInteger(scale) || scale < 1 || scale > POSTER_MAX_SCALE) {
    throw new Error(`poster scale must be a whole number from 1 to ${POSTER_MAX_SCALE}, not ${scale}`);
  }
  return scale;
}

/**
 * A sprite frame at poster scale (pure): every forged pixel becomes a `scale`×`scale` block, so the
 * forge's outlines stay on the pixel grid however large the art is drawn. `scale` is 1 to 16.
 * @returns {{ w: number, h: number, pixels: (string | null)[] }}
 */
export function posterPixels(name, scale, { frame = 0, tint = null, flat = null } = {}) {
  const k = posterScale(scale);
  const src = spritePixels(name, { frame, tint, flat });
  const w = src.w * k, h = src.h * k;
  const pixels = Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = Math.floor(y / k) * src.w;
    for (let x = 0; x < w; x++) pixels[y * w + x] = src.pixels[row + Math.floor(x / k)];
  }
  return { w, h, pixels };
}

/**
 * A sprite frame at poster scale as an image, `scale` times its size, drawn block by block (never
 * smoothed, whatever the context's image smoothing). Rendered once per (name, scale, frame, tint, flat, flip).
 */
export function posterImage(name, { scale, tint = null, flat = null, flip = false, frame = 0 } = {}) {
  const k = posterScale(scale);
  const key = `${name}|${k}|${frame % 2}|${tint ? JSON.stringify(tint) : ''}|${flat ? JSON.stringify(flat) : ''}|${flip}`;
  if (posters.has(key)) return posters.get(key);
  const { w, h, pixels } = spritePixels(name, { frame, tint, flat });
  const c = makeCanvas(w * k, h * k);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w * k, h * k);
  pixels.forEach((hex, i) => {
    if (!hex) return;
    const sx = i % w, sy = Math.floor(i / w);
    const x0 = (flip ? w - 1 - sx : sx) * k, y0 = sy * k;
    const [r, g, b] = rgb(hex);
    for (let y = y0; y < y0 + k; y++) for (let x = x0; x < x0 + k; x++) {
      const o = (y * w * k + x) * 4;
      img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
    }
  });
  ctx.putImageData(img, 0, 0);
  posters.set(key, c);
  return c;
}

export function spriteSize(name) {
  const def = SPRITE_DEFS[name];
  return { w: def.w, h: def.h };
}

// ── Seeded noise ─────────────────────────────────────────────────────────────

export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

function hash3(x, y, z, seed) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647 + seed * 144665) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function noise3(x, y, z, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const l = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz, seed);
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v),
    l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v),
    w,
  );
}

function fbm(x, y, z, seed, octaves = 4) {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise3(x * freq, y * freq, z * freq, seed + i * 17);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

// ── Planets ──────────────────────────────────────────────────────────────────

// ── Planets ──────────────────────────────────────────────────────────────────

const textures = new Map();

// Three seamless maps per planet: `height` shapes the land, `order` decides which ground is
// terraformed first as progress rises (so a planet greens in patches), `cloud` drifts on top.
// Bigger planets get finer maps so a texel never shows as a block.
export function planetTexture(seed, tw = 256) {
  const key = `${seed}|${tw}`;
  if (textures.has(key)) return textures.get(key);
  const th = tw / 2;
  const height = new Float32Array(tw * th);
  const order = new Float32Array(tw * th);
  const cloud = new Float32Array(tw * th);
  for (let j = 0; j < th; j++) {
    const lat = (j / (th - 1) - 0.5) * Math.PI;
    for (let i = 0; i < tw; i++) {
      const lon = (i / tw) * Math.PI * 2;
      const x = Math.cos(lat) * Math.cos(lon), y = Math.sin(lat), z = Math.cos(lat) * Math.sin(lon);
      const k = j * tw + i;
      height[k] = fbm(x * 2.4 + 5, y * 2.4 + 5, z * 2.4 + 5, seed, 5);
      order[k] = fbm(x * 1.4 + 9, y * 1.4 + 9, z * 1.4 + 9, seed + 99, 3);
      cloud[k] = fbm(x * 3 + 21, y * 5 + 21, z * 3 + 21, seed + 7, 4);
    }
  }
  // Normalise `order` to a ramp so progress p greens roughly p of the surface.
  const sorted = Float32Array.from(order).sort();
  for (let k = 0; k < order.length; k++) {
    let lo = 0, hi = sorted.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] < order[k]) lo = mid + 1; else hi = mid; }
    order[k] = lo / sorted.length;
  }
  const tex = { tw, th, height, order, cloud };
  textures.set(key, tex);
  return tex;
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

// 5 tones each, night → highlight.
export const SURFACES = Object.freeze({
  deep: ['#060c30', '#0c1a5c', '#15308f', '#1f45b8', '#2f5fd8'],
  ocean: ['#081640', '#12287a', '#1e44b0', '#2f68e0', '#4a8cff'],
  shallow: ['#0e2a50', '#1a5288', '#2a80c0', '#46b0e8', '#7ad8ff'],
  sand: ['#3a2e14', '#6b5a2a', '#a38b45', '#d6bd6a', '#f2dc8f'],
  grass: ['#0a2e1c', '#14583a', '#1d8f55', '#4ee08a', '#9cf5b8'],
  forest: ['#06200f', '#0f3d24', '#16663a', '#2a9a56', '#5cc880'],
  peak: ['#1e2420', '#3d4a3a', '#6b7a5d', '#a3b08a', '#dfe6c8'],
  ice: ['#4a5680', '#8093c4', '#b5c3ea', '#dfe7ff', '#ffffff'],
  rock: ['#0e0a22', '#1c1538', '#35285e', '#54418c', '#7a64b8'],
  crater: ['#08061a', '#140f2c', '#261d48', '#3c2e6c', '#56449a'],
  vein: ['#2a0630', '#8a1a8c', '#b02aa8', '#e04cd4', '#ff8fe8'],
  ash: ['#0a0508', '#1a0d12', '#3b1520', '#6b2230', '#a33a45'],
  ember: ['#2a0408', '#a8183a', '#d42848', '#ff3b5c', '#ffb0a0'],
  stone: ['#101018', '#202030', '#3a3a52', '#5b5b78', '#8a8aa6'],
});

const CLOUDS = Object.freeze({
  alive: ['#1c2250', '#5a64a0', '#a8b4e0', '#e8eeff', '#ffffff'],
  barren: ['#140e30', '#2e2458', '#54448a', '#7c6ab4', '#a898d8'],
  lost: ['#0a0406', '#1e1014', '#34181e', '#4a2028', '#5e2a32'],
});

const EMISSIVE = new Set(['vein', 'ember']);

function surfaceAt(h, o, lat, progress, mood) {
  if (mood === 'lost') return h > 0.6 && h < 0.63 ? 'ember' : h < 0.42 ? 'crater' : 'ash';
  if (mood === 'locked' || mood === 'ghost') return h < 0.42 ? 'crater' : 'stone';
  if (o < progress) {
    if (Math.abs(lat) > 0.8 + h * 0.12) return 'ice';
    if (h < 0.42) return 'deep';
    if (h < 0.46) return 'ocean';
    if (h < 0.475) return 'shallow';
    if (h < 0.5) return 'sand';
    if (h < 0.58) return 'grass';
    if (h < 0.66) return 'forest';
    return 'peak';
  }
  if (h > 0.56 && h < 0.578) return 'vein';
  if (h < 0.4) return 'crater';
  return 'rock';
}

// Per-radius geometry, computed once: which pixels are on the disc, their longitude, texture row,
// light and dither threshold. A frame then only looks colours up.
const geometries = new Map();
const LIGHT = (() => { const l = [-0.55, -0.5, 0.67]; const n = Math.hypot(...l); return l.map((v) => v / n); })();

function geometry(r, pad) {
  const key = `${r}|${pad}`;
  if (geometries.has(key)) return geometries.get(key);
  const size = Math.ceil(r * 2) + pad * 2;
  const o = size / 2;
  const n = size * size;
  const kind = new Uint8Array(n);   // 0 space, 1 disc, 2 atmosphere
  const lon = new Float32Array(n);
  const lat = new Float32Array(n);
  const light = new Float32Array(n);
  for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
    const k = py * size + px;
    const dx = (px + 0.5 - o) / r, dy = (py + 0.5 - o) / r;
    const d2 = dx * dx + dy * dy;
    if (d2 <= 1) {
      const nz = Math.sqrt(1 - d2);
      kind[k] = 1;
      lon[k] = Math.atan2(dx, nz) / (Math.PI * 2);
      lat[k] = Math.asin(dy) / Math.PI + 0.5;
      // Pre-scaled into five bands (see drawPlanet): the night side sinks to band 0.
      light[k] = Math.pow(Math.max(0, dx * LIGHT[0] + dy * LIGHT[1] + nz * LIGHT[2]), 0.85) * 5.4 - 1.05;
    } else {
      const d = Math.sqrt(d2);
      if (d < 1 + Math.max(2.5, r * 0.06) / r) {
        kind[k] = 2;
        light[k] = (d - 1) * r; // distance from the surface, in pixels
        lon[k] = (dx * LIGHT[0] + dy * LIGHT[1]) / d; // how much this rim faces the sun
      }
    }
  }
  const g = { size, o, kind, lon, lat, light };
  geometries.set(key, g);
  return g;
}

const SURFACE_NAMES = Object.keys(SURFACES);
const SURFACE_RGBA = SURFACE_NAMES.map((n) => SURFACES[n].map((h) => packed(h)));
const CLOUD_RGBA = Object.fromEntries(Object.entries(CLOUDS).map(([k, v]) => [k, v.map((h) => packed(h))]));
const EMISSIVE_IDX = new Set([...EMISSIVE].map((n) => SURFACE_NAMES.indexOf(n)));

// Colours packed for a Uint32 view of ImageData (little-endian: ABGR).
function packed(hex, a = 255) {
  const [r, g, b] = rgb(hex);
  return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

// Which surface each texel shows, for one (planet, progress, mood): computed once, not per pixel.
const surfaceMaps = new Map();
function surfaceMap(tex, seed, progress, mood) {
  const key = `${seed}|${tex.tw}|${progress.toFixed(3)}|${mood}`;
  if (surfaceMaps.has(key)) return surfaceMaps.get(key);
  const m = new Uint8Array(tex.tw * tex.th);
  for (let j = 0; j < tex.th; j++) {
    const lat = (j / (tex.th - 1) - 0.5) * 2;
    for (let i = 0; i < tex.tw; i++) {
      const t = j * tex.tw + i;
      m[t] = SURFACE_NAMES.indexOf(surfaceAt(tex.height[t], tex.order[t], lat, progress, mood));
    }
  }
  surfaceMaps.set(key, m);
  return m;
}

const frames = new Map(); // last frame per planet look, reused while the surface moves < 0.4px (1px when huge)

/**
 * Draws a lit, rotating, dithered planet with clouds, a terminator and an atmosphere glow.
 * @param o { cx, cy, r, seed, rot, progress 0..1, mood: 'alive'|'lost'|'locked'|'ghost', atmosphere, ring }
 */
export function drawPlanet(ctx, o) {
  const { cx, cy, seed, rot = 0, progress = 0, mood = 'alive', atmosphere = null, ring = null } = o;
  const r = Math.round(o.r);
  const pad = ring ? Math.ceil(r * 0.62) + 3 : Math.max(3, Math.ceil(r * 0.07) + 1);
  const g = geometry(r, pad);
  const lookKey = `${seed}|${r}|${progress}|${mood}|${atmosphere}|${ring ? 1 : 0}`;
  const last = frames.get(lookKey);
  if (last && Math.abs(last.rot - rot) * r < (r > 100 ? 1 : 0.4)) {
    ctx.drawImage(last.canvas, Math.round(cx - g.o), Math.round(cy - g.o));
    return;
  }
  const tex = planetTexture(seed, r > 70 ? 512 : r > 26 ? 256 : 128);
  const surf = surfaceMap(tex, seed, progress, mood);
  const { size, kind, lon, lat, light } = g;
  const canvas = last?.canvas ?? makeCanvas(size, size);
  const bctx = canvas.getContext('2d');
  const img = last?.img ?? bctx.createImageData(size, size);
  const px32 = new Uint32Array(img.data.buffer);
  px32.fill(0);
  const { tw, th, cloud } = tex;
  const cloudPal = mood === 'lost' ? CLOUD_RGBA.lost : mood === 'alive' ? (progress > 0.15 ? CLOUD_RGBA.alive : CLOUD_RGBA.barren) : null;
  const cloudCut = mood === 'lost' ? 0.63 : progress > 0.15 ? 0.615 : 0.65;
  const turn = rot / (Math.PI * 2);
  const cloudTurn = (rot * 1.35 + 0.3) / (Math.PI * 2);
  const atmo = atmosphere ? rgb(atmosphere) : null;
  const rim = Math.max(2.5, r * 0.06);
  for (let py = 0; py < size; py++) {
    const brow = (py & 3) * 4;
    for (let px = 0; px < size; px++) {
      const k = py * size + px;
      const kd = kind[k];
      if (kd === 0) continue;
      const q = BAYER[brow + (px & 3)];
      if (kd === 2) {
        if (!atmo || lon[k] < -0.35) continue;
        const a = Math.max(0, (1 - light[k] / rim) * (0.35 + Math.max(0, lon[k]) * 0.6));
        if (a < 0.08 || (a < 0.35 && q > a * 2.4)) continue;
        px32[k] = ((Math.round(120 + a * 135) << 24) | (atmo[2] << 16) | (atmo[1] << 8) | atmo[0]) >>> 0;
        continue;
      }
      let u = lon[k] + turn;
      u -= Math.floor(u);
      const tj = Math.min(th - 1, Math.floor(lat[k] * th));
      const t = tj * tw + Math.min(tw - 1, Math.floor(u * tw));
      // A hard GBA terminator: five bands, dithered at each step, the night side near-black.
      const level = Math.max(0, Math.min(4, Math.floor(light[k] + q)));
      const si = surf[t];
      let col = SURFACE_RGBA[si][EMISSIVE_IDX.has(si) ? Math.max(2, level) : level];
      if (cloudPal) {
        let uc = lon[k] + cloudTurn;
        uc -= Math.floor(uc);
        const c = cloud[tj * tw + Math.min(tw - 1, Math.floor(uc * tw))];
        if (c > cloudCut + (q - 0.5) * 0.05) col = cloudPal[level];
        else if (c > cloudCut - 0.03 && q > 0.72) col = cloudPal[Math.max(0, level - 1)];
      }
      px32[k] = col;
    }
  }
  if (ring) drawRing(img.data, size, r, ring);
  bctx.putImageData(img, 0, 0);
  frames.set(lookKey, { rot, canvas, img });
  ctx.drawImage(canvas, Math.round(cx - g.o), Math.round(cy - g.o));
}

// A thin ring tilted ~15°, drawn in two passes around the planet: the far half hidden behind the
// disc, the near half over it.
function drawRing(data, size, r, ring) {
  const o = size / 2;
  for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
    const dx = (px + 0.5 - o) / r, dy = (py + 0.5 - o) / r;
    const ry = (dy - dx * 0.26) / 0.3;
    const d = Math.hypot(dx, ry);
    if (d < 1.28 || d > 1.6) continue;
    const behind = ry < 0 && dx * dx + dy * dy <= 1;
    if (behind) continue;
    const band = d < 1.36 ? 2 : d < 1.44 ? 1 : d < 1.5 ? 3 : 1;
    const shade = dx > 0.5 ? Math.min(3, band + 1) : band;
    const k = (py * size + px) * 4;
    const [cr, cg, cb] = rgb(ring[shade]);
    data[k] = cr; data[k + 1] = cg; data[k + 2] = cb; data[k + 3] = 255;
  }
}

// ── Suns ─────────────────────────────────────────────────────────────────────

// Five tones each, limb → core. A seed picks one: each domain of the star chart burns its own colour.
const SUN_RAMPS = [
  ['#6b2a00', '#c25a00', '#ff9b30', '#ffd84a', '#fff4b0'], // gold
  ['#5a0818', '#a8183a', '#ff6a4a', '#ffb0a0', '#fff0e8'], // red giant
  ['#10266a', '#2f5fd8', '#6ff0ff', '#c8f8ff', '#ffffff'], // blue
  ['#3a1a70', '#6a2fd0', '#a88cff', '#e2c6ff', '#ffffff'], // violet
];

/** A sun's frames: its surface boils and its corona flickers through them, four a second. */
export const SUN_FRAMES = 4;

/** How far a sun's corona reaches past its disc, in pixels. */
const coronaOf = (r) => Math.max(3, Math.ceil(r * 0.35));

/** The side of the square a sun of radius `r` is drawn in: its disc and its corona. */
export function sunSize(r) {
  return (Math.round(r) + coronaOf(Math.round(r))) * 2;
}

const suns = new Map();

/**
 * One frame of a sun, as a square of colours (`null` is empty space): a dithered disc, brightest at
 * its core and boiling with granules, in a flickering corona of rays. Pure, and the same for the same
 * radius, seed and frame.
 */
export function sunPixels(radius, seed, frame = 0) {
  const r = Math.max(1, Math.round(radius));
  const f = ((frame % SUN_FRAMES) + SUN_FRAMES) % SUN_FRAMES;
  const key = `${r}|${seed}|${f}`;
  if (suns.has(key)) return suns.get(key);
  const ramp = SUN_RAMPS[(seed >>> 0) % SUN_RAMPS.length];
  const corona = coronaOf(r);
  const size = sunSize(r);
  const o = size / 2;
  const phase = (f / SUN_FRAMES) * Math.PI * 2; // the frames loop: the noise circles back to frame 0
  const pixels = new Array(size * size).fill(null);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const dx = px + 0.5 - o, dy = py + 0.5 - o;
      const d = Math.hypot(dx, dy);
      const q = BAYER[(py & 3) * 4 + (px & 3)];
      if (d <= r) {
        // Limb darkening: the core at the top tone, the rim two tones down; granules boil on top.
        const k = d / r;
        const granule = fbm(dx / 3.2 + Math.cos(phase) * 0.6, dy / 3.2 + Math.sin(phase) * 0.6, seed * 0.01, seed, 3) - 0.5;
        const level = Math.max(0, Math.min(4, Math.floor(4.6 - k * k * 2.6 + granule * 1.6 + (q - 0.5) * 0.6)));
        pixels[py * size + px] = ramp[level];
      } else if (d <= r + corona) {
        // Rays: brighter where the noise around the rim runs high, fading outwards, dithered.
        const a = Math.atan2(dy, dx);
        const ray = fbm(Math.cos(a) * 2.2 + Math.cos(phase) * 0.5, Math.sin(a) * 2.2 + Math.sin(phase) * 0.5, 3.1, seed + 11, 3);
        const fade = 1 - (d - r) / corona;
        const v = fade * (0.35 + ray * 1.1);
        if (v > q + 0.15) pixels[py * size + px] = ramp[v > 0.9 ? 2 : v > 0.55 ? 1 : 0];
      }
    }
  }
  const sun = { size, pixels };
  suns.set(key, sun);
  return sun;
}

const sunImages = new Map();

/**
 * Draws a sun of radius `r` centred on (`cx`, `cy`), within a square of side `sunSize(r)`, at the
 * frame the clock `t` (seconds) is on; the same seed always burns the same way.
 */
export function drawSun(ctx, { cx, cy, r, seed, t = 0 }) {
  const frame = Math.floor(t * 4) % SUN_FRAMES;
  const rr = Math.max(1, Math.round(r));
  const key = `${rr}|${seed}|${frame}`;
  let canvas = sunImages.get(key);
  if (!canvas) {
    const { size, pixels } = sunPixels(rr, seed, frame);
    canvas = makeCanvas(size, size);
    const sctx = canvas.getContext('2d');
    const img = sctx.createImageData(size, size);
    pixels.forEach((hex, i) => {
      if (!hex) return;
      const [cr, cg, cb] = rgb(hex);
      img.data[i * 4] = cr; img.data[i * 4 + 1] = cg; img.data[i * 4 + 2] = cb; img.data[i * 4 + 3] = 255;
    });
    sctx.putImageData(img, 0, 0);
    sunImages.set(key, canvas);
  }
  const half = sunSize(rr) / 2;
  ctx.drawImage(canvas, Math.round(cx - half), Math.round(cy - half));
}

// ── Space ────────────────────────────────────────────────────────────────────

export function makeStarfield(seed, w, h, count = 300) {
  const rand = rng(seed);
  return Array.from({ length: count }, () => ({
    x: rand() * w, y: rand() * h, layer: Math.floor(rand() * 3), phase: rand() * Math.PI * 2, big: rand() > 0.94,
  }));
}

const STAR_COLORS = ['#2e3270', '#6a70c0', '#c8d0ff', '#ffffff'];

export function drawStarfield(ctx, stars, t, { w, h, speed = 0 } = {}) {
  for (const s of stars) {
    const x = Math.floor(((s.x - t * speed * (s.layer + 1) * 6) % w + w) % w);
    const y = Math.floor(s.y);
    const twinkle = Math.sin(t * 2 + s.phase);
    ctx.fillStyle = STAR_COLORS[twinkle > 0.8 ? 3 : s.layer];
    ctx.fillRect(x, y, 1, 1);
    if (s.big) {
      ctx.fillStyle = STAR_COLORS[Math.max(0, s.layer - 1)];
      ctx.fillRect(x - 1, y, 1, 1); ctx.fillRect(x + 1, y, 1, 1); ctx.fillRect(x, y - 1, 1, 1); ctx.fillRect(x, y + 1, 1, 1);
      if (twinkle > 0.9) {
        ctx.fillStyle = '#6ff0ff';
        ctx.fillRect(x - 3, y, 2, 1); ctx.fillRect(x + 2, y, 2, 1); ctx.fillRect(x, y - 3, 1, 2); ctx.fillRect(x, y + 2, 1, 2);
      }
    }
  }
}

// A dithered nebula cloud, rendered once. `colors` runs dark → light (any number of tones).
export function makeNebula(seed, w, h, colors, density = 0.5) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const n = colors.length;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = x / w - 0.5, ny = y / h - 0.5;
      const falloff = Math.max(0, 1 - Math.hypot(nx * 1.8, ny * 1.8));
      const v = fbm(x / 52, y / 52, 0.5, seed, 5) * falloff * 1.9 * density;
      const q = BAYER[(y & 3) * 4 + (x & 3)];
      const level = Math.floor(v * (n + 1) + q - 1.1);
      if (level < 0) continue;
      const [cr, cg, cb] = rgb(colors[Math.min(n - 1, level)]);
      const k = (y * w + x) * 4;
      img.data[k] = cr; img.data[k + 1] = cg; img.data[k + 2] = cb; img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

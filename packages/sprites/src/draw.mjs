// Canvas helpers. Everything draws at native resolution (1 unit = 1 pixel); the page scales the
// canvas up with `image-rendering: pixelated`, so every edge stays a hard GBA-style pixel.
import { PALETTE } from './palette.mjs';
import { SPRITES } from './sprites.mjs';

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

// A sprite, rendered once per (name, tint, flip) and reused every frame.
export function spriteImage(name, { tint = null, flip = false } = {}) {
  const key = `${name}|${tint ? JSON.stringify(tint) : ''}|${flip}`;
  if (cache.has(key)) return cache.get(key);
  const rows = SPRITES[name];
  if (!rows) throw new Error(`unknown sprite ${name}`);
  const c = makeCanvas(rows[0].length, rows.length);
  const ctx = c.getContext('2d');
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      ctx.fillStyle = tint?.[ch] ?? PALETTE[ch];
      ctx.fillRect(flip ? row.length - 1 - x : x, y, 1, 1);
    });
  });
  cache.set(key, c);
  return c;
}

export function drawSprite(ctx, name, x, y, { scale = 1, tint, flip, alpha = 1 } = {}) {
  const img = spriteImage(name, { tint, flip });
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, Math.round(x), Math.round(y), img.width * scale, img.height * scale);
  ctx.globalAlpha = prev;
}

export function spriteSize(name) {
  const rows = SPRITES[name];
  return { w: rows[0].length, h: rows.length };
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

const TEX_W = 128;
const TEX_H = 64;
const textures = new Map();

// Two seamless maps per planet: `height` shapes the land, `order` decides which ground is
// terraformed first as progress rises (so a planet greens in patches, not in a sweep).
export function planetTexture(seed) {
  if (textures.has(seed)) return textures.get(seed);
  const height = new Float32Array(TEX_W * TEX_H);
  const order = new Float32Array(TEX_W * TEX_H);
  for (let j = 0; j < TEX_H; j++) {
    const lat = (j / (TEX_H - 1) - 0.5) * Math.PI;
    for (let i = 0; i < TEX_W; i++) {
      const lon = (i / TEX_W) * Math.PI * 2;
      const x = Math.cos(lat) * Math.cos(lon), y = Math.sin(lat), z = Math.cos(lat) * Math.sin(lon);
      height[j * TEX_W + i] = fbm(x * 2.2 + 5, y * 2.2 + 5, z * 2.2 + 5, seed);
      order[j * TEX_W + i] = fbm(x * 1.4 + 9, y * 1.4 + 9, z * 1.4 + 9, seed + 99, 3);
    }
  }
  // Normalise `order` to a uniform-ish ramp so progress p greens roughly p of the surface.
  const sorted = Float32Array.from(order).sort();
  for (let k = 0; k < order.length; k++) {
    let lo = 0, hi = sorted.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] < order[k]) lo = mid + 1; else hi = mid; }
    order[k] = lo / sorted.length;
  }
  const tex = { height, order };
  textures.set(seed, tex);
  return tex;
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

// 4 shades each, dark → light.
export const SURFACES = Object.freeze({
  ocean: ['#0c1a5c', '#15308f', '#2150c4', '#3b7bf0'],
  shore: ['#6b5a2a', '#a38b45', '#d6bd6a', '#f2dc8f'],
  land: ['#0f4d2f', '#1d8f55', '#4ee08a', '#9cf5b8'],
  peak: ['#3d4a3a', '#6b7a5d', '#a3b08a', '#dfe6c8'],
  ice: ['#8093c4', '#b5c3ea', '#dfe7ff', '#ffffff'],
  rock: ['#1c1538', '#35285e', '#54418c', '#7a64b8'],
  vein: ['#4a0d52', '#8a1a8c', '#d63cc8', '#ff8fe8'],
  ash: ['#1a0d12', '#3b1520', '#6b2230', '#a33a45'],
  ember: ['#5c0a18', '#a8183a', '#ff3b5c', '#ffb0a0'],
  stone: ['#202030', '#3a3a52', '#5b5b78', '#8a8aa6'],
});

function surfaceAt(h, o, lat, { progress, mood }) {
  if (mood === 'lost') return h > 0.62 && h < 0.66 ? 'ember' : 'ash';
  if (mood === 'locked' || mood === 'ghost') return 'stone';
  if (o < progress) {
    if (Math.abs(lat) > 0.78 + h * 0.12) return 'ice';
    if (h < 0.47) return 'ocean';
    if (h < 0.5) return 'shore';
    if (h < 0.66) return 'land';
    return 'peak';
  }
  if (h > 0.56 && h < 0.585) return 'vein';
  return 'rock';
}

/**
 * Draws a lit, rotating, dithered planet.
 * @param ctx canvas 2D context
 * @param o { cx, cy, r, seed, rot, progress 0..1, mood: 'alive'|'lost'|'locked'|'ghost', atmosphere, ring }
 */
export function drawPlanet(ctx, o) {
  const { cx, cy, r, seed, rot = 0, progress = 0, mood = 'alive', atmosphere = null, ring = null } = o;
  const tex = planetTexture(seed);
  const pad = ring ? Math.ceil(r * 0.62) + 2 : 2;
  const size = Math.ceil(r * 2) + pad * 2;
  const key = `planet-buf-${size}`;
  let buf = cache.get(key);
  if (!buf) { buf = makeCanvas(size, size); cache.set(key, buf); }
  const bctx = buf.getContext('2d');
  const img = bctx.createImageData(size, size);
  const data = img.data;
  const lx = -0.55, ly = -0.45, lz = 0.7;
  const ll = Math.hypot(lx, ly, lz);
  const ox = size / 2, oy = size / 2;
  const put = (px, py, hex, a = 255) => {
    const k = (py * size + px) * 4;
    const [cr, cg, cb] = rgb(hex);
    data[k] = cr; data[k + 1] = cg; data[k + 2] = cb; data[k + 3] = a;
  };
  const ringPixel = (px, py, front) => {
    if (!ring) return false;
    const dx = (px + 0.5 - ox) / r, dy = (py + 0.5 - oy) / r;
    // A thin ring tilted 15°: squash y, then keep the half nearer the viewer for the front pass.
    const ry = (dy - dx * 0.26) / 0.3;
    const d = Math.hypot(dx, ry);
    if (d < 1.28 || d > 1.58) return false;
    if ((ry > 0) !== front) return false;
    const band = d < 1.38 ? 2 : d < 1.5 ? 1 : 3;
    put(px, py, ring[band]);
    return true;
  };
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const dx = (px + 0.5 - ox) / r, dy = (py + 0.5 - oy) / r;
      const d2 = dx * dx + dy * dy;
      if (d2 > 1) {
        if (!ringPixel(px, py, false) && atmosphere && d2 < (1 + 1.6 / r) ** 2) {
          const lit = (dx * lx + dy * ly) / ll > -0.1;
          if (lit) put(px, py, atmosphere, 200);
        }
        continue;
      }
      const nz = Math.sqrt(1 - d2);
      let lon = Math.atan2(dx, nz) + rot;
      const lat = Math.asin(dy);
      let u = lon / (Math.PI * 2);
      u -= Math.floor(u);
      const v = lat / Math.PI + 0.5;
      const ti = Math.min(TEX_W - 1, Math.floor(u * TEX_W));
      const tj = Math.min(TEX_H - 1, Math.max(0, Math.floor(v * TEX_H)));
      const h = tex.height[tj * TEX_W + ti];
      const ord = tex.order[tj * TEX_W + ti];
      const surface = SURFACES[surfaceAt(h, ord, lat / (Math.PI / 2), { progress, mood })];
      const light = Math.max(0, (dx * lx + dy * ly + nz * lz) / ll);
      const t = BAYER[(py & 3) * 4 + (px & 3)];
      const level = Math.max(0, Math.min(3, Math.floor(light * 3.2 + t - 0.15)));
      put(px, py, surface[level]);
    }
  }
  if (ring) for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) ringPixel(px, py, true);
  bctx.putImageData(img, 0, 0);
  ctx.drawImage(buf, Math.round(cx - ox), Math.round(cy - oy));
}

// ── Space ────────────────────────────────────────────────────────────────────

export function makeStarfield(seed, w, h, count = 140) {
  const rand = rng(seed);
  return Array.from({ length: count }, () => ({
    x: rand() * w, y: rand() * h, layer: Math.floor(rand() * 3), phase: rand() * Math.PI * 2,
  }));
}

const STAR_COLORS = ['#3b3f7a', '#8a90d6', '#ffffff'];

export function drawStarfield(ctx, stars, t, { w, h, speed = 0 } = {}) {
  for (const s of stars) {
    const x = ((s.x - t * speed * (s.layer + 1) * 6) % w + w) % w;
    const tw = Math.sin(t * 2 + s.phase) > 0.85 ? 2 : s.layer;
    ctx.fillStyle = STAR_COLORS[tw];
    ctx.fillRect(Math.floor(x), Math.floor(s.y), 1, 1);
    if (s.layer === 2 && Math.sin(t * 1.3 + s.phase) > 0.97) {
      ctx.fillStyle = '#6ff0ff';
      ctx.fillRect(Math.floor(x) - 1, Math.floor(s.y), 3, 1);
      ctx.fillRect(Math.floor(x), Math.floor(s.y) - 1, 1, 3);
    }
  }
}

// A dithered nebula cloud, rendered once. `colors` is 3 shades, dark → light.
export function makeNebula(seed, w, h, colors, density = 0.5) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = x / w - 0.5, ny = y / h - 0.5;
      const falloff = Math.max(0, 1 - Math.hypot(nx * 1.8, ny * 1.8));
      const n = fbm(x / 26, y / 26, 0.5, seed, 4) * falloff * 1.9 * density;
      const t = BAYER[(y & 3) * 4 + (x & 3)];
      const level = Math.floor(n * 4 + t - 1.1);
      if (level < 0) continue;
      const hex = colors[Math.min(colors.length - 1, level)];
      const k = (y * w + x) * 4;
      const [cr, cg, cb] = rgb(hex);
      img.data[k] = cr; img.data[k + 1] = cg; img.data[k + 2] = cb; img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// @ts-nocheck
// The sprite forge. Sprites are laid out as material shapes (ellipses, polygons, lines, single
// pixels), then finished the way a GBA pixel artist would: every material has a 4-tone ramp
// (light, base, shade, dark) and is lit from the top left per connected shape, and the silhouette
// gets a coloured outline — the material's own darkest tone on the lit side, near-black on the
// shadow side. Pure: the result is a grid of hex colours, drawn to canvas by draw.mjs.

export const RAMPS = Object.freeze({
  W: ['#ffffff', '#e4e8ff', '#b3bbe6', '#7880bc'], // suit white
  N: ['#5a6cf0', '#3346cc', '#22309a', '#141c62'], // suit navy
  n: ['#3a4796', '#222b6e', '#161d4d', '#0c1030'], // deep navy: gloves, boots, belts
  S: ['#ffe2c6', '#f5c19a', '#d38c64', '#99573a'], // skin
  H: ['#4d4660', '#2a2436', '#1a1624', '#0c0a12'], // hair
  G: ['#ffffff', '#dcdee8', '#aaaebf', '#70748a'], // grey streak
  E: ['#e6fcff', '#8fe8ff', '#38b4e0', '#1a5f86'], // lens, glass
  R: ['#ff9aac', '#ff3b5c', '#c81e44', '#7a0f28'], // red
  M: ['#ffd0ec', '#ff8fd0', '#e05aa8', '#9a2e70'], // pink
  P: ['#e2c6ff', '#b07cff', '#7a45e0', '#43209a'], // plasma purple
  Y: ['#fff4b0', '#ffd84a', '#dc9c16', '#8f5c08'], // gold, yellow
  O: ['#ffc884', '#ff9b30', '#d86a12', '#8a3e08'], // orange
  B: ['#d99a5e', '#a8642e', '#7a4318', '#4a2610'], // beaver fur
  D: ['#8a5530', '#5e3417', '#40220e', '#241206'], // tail, dark leather
  T: ['#f7d6a8', '#dca472', '#b27a48', '#7a4e2a'], // muzzle tan
  V: ['#d0a8ff', '#9b5de5', '#6a35b8', '#3e1a78'], // octopod violet
  F: ['#ffffff', '#eef2ff', '#c4cce8', '#8a93b8'], // feathers, shirt
  A: ['#7d84ad', '#4d5374', '#33384f', '#1c1f31'], // agent suit
  L: ['#ffffff', '#d8dcf0', '#9ea4c6', '#5f668c'], // steel
  Z: ['#ff9ae8', '#c23ab4', '#7a1a78', '#3e0a44'], // Entropy (recoloured per wound kind)
  C: ['#e6ffff', '#6ff0ff', '#22b8d8', '#0e6a86'], // cyan glow
  g: ['#b8ffd0', '#4ee08a', '#1d9f5a', '#0e5a34'], // terraform green
  K: ['#a8f5e2', '#2fc6a4', '#178a80', '#0b4d52'], // sea teal (the pirate's coat)
  J: ['#d2e2f2', '#8aa8cc', '#56779e', '#2c4266'], // shark blue-grey
  o: ['#e4e49a', '#a6a844', '#6c7020', '#383c0e'], // turtle-shell olive
  U: ['#dce6ff', '#98b0f4', '#6278cc', '#34448e'], // Allen's pale-blue skin
});

// Flat colours: never shaded, never outlined by the lit-side rule. forge()'s `flat` recolours them.
export const FLAT = Object.freeze({
  Q: '#ffffff', X: '#08070f',
  1: '#ff3b5c', 2: '#ff7aa8', 3: '#b07cff', 4: '#5b7bff', // the Vertuoza stripes, a theme's stripe-1 to stripe-4
  e: '#ff2a4a', // Entropy eyes
  y: '#ffe680', // sparkle
});

const HEX = /^#[0-9a-f]{6}$/i;
const OUTLINE_DARK = '#0b0a26';
const INNER_LINE = 'k';

function makeGrid(w, h) {
  return Array.from({ length: h }, () => Array(w).fill(null));
}

function painter(grid, w, h) {
  const set = (x, y, m, t) => {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    grid[y][x] = m === null ? null : { m, t };
  };
  const d = {
    w, h,
    px(x, y, m, t) { set(x, y, m, t); return d; },
    pxs(points, m, t) { for (const [x, y] of points) set(x, y, m, t); return d; },
    rect(x, y, rw, rh, m, t) {
      for (let j = y; j < y + rh; j++) for (let i = x; i < x + rw; i++) set(i, j, m, t);
      return d;
    },
    ellipse(cx, cy, rx, ry, m, t) {
      for (let j = Math.floor(cy - ry - 1); j <= cy + ry + 1; j++) {
        for (let i = Math.floor(cx - rx - 1); i <= cx + rx + 1; i++) {
          const dx = (i + 0.5 - cx) / rx, dy = (j + 0.5 - cy) / ry;
          if (dx * dx + dy * dy <= 1) set(i, j, m, t);
        }
      }
      return d;
    },
    poly(points, m, t) {
      const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
      for (let j = Math.floor(Math.min(...ys)); j <= Math.max(...ys); j++) {
        for (let i = Math.floor(Math.min(...xs)); i <= Math.max(...xs); i++) {
          const px = i + 0.5, py = j + 0.5;
          let inside = false;
          for (let a = 0, b = points.length - 1; a < points.length; b = a++) {
            const [xa, ya] = points[a], [xb, yb] = points[b];
            if ((ya > py) !== (yb > py) && px < ((xb - xa) * (py - ya)) / (yb - ya) + xa) inside = !inside;
          }
          if (inside) set(i, j, m, t);
        }
      }
      return d;
    },
    line(x0, y0, x1, y1, m, thick = 1, t) {
      const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
      for (let s = 0; s <= steps; s++) {
        const x = x0 + ((x1 - x0) * s) / steps, y = y0 + ((y1 - y0) * s) / steps;
        if (thick <= 1) set(x, y, m, t);
        else d.ellipse(x + 0.5, y + 0.5, thick / 2, thick / 2, m, t);
      }
      return d;
    },
    // Copy the left half onto the right half (for symmetric bodies), then add asymmetric details.
    mirror() {
      for (let y = 0; y < h; y++) for (let x = 0; x < Math.floor(w / 2); x++) {
        const c = grid[y][x];
        if (c) grid[y][w - 1 - x] = { ...c };
      }
      return d;
    },
    clear(x, y) { set(x, y, null); return d; },
  };
  return d;
}

function components(grid, w, h) {
  const id = makeGrid(w, h);
  const boxes = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = grid[y][x];
    if (!c || id[y][x] !== null || !(c.m in RAMPS)) continue;
    const box = { minx: x, maxx: x, miny: y, maxy: y, n: 0 };
    const stack = [[x, y]];
    id[y][x] = boxes.length;
    while (stack.length) {
      const [cx, cy] = stack.pop();
      box.n++;
      box.minx = Math.min(box.minx, cx); box.maxx = Math.max(box.maxx, cx);
      box.miny = Math.min(box.miny, cy); box.maxy = Math.max(box.maxy, cy);
      for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || id[ny][nx] !== null) continue;
        if (grid[ny][nx]?.m === c.m) { id[ny][nx] = boxes.length; stack.push([nx, ny]); }
      }
    }
    boxes.push(box);
  }
  return { id, boxes };
}

/**
 * Builds a sprite. `draw(d)` paints materials with the painter API; the forge shades and outlines.
 * `tint` swaps a material's ramp; `flat` swaps a flat colour for one `#rrggbb` (a workspace's
 * theme passes its stripes as `1` to `4`), and an override that is not `#rrggbb` keeps the
 * default, so a colour never breaks a sprite. With neither, every sprite forges as it always has.
 * @returns {{ w: number, h: number, pixels: (string | null)[] }}
 */
export function forge(w, h, draw, { tint = {}, flat = {}, outline = true } = {}) {
  const grid = makeGrid(w, h);
  draw(painter(grid, w, h));
  const ramp = (m) => tint[m] ?? RAMPS[m];
  const flatColour = (m) => (HEX.test(flat[m]) ? flat[m] : FLAT[m]);
  const { id, boxes } = components(grid, w, h);
  const pixels = Array(w * h).fill(null);
  const same = (x, y, comp) => x >= 0 && y >= 0 && x < w && y < h && id[y][x] === comp;

  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = grid[y][x];
    if (!c) continue;
    if (c.m in FLAT) { pixels[y * w + x] = flatColour(c.m); continue; }
    if (c.m === INNER_LINE) continue; // resolved below, once its neighbours have colours
    let tone = c.t;
    if (tone === undefined) {
      const box = boxes[id[y][x]];
      const bw = box.maxx - box.minx, bh = box.maxy - box.miny;
      if (box.n < 5 || bw < 2 || bh < 1) tone = 1;
      else {
        const fx = bw ? (x - box.minx) / bw : 0.5, fy = bh ? (y - box.miny) / bh : 0.5;
        const s = 0.55 * fx + 0.45 * fy;
        tone = s < 0.3 ? 0 : s < 0.64 ? 1 : 2;
        // The edge facing away from the light sinks one more tone.
        if (!same(x + 1, y, id[y][x]) && !same(x, y + 1, id[y][x]) && tone < 2) tone = 2;
        // The lit rim catches a highlight.
        if (!same(x - 1, y, id[y][x]) && !same(x, y - 1, id[y][x]) && s < 0.5) tone = 0;
      }
    }
    pixels[y * w + x] = ramp(c.m)[tone];
  }

  // Inner lines take the darkest tone of the material they sit in.
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (grid[y][x]?.m !== INNER_LINE) continue;
    const counts = new Map();
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const m = grid[y + j]?.[x + i]?.m;
      if (m && m in RAMPS) counts.set(m, (counts.get(m) ?? 0) + 1);
    }
    const m = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    pixels[y * w + x] = m ? ramp(m)[3] : OUTLINE_DARK;
  }

  if (outline) {
    const filled = (x, y) => x >= 0 && y >= 0 && x < w && y < h && grid[y][x] !== null;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (grid[y][x]) continue;
      // The neighbour the outline hugs: right/below means this pixel is on the lit side.
      const lit = [[x + 1, y], [x, y + 1]].find(([i, j]) => filled(i, j));
      const shadow = [[x - 1, y], [x, y - 1]].find(([i, j]) => filled(i, j));
      if (!lit && !shadow) continue;
      const [i, j] = lit ?? shadow;
      const m = grid[j][i].m;
      pixels[y * w + x] = lit && m in RAMPS ? ramp(m)[3] : OUTLINE_DARK;
    }
  }
  return { w, h, pixels };
}

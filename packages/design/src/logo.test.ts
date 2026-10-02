import { describe, expect, it } from 'vitest';
import { INK } from './palette.ts';
import { drawLogo, LOGO_DRAWINGS, LOGO_FORMS, logoPixels, logoSvg } from './logo.ts';
import type { LogoArt, LogoDrawing } from './logo.ts';
import { assertDefined } from '../../../kit/test/assert.ts';

/** A pixel of a drawing: its column, its row, its colour. */
type Cell = [number, number, string | null];
interface Rect { x: number; y: number; w: number; h: number; c: unknown }

const INK_HEX = new Set<string>(Object.values(INK));
const RAMP: readonly (string | null | undefined)[] = [INK.highlight, INK.yellow, INK.orange, INK.ember];
const at = ({ w, h, pixels }: LogoArt, x: number, y: number): string | null | undefined =>
  (x < 0 || y < 0 || x >= w || y >= h ? null : pixels[y * w + x]);
const cells = (art: LogoArt): Cell[] => art.pixels.map((c, i): Cell => [i % art.w, Math.floor(i / art.w), c]);
const SIDES: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

describe('the logo', () => {
  it('has three forms and the favicon', () => {
    expect(LOGO_FORMS).toEqual(['full', 'lockup', 'mark']);
    expect(LOGO_DRAWINGS).toEqual(['full', 'lockup', 'mark', 'favicon']);
  });

  for (const form of LOGO_DRAWINGS) {
    describe(form, () => {
      const art = logoPixels(form);
      const mono = logoPixels(form, { mono: true });

      it('uses only INK colours: the ramp, the navy-dark outline and the plasma-dark shadow', () => {
        const used = new Set(art.pixels.filter(Boolean));
        for (const c of used) {
          assertDefined(c, 'a colour the drawing uses');
          expect(INK_HEX.has(c), c).toBe(true);
        }
        for (const c of [...RAMP, INK.navyDark, INK.plasmaDark]) {
          assertDefined(c, 'a colour the drawing must use');
          expect(used.has(c), c).toBe(true);
        }
      });

      it('outlines every lit pixel: a ramp pixel touches only the ramp or the outline, on each side', () => {
        for (const [x, y, c] of cells(art)) {
          if (!RAMP.includes(c)) continue;
          for (const [dx, dy] of SIDES) {
            const n = at(art, x + dx, y + dy);
            expect(RAMP.includes(n) || n === INK.navyDark, `${x},${y} side ${dx},${dy}`).toBe(true);
          }
        }
      });

      it('has no stray pixel: every pixel has a filled neighbour', () => {
        for (const [x, y, c] of cells(art)) {
          if (!c) continue;
          expect(SIDES.some(([dx, dy]) => at(art, x + dx, y + dy)), `${x},${y}`).toBe(true);
        }
      });

      it('lights every glyph from the top left, mostly from above: highlight at its top left, ember at its bottom right', () => {
        const lit = new Map(cells(art).filter(([, , c]) => RAMP.includes(c)).map(([x, y, c]): [string, Cell] => [`${x},${y}`, [x, y, c]]));
        const seen = new Set<string>();
        let glyphs = 0;
        for (const [key, start] of lit) {
          if (seen.has(key)) continue;
          // One glyph: the lit pixels joined to this one, corners included.
          const glyph: Cell[] = [];
          const stack: Cell[] = [start];
          seen.add(key);
          while (stack.length) {
            const p = stack.pop();
            assertDefined(p, 'a pixel to visit');
            glyph.push(p);
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
              const k = `${p[0] + dx},${p[1] + dy}`;
              const next = lit.get(k);
              if (next && !seen.has(k)) { seen.add(k); stack.push(next); }
            }
          }
          const light = ([x, y]: Cell): number => x + 3 * y;
          const first = glyph.reduce((a, b) => (light(b) < light(a) ? b : a));
          const last = glyph.reduce((a, b) => (light(b) > light(a) ? b : a));
          expect(first[2], `glyph at ${first[0]},${first[1]}`).toBe(INK.highlight);
          expect(last[2], `glyph at ${first[0]},${first[1]}`).toBe(INK.ember);
          glyphs++;
        }
        expect(glyphs).toBeGreaterThan(0);
      });

      it('has a one-colour variant: the same silhouette without its shadow, in navy-dark', () => {
        expect([mono.w, mono.h]).toEqual([art.w, art.h]);
        expect(new Set(mono.pixels.filter(Boolean))).toEqual(new Set([INK.navyDark]));
        art.pixels.forEach((c, i) => {
          const body = c && c !== INK.plasmaDark;
          expect(Boolean(mono.pixels[i]), `pixel ${i}`).toBe(Boolean(body));
        });
      });

      it('is a crisp SVG exactly k times its pixels at any whole-number scale', () => {
        for (const k of [1, 2, 3, 7, 16]) {
          const svg = logoSvg(form, { scale: k });
          expect(svg).toContain(`width="${art.w * k}"`);
          expect(svg).toContain(`height="${art.h * k}"`);
          expect(svg).toContain(`viewBox="0 0 ${art.w} ${art.h}"`);
          expect(svg).toContain('shape-rendering="crispEdges"');
        }
        expect(() => logoSvg(form, { scale: 1.5 })).toThrow(/whole number/);
        expect(() => logoSvg(form, { scale: 0 })).toThrow(/whole number/);
      });

      it('paints in the SVG exactly the pixels it holds', () => {
        const svg = logoSvg(form);
        const painted = new Map<string, string | null>();
        for (const [, fill, d] of svg.matchAll(/<path fill="([^"]+)" d="([^"]+)"/g)) {
          assertDefined(d, 'a path\'s outline');
          assertDefined(fill, 'a path\'s fill');
          for (const [, x, y, n] of d.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
            for (let i = 0; i < Number(n); i++) painted.set(`${Number(x) + i},${String(y)}`, fill);
          }
        }
        const held = new Map(cells(art).filter(([, , c]) => c).map(([x, y, c]) => [`${x},${y}`, c]));
        expect(painted).toEqual(held);
      });

      it('draws on a canvas at a whole-number scale, one rectangle per run', () => {
        const rects: Rect[] = [];
        const ctx: { fillStyle: unknown; fillRect: (x: number, y: number, w: number, h: number) => void } = {
          fillStyle: '',
          fillRect: (x, y, w, h) => { rects.push({ x, y, w, h, c: ctx.fillStyle }); },
        };
        drawLogo(ctx as CanvasRenderingContext2D, form, 10, 20, { scale: 3 });
        const area = rects.reduce((n, r) => n + r.w * r.h, 0);
        expect(area).toBe(art.pixels.filter(Boolean).length * 9);
        for (const r of rects) {
          expect(r.x).toBeGreaterThanOrEqual(10);
          expect(r.y).toBeGreaterThanOrEqual(20);
          expect(r.x + r.w).toBeLessThanOrEqual(10 + art.w * 3);
          expect(r.y + r.h).toBeLessThanOrEqual(20 + art.h * 3);
        }
        expect(() => { drawLogo(ctx as CanvasRenderingContext2D, form, 0, 0, { scale: 2.5 }); }).toThrow(/whole number/);
      });

      it('reveals itself from the left, a whole pixel column at a time', () => {
        const drawn = (reveal: number): { x: number; w: number; a: number }[] => {
          const rects: { x: number; w: number; a: number }[] = [];
          const fillRect = (x: number, _y: number, w: number, h: number): void => { rects.push({ x, w, a: w * h }); };
          drawLogo({ fillStyle: '', fillRect }, form, 0, 0, { scale: 2, reveal });
          return rects;
        };
        expect(drawn(0)).toEqual([]);
        expect(drawn(1).reduce((n, r) => n + r.a, 0)).toBe(art.pixels.filter(Boolean).length * 4);
        const half = drawn(0.5);
        const cols = Math.ceil(art.w * 0.5);
        expect(Math.max(...half.map((r) => r.x + r.w))).toBeLessThanOrEqual(cols * 2);
        const lit = art.pixels.filter((c, i) => c && i % art.w < cols).length;
        expect(half.reduce((n, r) => n + r.a, 0)).toBe(lit * 4);
      });
    });
  }

  it('reads OMNI LOOP: two words, with an O at the head of each and a second O in LOOP', () => {
    // The full form's columns: runs of lit columns are the glyphs, a wider blank run the space.
    const art = logoPixels('full');
    const litCols = Array.from({ length: art.w }, (_, x) =>
      Array.from({ length: art.h }, (_, y) => at(art, x, y)).some((c) => RAMP.includes(c)));
    const glyphs: [number, number][] = [];
    let start: number | null = null;
    litCols.forEach((on, x) => {
      if (on && start === null) start = x;
      if (!on && start !== null) { glyphs.push([start, x - start]); start = null; }
    });
    expect(glyphs.length).toBe(8);
    const widths = glyphs.map(([, w]) => w);
    // O M N I · L O O P: the three O are the loop arrow, wider than the 5×7 letters at 2×.
    expect(widths.filter((w) => w === 10)).toHaveLength(5);
    expect(widths[0]).toBe(widths[5]);
    expect(widths[5]).toBe(widths[6]);
    expect(widths[0]).toBeGreaterThan(10);
    const gaps = glyphs.slice(1).map(([x], i) => {
      const before = glyphs[i];
      assertDefined(before, 'the glyph before');
      return x - (before[0] + before[1]);
    });
    expect(Math.max(...gaps)).toBe(gaps[3]);
  });

  it('draws the lockup\'s O twice as big as the word\'s', () => {
    const lit = (art: LogoArt): Cell[] => cells(art).filter(([, , c]) => RAMP.includes(c));
    const height = (px: Cell[]): number => Math.max(...px.map(([, y]) => y)) - Math.min(...px.map(([, y]) => y)) + 1;
    expect(height(lit(logoPixels('lockup')))).toBe(2 * height(lit(logoPixels('mark'))));
  });

  it('draws the favicon on its own 16×16 grid, with a gap in its ring and an arrowhead of at least one pixel', () => {
    const fav = logoPixels('favicon');
    expect([fav.w, fav.h]).toEqual([16, 16]);
    const lit = (x: number, y: number): boolean => RAMP.includes(at(fav, x, y));
    // The gap: walking the top rows from the left, the ring's lit run ends and blank lit-free
    // columns follow before the arrowhead's run starts.
    const top = Array.from({ length: 5 }, (_, y) => y);
    const gapRows = top.filter((y) => {
      const row = Array.from({ length: 16 }, (_, x) => lit(x, y));
      const runs = row.reduce((n, on, x) => n + (on && !row[x - 1] ? 1 : 0), 0);
      return runs >= 2;
    });
    expect(gapRows.length).toBeGreaterThanOrEqual(1);
    // The arrowhead: its tip is a single lit pixel on a row above which nothing is lit in its column,
    // and it widens by at least one pixel each side below.
    const tipRow = top.find((y) => Array.from({ length: 16 }, (_, x) => lit(x, y)).some(Boolean));
    assertDefined(tipRow, 'the row of the arrowhead\'s tip');
    const tips = Array.from({ length: 16 }, (_, x) => x).filter((x) => lit(x, tipRow) && x > 8);
    expect(tips.length).toBeGreaterThanOrEqual(1);
    const tx = tips[0];
    assertDefined(tx, 'the arrowhead\'s tip');
    expect(lit(tx - 1, tipRow + 1) && lit(tx + 1, tipRow + 1)).toBe(true);
    expect(lit(tx - 2, tipRow + 2) && lit(tx + 2, tipRow + 2)).toBe(true);
  });

  it('is not the mark shrunk: the favicon is a drawing of its own', () => {
    const mark = logoPixels('mark');
    expect([mark.w, mark.h]).not.toEqual([16, 16]);
  });

  it('refuses a form it does not have', () => {
    expect(() => logoPixels('wordmark' as LogoDrawing)).toThrow(/unknown logo form/);
  });
});

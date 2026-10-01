// @ts-nocheck
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { drawSun, SUN_FRAMES, sunPixels, sunSize } from './draw.ts';

// A 2D context that keeps where each image lands, and the offscreen canvases the sun renders into.
function recorder() {
  const images = [];
  const ctx = new Proxy({}, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'createImageData') return (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });
      if (prop === 'drawImage') return (img, x, y, w, h) => { images.push({ x, y, w: w ?? img.width, h: h ?? img.height }); };
      return () => {};
    },
    set(target, prop, value) { target[prop] = value; return true; },
  });
  return { ctx, images };
}

class FakeOffscreenCanvas {
  constructor(width, height) { this.width = width; this.height = height; }
  getContext() { return recorder().ctx; }
}

describe('sunPixels', () => {
  it('fills its square: a bright disc of radius r, and a corona around it', () => {
    const r = 14;
    const { size, pixels } = sunPixels(r, 7, 0);
    expect(size).toBe(sunSize(r));
    expect(pixels).toHaveLength(size * size);
    const at = (x, y) => pixels[y * size + x];
    const c = size / 2;
    expect(at(Math.floor(c), Math.floor(c))).not.toBeNull(); // the core
    expect(at(0, 0)).toBeNull(); // the corners stay empty
    const disc = pixels.filter((p, i) => p && Math.hypot((i % size) + 0.5 - c, Math.floor(i / size) + 0.5 - c) <= r).length;
    expect(disc).toBeGreaterThan(Math.PI * r * r * 0.9);
    const corona = pixels.filter((p, i) => p && Math.hypot((i % size) + 0.5 - c, Math.floor(i / size) + 0.5 - c) > r + 1).length;
    expect(corona).toBeGreaterThan(0);
  });

  it('is the same frame for the same seed, and turns over its frames', () => {
    for (let frame = 0; frame < SUN_FRAMES; frame++) expect(sunPixels(12, 42, frame)).toEqual(sunPixels(12, 42, frame));
    expect(sunPixels(12, 42, 1).pixels).not.toEqual(sunPixels(12, 42, 0).pixels);
    expect(sunPixels(12, 42, SUN_FRAMES)).toEqual(sunPixels(12, 42, 0));
  });

  it('gives two seeds two suns', () => {
    expect(sunPixels(12, 1, 0).pixels).not.toEqual(sunPixels(12, 2, 0).pixels);
  });
});

describe('drawSun', () => {
  beforeAll(() => { vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas); });
  afterAll(() => { vi.unstubAllGlobals(); });

  it.each([4, 10, 23.4, 60])('draws a sun of radius %d within its size, centred where it is asked', (r) => {
    const { ctx, images } = recorder();
    drawSun(ctx, { cx: 100, cy: 80, r, seed: 3, t: 1.3 });
    expect(images).toHaveLength(1);
    const half = sunSize(r) / 2;
    for (const i of images) {
      expect(i.x).toBeGreaterThanOrEqual(100 - half - 1);
      expect(i.y).toBeGreaterThanOrEqual(80 - half - 1);
      expect(i.x + i.w).toBeLessThanOrEqual(100 + half + 1);
      expect(i.y + i.h).toBeLessThanOrEqual(80 + half + 1);
    }
  });

  it('draws the same for the same seed and moment', () => {
    const a = recorder(), b = recorder();
    drawSun(a.ctx, { cx: 50, cy: 50, r: 12, seed: 9, t: 2 });
    drawSun(b.ctx, { cx: 50, cy: 50, r: 12, seed: 9, t: 2 });
    expect(a.images).toEqual(b.images);
  });
});

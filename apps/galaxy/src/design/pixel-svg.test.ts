import { describe, expect, it } from 'vitest';
import { pixelSvg } from './pixel-svg';

// A pixel grid as a crisp SVG: the page draws every sprite with it, so it must never smooth, never
// drop a pixel and never grow by anything but a whole number.

const A = '#ff0000', B = '#00ff00';
const GRID = { w: 3, h: 2, pixels: [A, A, null, B, A, B] };

describe('pixelSvg', () => {
  it('is k times the grid, on the grid’s own viewBox, never smoothed', () => {
    const svg = pixelSvg(GRID, { scale: 4, title: 'grid' });
    expect(svg).toMatch(/^<svg [^>]*width="12" height="8" viewBox="0 0 3 2" shape-rendering="crispEdges"/);
  });

  it('paints one path per colour, a run of one colour on a row as one rectangle', () => {
    const svg = pixelSvg(GRID, { scale: 1, title: 'grid' });
    expect(svg).toContain(`<path fill="${A}" d="M0 0h2v1h-2zM1 1h1v1h-1z"/>`);
    expect(svg).toContain(`<path fill="${B}" d="M0 1h1v1h-1zM2 1h1v1h-1z"/>`);
    expect(svg.match(/<path /g)).toHaveLength(2);
  });

  it('names itself for a screen reader, and escapes the name', () => {
    const svg = pixelSvg(GRID, { scale: 1, title: 'a <b> & "c"' });
    expect(svg).toContain('role="img" aria-label="a &lt;b&gt; &amp; &quot;c&quot;"');
    expect(svg).toContain('<title>a &lt;b&gt; &amp; &quot;c&quot;</title>');
  });

  it('takes only a whole-number scale of at least one', () => {
    for (const scale of [0, -1, 1.5, Number.NaN]) expect(() => pixelSvg(GRID, { scale, title: 'x' }), String(scale)).toThrow();
  });
});

import { SURFACES } from '@omni/design';
import { describe, expect, it } from 'vitest';
import { crestSvg, omniSvg, PLANET_PROGRESS, planetPixels, planetSvgs, starfieldSvg } from './art';

// The poster's pictures, drawn on the server from @omni/design and the game's own renderers.

/** Every colour the game paints secured ground with: grass and forest. */
const SECURED = new Set([...SURFACES.grass, ...SURFACES.forest]);
const secured = (progress: number) => planetPixels(progress).pixels.filter((c) => c && SECURED.has(c)).length;

describe('the invaded planet', () => {
  it('is drawn by the game\'s own drawPlanet: a round disc of its surface colours', () => {
    const { w, h, pixels } = planetPixels(0.5);
    expect(w).toBe(h);
    expect(pixels).toHaveLength(w * h);
    expect(pixels[0]).toBeNull();
    expect(pixels[Math.floor(h / 2) * w + Math.floor(w / 2)]).not.toBeNull();
  });

  it('shows green patches of secured ground, spreading as the invasion goes on', () => {
    const [a, b, c] = PLANET_PROGRESS.map(secured);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });

  it('leaves no stand-in canvas behind it', () => {
    planetPixels(0.3);
    expect('OffscreenCanvas' in globalThis).toBe(false);
  });

  it('is one crisp SVG per frame', () => {
    const frames = planetSvgs();
    expect(frames).toHaveLength(PLANET_PROGRESS.length);
    for (const svg of frames) expect(svg).toMatch(/^<svg [^>]*shape-rendering="crispEdges"/);
  });
});

describe('the crest, OmniMan and the stars', () => {
  it('draws the crest in its full form, named for a screen reader', () => {
    expect(crestSvg()).toMatch(/aria-label="Omni Loop"/);
  });

  it('draws OmniMan pointing', () => {
    expect(omniSvg()).toMatch(/aria-label="OmniMan pointing at the crest"/);
    expect(omniSvg()).toContain('<path fill=');
  });

  it('draws a still starfield that fills its box and hides from a screen reader', () => {
    const svg = starfieldSvg();
    expect(svg).toContain('preserveAspectRatio="xMidYMid slice"');
    expect(svg).toContain('aria-hidden="true"');
    expect(svg.match(/<path /g)?.length).toBeGreaterThan(1);
  });
});

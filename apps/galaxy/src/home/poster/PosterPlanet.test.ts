// The poster's planet turns (PRD 394): a canvas drawn with the game's own drawPlanet while the
// invasion spreads, the server-drawn frames staying as the fallback and under reduced motion. The
// galaxy's tests run with no DOM, so the component's clock and its choice to mount a canvas are
// tested through a stubbed canvas, a stubbed matchMedia and a stubbed frame clock, and its markup
// through the server render.
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { PLANET, PLANET_PROGRESS } from './art';
import { Poster } from './Poster';
import { PosterPlanet } from './PosterPlanet';
import { PLANET_LABEL, planetAt, planetMoves, REDUCED_MOTION, spinPlanet, type SpinClock } from './PosterPlanetSpin';
import type { drawPlanet } from '@omni/design';
import { item, present } from '../../ask/test/test-item';

const matchMedia = (reduced: boolean) => (query: string) => ({ matches: query === REDUCED_MOTION && reduced });

describe('planetMoves', () => {
  it('turns the planet only when motion is allowed', () => {
    expect(planetMoves({ matchMedia: matchMedia(false) })).toBe(true);
    expect(planetMoves({ matchMedia: matchMedia(true) })).toBe(false);
  });

  it('asks the reduced-motion question', () => {
    expect(REDUCED_MOTION).toBe('(prefers-reduced-motion: reduce)');
  });

  it('stays still where there is no matchMedia', () => {
    expect(planetMoves({})).toBe(false);
  });
});

describe('planetAt', () => {
  it('turns once in about 60 s', () => {
    expect(planetAt(0).rot).toBe(0);
    expect(planetAt(60).rot).toBeCloseTo(Math.PI * 2);
    expect(planetAt(1).rot).toBeGreaterThan(planetAt(0.5).rot);
  });

  it('spreads the invasion 25 %, 50 %, 80 %, a step every 1.5 s, then again', () => {
    expect([0, 1.4, 1.5, 2.9, 3, 4.4, 4.5].map((t) => planetAt(t).progress)).toEqual([0.25, 0.25, 0.5, 0.5, 0.8, 0.8, 0.25]);
    expect(PLANET_PROGRESS).toEqual([0.25, 0.5, 0.8]);
  });
});

/** A frame clock driven by hand, and a page whose visibility the test flips. */
function stubs(size = 62) {
  let now = 0;
  let next = 1;
  const pending = new Map<number, (ms: number) => void>();
  const listeners = new Set<() => void>();
  const doc = {
    hidden: false,
    addEventListener: (_: 'visibilitychange', fn: () => void) => { listeners.add(fn); },
    removeEventListener: (_: 'visibilitychange', fn: () => void) => { listeners.delete(fn); },
  };
  const clock: SpinClock = {
    now: () => now,
    frame: (fn) => { const id = next++; pending.set(id, fn); return id; },
    cancel: (id) => { pending.delete(id); },
    doc,
  };
  const tick = (ms: number) => {
    now += ms;
    const due = [...pending.values()];
    pending.clear();
    for (const fn of due) fn(now);
  };
  const setHidden = (hidden: boolean) => { doc.hidden = hidden; for (const fn of [...listeners]) fn(); };
  const ctx = { clearRect: vi.fn(), imageSmoothingEnabled: true } as unknown as CanvasRenderingContext2D;
  const draw = vi.fn<typeof drawPlanet>();
  return { clock, tick, setHidden, pending, listeners, ctx, draw, size };
}

describe('spinPlanet', () => {
  it('draws the poster planet with a rot that grows and the invasion steps in turn', () => {
    const s = stubs();
    const onFirst = vi.fn();
    spinPlanet(s.ctx, s.size, s.clock, { draw: s.draw, onFirst });
    expect(s.draw).toHaveBeenCalledTimes(1);
    expect(onFirst).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 40; i++) s.tick(250);
    const calls = s.draw.mock.calls.map(([, o]) => o);
    for (const o of calls) expect(o).toMatchObject({ cx: s.size / 2, cy: s.size / 2, r: PLANET.r, seed: PLANET.seed });
    for (let i = 1; i < calls.length; i++) expect(item(calls, i).rot).toBeGreaterThan(present(item(calls, i - 1).rot, 'the turn before'));
    const steps = calls.map((o) => o.progress).filter((p, i, all) => i === 0 || p !== all[i - 1]);
    expect(steps.slice(0, 6)).toEqual([0.25, 0.5, 0.8, 0.25, 0.5, 0.8]);
    expect(onFirst).toHaveBeenCalledTimes(1);
    expect(s.ctx.imageSmoothingEnabled).toBe(false);
  });

  it('stops drawing while the tab is hidden, and carries on when it shows again', () => {
    const s = stubs();
    spinPlanet(s.ctx, s.size, s.clock, { draw: s.draw });
    s.tick(100);
    s.setHidden(true);
    const drawn = s.draw.mock.calls.length;
    expect(s.pending.size).toBe(0);
    s.tick(100);
    s.tick(100);
    expect(s.draw.mock.calls.length).toBe(drawn);
    s.setHidden(false);
    s.tick(100);
    expect(s.draw.mock.calls.length).toBeGreaterThan(drawn);
    expect(s.pending.size).toBe(1);
  });

  it('stops drawing and lets go of the page when it is stopped', () => {
    const s = stubs();
    const stop = spinPlanet(s.ctx, s.size, s.clock, { draw: s.draw });
    s.tick(100);
    stop();
    const drawn = s.draw.mock.calls.length;
    expect(s.pending.size).toBe(0);
    expect(s.listeners.size).toBe(0);
    s.setHidden(false);
    s.tick(100);
    expect(s.draw.mock.calls.length).toBe(drawn);
  });
});

describe('PosterPlanet on the server', () => {
  it('draws no canvas until the browser says motion is allowed, and keeps the frames it is given', () => {
    const html = renderToStaticMarkup(createElement(PosterPlanet, { size: 62, children: createElement('span', { className: 'home-planet-frame' }, 'f') }));
    expect(html).not.toContain('<canvas');
    expect(html).toContain('class="home-planet-frame"');
    expect(html).toContain(`aria-label="${PLANET_LABEL}"`);
    expect(html).toMatch(/role="img"/);
    expect(html).not.toContain('data-turning');
  });

  it('still holds the three planet frames inside the planet\'s labelled box on the poster', () => {
    const html = renderToStaticMarkup(createElement(Poster));
    const at = html.indexOf(`aria-label="${PLANET_LABEL}"`);
    expect(at).toBeGreaterThan(0);
    const box = html.slice(at, html.indexOf('home-crest', at));
    expect(box.match(/class="home-planet-frame"/g)).toHaveLength(3);
    expect(box).not.toContain('<canvas');
  });
});

describe('the planet in the stylesheet and the comments', () => {
  const css = readFileSync(new URL('../home.css', import.meta.url), 'utf8');
  const reduced = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));

  it('hides the frames only once the canvas has drawn', () => {
    expect(css).toMatch(/\.home-planet\[data-turning\] \.home-planet-frame \{[^}]*visibility: hidden/);
  });

  it('hides the canvas and shows the last frame under reduced motion', () => {
    expect(reduced).toMatch(/\.home-planet-canvas \{[^}]*display: none/);
    expect(reduced).toMatch(/\.home-planet-frame:last-child \{[^}]*opacity: 1/);
  });

  it('says the page ships two client components', () => {
    for (const file of ['../Home.tsx', '../Controls.tsx']) {
      const text = readFileSync(new URL(file, import.meta.url), 'utf8');
      expect(text, file).toMatch(/two client components/);
      expect(text, file).not.toMatch(/one client component/);
    }
  });
});

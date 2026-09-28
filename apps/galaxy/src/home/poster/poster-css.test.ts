// The poster's stylesheet (PRD 394): one left edge for the text column, a hero that fills a desktop
// screen, and the crest right under the planet. Read from home.css, like the design-system test
// reads stylesheets.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../home.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** The poster's part of the stylesheet: from its first rule to the magazine spreads. */
const poster = css.slice(css.indexOf('.home-poster {'), css.indexOf('.home-spread {'));

/** The body of the first rule whose selector is exactly `selector`, outside any media query. */
const rule = (selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\n)${escaped} \\{([^}]*)\\}`).exec(css)?.[1] ?? '';
};

describe('the poster stylesheet', () => {
  it('finds the poster section', () => {
    expect(poster.length).toBeGreaterThan(200);
    expect(poster).toContain('.home-kicker');
  });

  it('skews no box under the poster: the kicker, the headline and the quote lean their letters', () => {
    expect(poster).not.toMatch(/skewX/);
    for (const selector of ['.home-kicker', '.home-head', '.home-quote']) {
      expect(rule(selector), selector).toMatch(/font-style: oblique /);
      expect(rule(selector), selector).not.toMatch(/transform/);
    }
  });

  it('colours the kicker cyan', () => {
    expect(rule('.home-kicker')).toMatch(/color: var\(--cyan\);/);
  });

  it('fills a desktop screen: 100svh tall, no 820px cap, the column centred vertically', () => {
    expect(rule('.home-poster')).toMatch(/min-height: 100svh;/);
    expect(css).not.toMatch(/820px/);
    expect(rule('.home-col')).toMatch(/align-content: center;/);
  });

  it('groups the planet, the crest and PRESS START on the starfield side, centred, 20px apart', () => {
    const sky = rule('.home-sky');
    expect(sky).toMatch(/align-content: center;/);
    expect(sky).toMatch(/gap: 20px;/);
    expect(sky).not.toMatch(/1fr/);
  });
});

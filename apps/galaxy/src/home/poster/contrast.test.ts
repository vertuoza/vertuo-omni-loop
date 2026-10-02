// Every text colour the poster sets on the ad's purple reads (PRD 394): at least 4.5:1 with
// @omni/design's contrast(), and the stylesheet sets exactly the colours the poster module names.
import { readFileSync } from 'node:fs';
import { COLOURS, contrast } from '@omni/design';
import { describe, expect, it } from 'vitest';
import { SELECTOR_BACKGROUND, SELECTOR_TEXT } from '../selector/look';
import { POSTER_BACKGROUND, POSTER_TEXT } from './Poster';

const css = readFileSync(new URL('../home.css', import.meta.url), 'utf8');
const colours = COLOURS as Record<string, string>;

describe('the poster text on the ad purple', () => {
  it('sits on --ad-purple', () => {
    expect(POSTER_BACKGROUND).toBe('ad-purple');
    expect(css).toMatch(/\n\.home-col \{[^}]*background: var\(--ad-purple\);/);
  });

  it('names the kicker, the headline, the pitch, the promises and the quote', () => {
    expect(POSTER_TEXT.map(({ selector }) => selector)).toEqual(
      expect.arrayContaining(['.home-kicker', '.home-head', '.home-pitch', '.home-promises', '.home-quote']),
    );
  });

  it.each(POSTER_TEXT)('$selector is --$colour and scores at least 4.5', ({ selector, colour }) => {
    expect(colours[colour], `--${colour} is a token`).toMatch(/^#[0-9a-f]{6}$/i);
    expect(contrast(colours[colour], colours[POSTER_BACKGROUND])).toBeGreaterThanOrEqual(4.5);
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const body = new RegExp(`\\n${escaped} \\{([^}]*)\\}`).exec(css)?.[1] ?? '';
    expect(body, selector).toContain(`color: var(--${colour});`);
  });

  it('leaves red out of the poster text', () => {
    expect(POSTER_TEXT.map(({ colour }) => colour)).not.toContain('red');
  });
});

// SELECT YOUR APP (PRD 932, s3): every text colour the overlay sets reads at 4.5:1 or better on the
// background it is set on, and its stylesheet sets exactly the colours the selector names.
describe('the SELECT YOUR APP overlay\'s text', () => {
  const selectorCss = readFileSync(new URL('../selector/selector.css', import.meta.url), 'utf8');

  it('sits on --void, and names the banner, the cursor, the names, the stats, the lines, the toggle and the keys', () => {
    expect(SELECTOR_BACKGROUND).toBe('void');
    expect(selectorCss).toMatch(/\n\.home-select \{[^}]*background: [^;]*var\(--void\);/);
    expect(SELECTOR_TEXT.map(({ selector }) => selector)).toEqual(expect.arrayContaining([
      '.home-select-banner', '.home-select-cursor', '.home-select-name', '.home-select-stat',
      '.home-select-what', '.home-select-remember', '.home-select-keys', '.home-select-keys kbd',
    ]));
  });

  it.each(SELECTOR_TEXT)('$selector is --$colour on --$on and scores at least 4.5', ({ selector, colour, on }) => {
    expect(colours[colour], `--${colour} is a token`).toMatch(/^#[0-9a-f]{6}$/i);
    expect(colours[on], `--${on} is a token`).toMatch(/^#[0-9a-f]{6}$/i);
    expect(contrast(colours[colour], colours[on])).toBeGreaterThanOrEqual(4.5);
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const body = new RegExp(`\\n${escaped} \\{([^}]*)\\}`).exec(selectorCss)?.[1] ?? '';
    expect(body, selector).toContain(`color: var(--${colour});`);
  });
});

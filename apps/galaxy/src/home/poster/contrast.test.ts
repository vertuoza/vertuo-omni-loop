// Every text colour the poster sets on the ad's purple reads (PRD 394): at least 4.5:1 with
// @omni/design's contrast(), and the stylesheet sets exactly the colours the poster module names.
import { readFileSync } from 'node:fs';
import { COLOURS, contrast } from '@omni/design';
import { describe, expect, it } from 'vitest';
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
    expect(contrast(colours[colour]!, colours[POSTER_BACKGROUND]!)).toBeGreaterThanOrEqual(4.5);
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const body = new RegExp(`\\n${escaped} \\{([^}]*)\\}`).exec(css)?.[1] ?? '';
    expect(body, selector).toContain(`color: var(--${colour});`);
  });

  it('leaves red out of the poster text', () => {
    expect(POSTER_TEXT.map(({ colour }) => colour)).not.toContain('red');
  });
});

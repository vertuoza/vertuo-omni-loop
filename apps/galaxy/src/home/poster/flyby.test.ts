// OmniMan flies past the planet (PRD 394): the omni-cheer-cape sprite, drawn on the server, crosses
// the starfield every 12 s. CSS only, aria-hidden, no clicks, and never under reduced motion. The
// markup is read from the server render, the motion from home.css.
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FLYBY_POSE, flybySvg } from './art';
import { Poster } from './Poster';

const html = renderToStaticMarkup(Poster());
const css = readFileSync(new URL('../home.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** The markup of the starfield side, from its opening tag to the end of the poster. */
const sky = html.slice(html.indexOf('class="home-sky"'));
/** The flyby's opening tag. */
const flyby = /<div [^>]*class="home-flyby"[^>]*>/.exec(html)?.[0] ?? '';

/** The body of the first rule whose selector is exactly `selector` inside `source`. */
const rule = (source: string, selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\n)\\s*${escaped} \\{([^}]*)\\}`).exec(source)?.[1] ?? '';
};
/** The body of the media block opened by `query`, up to its closing brace at the start of a line. */
const media = (query: string) => {
  const from = css.indexOf(`@media ${query} {`);
  return from < 0 ? '' : css.slice(from, css.indexOf('\n}', from));
};

describe('the flyby in the poster', () => {
  it('sits on the starfield side', () => {
    expect(flyby).not.toBe('');
    expect(sky).toContain('class="home-flyby"');
  });

  it('hides from a screen reader and names its pose', () => {
    expect(flyby).toContain('aria-hidden="true"');
    expect(flyby).toContain(`data-pose="${FLYBY_POSE}"`);
  });

  it('holds the omni-cheer-cape sprite\'s SVG', () => {
    expect(sky).toContain(flybySvg());
  });
});

describe('the flyby\'s motion', () => {
  it('crosses on a 12 s cycle and takes no clicks', () => {
    const body = rule(css, '.home-flyby');
    expect(body).toMatch(/pointer-events: none;/);
    expect(body).toMatch(/animation: home-flyby 12s linear infinite;/);
  });

  it('is visible for about 2.5 s of the 12', () => {
    const keyframes = css.slice(css.indexOf('@keyframes home-flyby'));
    // 2.5 s of 12 s is about 21 % of the cycle: he enters at 0 % and is gone by 21 %.
    expect(keyframes).toMatch(/21%\s*\{[^}]*opacity: 0;/);
    expect(keyframes).toMatch(/0%\s*\{[^}]*opacity: 1;/);
  });

  it('never appears under reduced motion', () => {
    const body = rule(media('(prefers-reduced-motion: reduce)'), '.home-flyby');
    expect(body).toMatch(/animation: none;/);
    expect(body).toMatch(/display: none;/);
  });

  it('crosses the starfield band at the top on a phone', () => {
    expect(rule(media('(max-width: 760px)'), '.home-flyby')).toMatch(/top: /);
  });
});

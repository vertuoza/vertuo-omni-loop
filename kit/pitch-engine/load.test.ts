// Loading the page's input (PRD 1108 s4): where the input is, and every path of it read against its
// address, fonts included.
import { describe, expect, it } from 'vitest';
import { presetLook } from '../lib/pitch/settings.ts';
import { fixtureStoryboard } from '../lib/pitch/storyboard.fixture.ts';
import { absoluteUrls, engineOf, inputUrl } from './load.ts';

describe('inputUrl', () => {
  it('reads input.json beside the page, or the address ?input= names', () => {
    expect(inputUrl('http://127.0.0.1:4173/engine/index.html').href).toBe('http://127.0.0.1:4173/engine/input.json');
    expect(inputUrl('http://127.0.0.1:4173/engine/index.html?input=/run/input.json').href).toBe('http://127.0.0.1:4173/run/input.json');
  });
});

describe('absoluteUrls', () => {
  it('reads every font file of a stylesheet against the input, quoted or not', () => {
    const base = new URL('http://127.0.0.1:4173/run/input.json');
    const css = '@font-face { src: url("fonts/a-700-0.woff2") format("woff2"); }\n@font-face { src: url(fonts/b.ttf); }\n@font-face { src: url(\'https://cdn.test/c.woff2\'); }';
    expect(absoluteUrls(css, base)).toBe(
      '@font-face { src: url("http://127.0.0.1:4173/run/fonts/a-700-0.woff2") format("woff2"); }\n@font-face { src: url(http://127.0.0.1:4173/run/fonts/b.ttf); }\n@font-face { src: url(\'https://cdn.test/c.woff2\'); }',
    );
  });
});

describe('engineOf', () => {
  it('builds the timeline, the palette and the fonts, and reads the logo and the media against the input', () => {
    const base = new URL('http://127.0.0.1:4173/run/input.json');
    const engine = engineOf({ storyboard: fixtureStoryboard(), look: presetLook('keynote'), fonts: { heading: '"Inter", serif' }, logo: 'assets/logo.svg', credits: ['Music: none'], clips: {} }, base);
    expect(engine.timeline.frames).toBe(705);
    expect(engine.palette.paper).toBe('#FBFBFD');
    expect(engine.fonts.heading.stack).toBe('"Inter", serif');
    expect(engine.logo).toBe('http://127.0.0.1:4173/run/assets/logo.svg');
    expect(engine.resolve('clips/walk.webm')).toBe('http://127.0.0.1:4173/run/clips/walk.webm');
    expect(engine.credits).toEqual(['Music: none']);
  });

  it('draws no logo when the input has none', () => {
    const engine = engineOf({ storyboard: fixtureStoryboard(), look: presetLook('arcade'), fonts: {}, logo: null, credits: [], clips: {} }, new URL('http://x.test/input.json'));
    expect(engine.logo).toBeNull();
  });
});

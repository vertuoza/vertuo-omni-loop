// A scene's supporting lines (PRD 2030 s3): the statement, feature, steps and before/after draw an
// eyebrow above their title and a body under it, the body arriving once the title's last word has; the
// outro draws a body under its closing line. Each scene is drawn alone, as markup, at a frame of its own.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EngineProvider, SceneSequence } from './core.tsx';
import { AFTER_BODY, linesTimes } from './layout.tsx';
import { fontsOf, paletteOf } from './palette.ts';
import { SceneView } from './scenes.tsx';
import { revealEnd } from './text.ts';
import { buildTimeline } from './timeline.ts';
import { presetLook } from '../lib/pitch/settings.ts';
import { fixtureStoryboard } from '../lib/pitch/storyboard.fixture.ts';
import type { Scene } from '../lib/pitch/storyboard.ts';

const FPS = 30;
const EYEBROW = 'New in Widgets';
const BODY = 'Every line priced, the quote leaves on its own.';

/** The fixture's scene `index`, with `fields` added. */
function fixtureScene(index: number, fields: Record<string, unknown>): Scene {
  const scene = fixtureStoryboard().scenes[index];
  if (scene === undefined) throw new Error(`the fixture has no scene ${index}`);
  return { ...scene, ...fields };
}

/** `scene` drawn alone, `seconds` into it, as markup. */
function drawn(scene: Scene, seconds: number): string {
  const storyboard = { ...fixtureStoryboard(), scenes: [scene] };
  const timeline = buildTimeline(storyboard);
  const [placed] = timeline.scenes;
  if (placed === undefined) throw new Error('no scene to draw');
  const look = presetLook('keynote');
  const engine = { timeline, palette: paletteOf(look), fonts: fontsOf(look, {}), logo: null, credits: ['Music: none'], clips: {}, resolve: (path: string) => path };
  const view = createElement(SceneSequence, { scene: placed, children: createElement(SceneView, { scene }) });
  return renderToStaticMarkup(createElement(EngineProvider, { engine, frame: Math.round(seconds * FPS), children: view }));
}

/** The opacity of the reading line holding `text` in `markup`; undefined when there is none. */
function lineOpacity(markup: string, text: string): number | undefined {
  const line = new RegExp(`<p style="([^"]*)">${text}</p>`).exec(markup);
  if (line === null) return undefined;
  return Number(/opacity:([\d.e-]+)/.exec(line[1] ?? '')?.[1]);
}

describe('linesTimes', () => {
  it('times a title alone as before: its words from 0.1 s, what follows after its last word', () => {
    expect(linesTimes({ title: 'Send from the quote' })).toMatchObject({ title: 0.1, after: revealEnd('Send from the quote', 0.1) });
    expect(linesTimes({}).after).toBe(0.3);
  });

  it('starts the title once its eyebrow has slid in, and the body after the title’s last word', () => {
    const at = linesTimes({ eyebrow: EYEBROW, title: 'Send from the quote', body: BODY });
    expect(at.eyebrow).toBeLessThan(at.title);
    expect(at.body).toBe(revealEnd('Send from the quote', at.title));
    expect(at.after).toBe(at.body + AFTER_BODY);
  });

  it('brings a body with no title in after the eyebrow', () => {
    const at = linesTimes({ eyebrow: EYEBROW, body: BODY });
    expect(at.body).toBeGreaterThan(at.eyebrow);
  });
});

describe('a scene’s supporting lines', () => {
  it.each([
    ['a statement', 1],
    ['a feature', 2],
    ['steps', 3],
    ['a before/after', 4],
  ])('draws %s’s eyebrow and body, settled', (_name, index) => {
    const markup = drawn(fixtureScene(index, { eyebrow: EYEBROW, body: BODY }), 3);
    expect(markup).toContain(`>${EYEBROW}</div>`);
    expect(lineOpacity(markup, BODY)).toBeCloseTo(1, 2);
  });

  it('draws a feature’s body beside its media, after its title’s last word', () => {
    const scene = fixtureScene(2, { eyebrow: EYEBROW, body: BODY });
    const arrives = linesTimes({ eyebrow: EYEBROW, title: 'Send from the quote', body: BODY }).body;
    expect(lineOpacity(drawn(scene, arrives - 0.05), BODY)).toBe(0);
    const markup = drawn(scene, 3);
    const title = markup.indexOf('</h1>');
    const body = markup.indexOf(BODY);
    const media = markup.indexOf('perspective:2400');
    expect(title).toBeGreaterThan(markup.indexOf(EYEBROW));
    expect(body).toBeGreaterThan(title);
    expect(media).toBeGreaterThan(body);
  });

  it('brings the bullets in after the body', () => {
    const scene = fixtureScene(2, { body: BODY });
    const { after } = linesTimes({ title: 'Send from the quote', body: BODY });
    expect(drawn(scene, after - 0.05)).toMatch(/opacity:0;transform:translateX\(-20px\)/);
  });

  it('sets the body of a full-layout feature under its title, above the media, lowered to leave it room', () => {
    const markup = drawn(fixtureScene(2, { layout: 'full', body: BODY }), 3);
    const words = /<div style="position:absolute;left:120px;top:(\d+)px;width:1500px[^"]*">(.*?)<\/p><\/div>/.exec(markup);
    expect(words?.[2]).toContain('</h1>');
    expect(words?.[2]).toContain(BODY);
    const wordsTop = Number(words?.[1]);
    const mediaTop = Number(/left:140px;top:(\d+)px;width:1640px/.exec(markup)?.[1]);
    expect(wordsTop).toBe(100);
    expect(mediaTop).toBe(370);
  });

  it('keeps a full-layout feature with a title alone where it was', () => {
    const markup = drawn(fixtureScene(2, { layout: 'full' }), 3);
    expect(markup).toContain('position:absolute;left:120px;top:150px;width:1500px');
    expect(markup).toContain('left:140px;top:330px;width:1640px;height:700px');
  });

  it('draws the outro’s body under its closing line, and its credits after it', () => {
    const scene = fixtureScene(5, { body: 'Live for every customer' });
    const markup = drawn(scene, 2.9);
    expect(markup.indexOf('Live for every customer')).toBeGreaterThan(markup.indexOf('</h1>'));
    expect(markup.indexOf('Music: none')).toBeGreaterThan(markup.indexOf('Live for every customer'));
    const closingEnd = revealEnd('Every quote, on its way.', 0.45);
    expect(lineOpacity(drawn(scene, closingEnd - 0.05), 'Live for every customer')).toBe(0);
    expect(lineOpacity(drawn(scene, closingEnd + AFTER_BODY + 0.25), 'Music: none')).toBe(0);
  });

  it('draws no body where the scene holds none', () => {
    const markup = drawn(fixtureScene(2, {}), 3);
    expect(markup).not.toContain('<p ');
  });
});

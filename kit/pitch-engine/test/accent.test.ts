// A title's accent (PRD 2030 s1): the fixture's intro, `Quotes that send **themselves**.`, drawn as markup
// once its title has settled — the marked word and the final stop in the look's accent, every other word
// in ink, and no marker on screen.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EngineProvider, SceneSequence } from '../core.tsx';
import { fontsOf, paletteOf } from '../palette.ts';
import { SceneView } from '../scenes.tsx';
import { buildTimeline, stillFrame } from '../timeline.ts';
import { presetLook } from '../../lib/pitch/settings.ts';
import { fixtureStoryboard } from '../../lib/pitch/storyboard.fixture.ts';
import type { Scene } from '../../lib/pitch/storyboard.ts';

const look = presetLook('keynote');
const palette = paletteOf(look);

/** The fixture's intro, its title being `title`, drawn alone at its still as markup. */
function introDrawn(title?: string): string {
  const fixture = fixtureStoryboard();
  const [intro] = fixture.scenes;
  if (intro?.type !== 'intro') throw new Error('the fixture opens on no intro');
  const scene: Scene = title === undefined ? intro : { ...intro, title };
  const timeline = buildTimeline({ ...fixture, scenes: [scene] });
  const [placed] = timeline.scenes;
  if (placed === undefined) throw new Error('no scene to draw');
  const engine = { timeline, palette, fonts: fontsOf(look, {}), logo: null, credits: [], clips: {}, resolve: (path: string) => path };
  const view = createElement(SceneSequence, { scene: placed, children: createElement(SceneView, { scene }) });
  return renderToStaticMarkup(createElement(EngineProvider, { engine, frame: stillFrame(placed, 30), children: view }));
}

/** Each word of the title in `markup`: its text, and the colour it is drawn in (none: the title's ink). */
function wordsOn(markup: string): { text: string; color: string | null }[] {
  const title = /<h1[^>]*>(.*)<\/h1>/.exec(markup)?.[1] ?? '';
  return [...title.matchAll(/<span data-word="" style="([^"]*)">(.*?)<\/span>(?:<\/span>)?/g)].map(([, style = '', inner = '']) => ({
    text: inner.replace(/<[^>]+>/g, ''),
    color: /(?:^|;)color:([^;]+)/.exec(style)?.[1] ?? null,
  }));
}

describe('an accented title on screen', () => {
  it('draws the marked word in the accent, the others in ink, and no asterisk', () => {
    const markup = introDrawn();
    expect(markup).not.toContain('*');
    expect(wordsOn(markup)).toEqual([
      { text: 'Quotes', color: null },
      { text: 'that', color: null },
      { text: 'send', color: null },
      { text: 'themselves.', color: palette.accent },
    ]);
  });

  it('draws the final stop in the accent, after an ink word too', () => {
    const markup = introDrawn('Invoice straight from the **worksite** today.');
    expect(markup).not.toContain('*');
    expect(markup).toContain(`today<span style="color:${palette.accent}">.</span>`);
    expect(wordsOn(markup).map(({ color }) => color)).toEqual([null, null, null, null, palette.accent, null]);
  });

  it('draws a title with no accent and no stop as before: every word in ink, nothing tinted', () => {
    const markup = introDrawn('Quotes that send themselves');
    expect(markup).not.toContain(`color:${palette.accent}">`);
    expect(wordsOn(markup).map(({ text, color }) => [text, color])).toEqual(['Quotes', 'that', 'send', 'themselves'].map((text) => [text, null]));
  });
});

// The stats scene (PRD 2030 s5): its figures count up from 0 over 1.5 s, one after another once its title
// has arrived, and settle on their values written the way `meta.locale` writes numbers; the first in the
// accent, the others in ink, each label under its figure in upper case. The fixture's stats scene, drawn
// alone as markup.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EngineProvider, SceneSequence } from '../core.tsx';
import { COUNT_SECONDS, FIGURE_STAGGER } from '../figures.ts';
import { linesTimes } from '../layout.tsx';
import { fontsOf, paletteOf } from '../palette.ts';
import { SceneView } from '../scenes.tsx';
import { buildTimeline, stillFrame } from '../timeline.ts';
import { presetLook } from '../../lib/pitch/settings.ts';
import { fixtureStoryboard } from '../../lib/pitch/storyboard.fixture.ts';
import type { Scene } from '../../lib/pitch/storyboard.ts';

const FPS = 30;
const look = presetLook('keynote');
const palette = paletteOf(look);

type Stats = Extract<Scene, { type: 'stats' }>;

/** The fixture's stats scene, with `fields` changed. */
function statsScene(fields: Partial<Stats> = {}): Stats {
  const scene = fixtureStoryboard().scenes[5];
  if (scene?.type !== 'stats') throw new Error('the fixture has no stats at scene 6');
  return { ...scene, ...fields };
}

/** `scene` drawn alone at `frame` (its still by default), its storyboard naming `locale`, as markup. */
function drawn(scene: Scene, { frame, locale }: { frame?: number; locale?: string } = {}): string {
  const fixture = fixtureStoryboard();
  const timeline = buildTimeline({ ...fixture, meta: { ...fixture.meta, ...(locale === undefined ? {} : { locale }) }, scenes: [scene] });
  const [placed] = timeline.scenes;
  if (placed === undefined) throw new Error('no scene to draw');
  const engine = { timeline, palette, fonts: fontsOf(look, {}), logo: null, credits: [], clips: {}, resolve: (path: string) => path };
  const view = createElement(SceneSequence, { scene: placed, children: createElement(SceneView, { scene }) });
  return renderToStaticMarkup(createElement(EngineProvider, { engine, frame: frame ?? stillFrame(placed, FPS), children: view }));
}

/** Each figure in `markup`: its text, its colour, and the opacity of the block holding it with its label. */
const figuresOn = (markup: string): { text: string; color: string; opacity: number }[] =>
  [...markup.matchAll(/<div data-figure="\d" style="([^"]*)"><span data-value="" style="([^"]*)">([^<]*)<\/span>/g)].map(([, block = '', value = '', text = '']) => ({
    text,
    color: /(?:^|;)color:([^;]+)/.exec(value)?.[1] ?? '',
    opacity: Number(/opacity:([\d.e-]+)/.exec(block)?.[1] ?? 1),
  }));

const textsOf = (markup: string): string[] => figuresOn(markup).map(({ text }) => text);

/** When the fixture's first figure starts counting: once its title has arrived. */
const FIRST = linesTimes({ title: statsScene().title }).after;

describe('a stats scene on screen', () => {
  it('settles on each figure, written the English way when the storyboard names no locale', () => {
    expect(textsOf(drawn(statsScene()))).toEqual(['€16,790', '92%', '1.5 days']);
  });

  it('writes the same figures the French way when the storyboard’s locale is fr', () => {
    expect(textsOf(drawn(statsScene(), { locale: 'fr' }))).toEqual(['€16 790', '92%', '1,5 days']);
  });

  it('counts each figure up from 0 once the title has arrived, the next a beat after the one before', () => {
    expect(textsOf(drawn(statsScene(), { frame: Math.floor(FIRST * FPS) }))).toEqual(['€0', '0%', '0.0 days']);
    const counting = drawn(statsScene(), { frame: Math.round((FIRST + FIGURE_STAGGER + 0.2) * FPS) });
    const [first, second, third] = figuresOn(counting);
    expect(first?.text).not.toMatch(/^€(0|16,790)$/);
    expect(second?.text).not.toMatch(/^(0|92)%$/);
    expect(third?.text).toBe('0.0 days');
    expect(third?.opacity).toBe(0);
    expect(first?.opacity).toBeGreaterThan(second?.opacity ?? 1);
  });

  it('has every figure settled by its still', () => {
    const lastDone = FIRST + 2 * FIGURE_STAGGER + COUNT_SECONDS;
    expect(textsOf(drawn(statsScene(), { frame: Math.ceil(lastDone * FPS) }))).toEqual(['€16,790', '92%', '1.5 days']);
    for (const { opacity } of figuresOn(drawn(statsScene()))) expect(opacity).toBeCloseTo(1, 4);
  });

  it('draws the first figure in the accent and the others in ink', () => {
    expect(figuresOn(drawn(statsScene())).map(({ color }) => color)).toEqual([palette.accent, palette.ink, palette.ink]);
  });

  it('draws each label under its figure, in upper case', () => {
    const markup = drawn(statsScene());
    const labels = [...markup.matchAll(/<span data-label="" style="([^"]*)">([^<]*)<\/span>/g)].map(([, style = '', text = '']) => [text, style.includes('text-transform:uppercase')]);
    expect(labels).toEqual([
      ['Billed in one go', true],
      ['Signed online', true],
      ['To get paid', true],
    ]);
    expect(markup.indexOf('Billed in one go')).toBeGreaterThan(markup.indexOf('€16,790'));
  });

  it('shows one figure alone, its eyebrow and body around the title', () => {
    const markup = drawn(statsScene({ eyebrow: 'In numbers', body: 'Measured over the first month.', items: [{ value: 3, label: 'Clicks', source: 'asked' }] }));
    expect(textsOf(markup)).toEqual(['3']);
    expect(markup.indexOf('In numbers')).toBeLessThan(markup.indexOf('<h1'));
    expect(markup.indexOf('Measured over the first month.')).toBeGreaterThan(markup.indexOf('</h1>'));
    expect(markup.indexOf('Measured over the first month.')).toBeLessThan(markup.indexOf('data-figure'));
  });
});

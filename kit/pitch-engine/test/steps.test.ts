// Steps with their own media, and the wipe's start (PRD 2030 s4): a step's media rises in over the one
// before it from the step's time and stays until the next step that brings one, its times counted from
// the step's; a step's body sits under its label; a before/after's wipe starts at its `wipeAt`, or at 35%
// of the scene. The fixture's steps scene, whose second step brings its own media, drawn alone as markup.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { sampleCamera } from '../camera.ts';
import { EngineProvider, SceneSequence } from '../core.tsx';
import { mediaSeconds } from '../fit.ts';
import { fontsOf, paletteOf } from '../palette.ts';
import { SceneView, shiftedMedia, stepLayerAt, stepLayers, wipeStart } from '../scenes.tsx';
import { buildTimeline } from '../timeline.ts';
import { presetLook } from '../../lib/pitch/settings.ts';
import { fixtureStoryboard } from '../../lib/pitch/storyboard.fixture.ts';
import type { Media, Scene } from '../../lib/pitch/storyboard.ts';

const FPS = 30;

type Steps = Extract<Scene, { type: 'steps' }>;
type BeforeAfter = Extract<Scene, { type: 'beforeAfter' }>;

/** The fixture's steps scene, with `fields` changed. */
function stepsScene(fields: Partial<Steps> = {}): Steps {
  const scene = fixtureStoryboard().scenes[3];
  if (scene?.type !== 'steps') throw new Error('the fixture has no steps at scene 4');
  return { ...scene, ...fields };
}

/** The fixture's before/after, with `fields` changed. */
function beforeAfter(fields: Partial<BeforeAfter> = {}): BeforeAfter {
  const scene = fixtureStoryboard().scenes[4];
  if (scene?.type !== 'beforeAfter') throw new Error('the fixture has no before/after at scene 5');
  return { ...scene, ...fields };
}

/** `scene` drawn alone, `seconds` into it, as markup. */
function drawn(scene: Scene, seconds: number): string {
  const timeline = buildTimeline({ ...fixtureStoryboard(), scenes: [scene] });
  const [placed] = timeline.scenes;
  if (placed === undefined) throw new Error('no scene to draw');
  const look = presetLook('keynote');
  const engine = { timeline, palette: paletteOf(look), fonts: fontsOf(look, {}), logo: null, credits: [], clips: {}, resolve: (path: string) => path };
  const view = createElement(SceneSequence, { scene: placed, children: createElement(SceneView, { scene }) });
  return renderToStaticMarkup(createElement(EngineProvider, { engine, frame: Math.round(seconds * FPS), children: view }));
}

/** The media layers on screen in `markup`, bottom to top, each with its opacity (1 when it sets none). */
const layersOn = (markup: string): [string, number][] =>
  [...markup.matchAll(/<div data-step-media="([^"]+)" style="([^"]*)">/g)].map(([, layer = '', style = '']) => [layer, Number(/opacity:([\d.e-]+)/.exec(style)?.[1] ?? 1)]);

const SHOT: Media = { kind: 'screenshot', file: 'shots/after.png' };

describe('stepLayers', () => {
  it('stacks the scene’s own media, then each step’s from its time, each kept until the next has risen over it', () => {
    const layers = stepLayers(stepsScene());
    expect(layers.map(({ step, from, until }) => [step, from, until])).toEqual([
      [null, 0, 3.6],
      [1, 3, Number.POSITIVE_INFINITY],
    ]);
  });

  it('counts a step media’s times from the step’s time: its clip’s second, its camera', () => {
    const [, layer] = stepLayers(stepsScene());
    if (layer === undefined) throw new Error('no step layer');
    expect(mediaSeconds(layer.media, 3)).toBe(10);
    expect(mediaSeconds(layer.media, 4.5)).toBe(11.5);
    expect(mediaSeconds(layer.media, 9)).toBe(13);
    expect(sampleCamera(layer.media.camera, 3).zoom).toBe(1);
    expect(sampleCamera(layer.media.camera, 4).zoom).toBe(1.8);
  });

  it('starts with the first step’s media when the scene brings none', () => {
    const scene = stepsScene({ steps: [{ label: 'Price the lines', at: 0, media: SHOT }, { label: 'Send the quote', at: 2.5, media: SHOT }] });
    delete scene.media;
    expect(stepLayers(scene).map(({ step, from }) => [step, from])).toEqual([
      [0, 0],
      [1, 2.5],
    ]);
  });

  it('keeps one media when no step brings its own', () => {
    expect(stepLayers(stepsScene({ steps: [{ label: 'Price the lines', at: 0 }, { label: 'Send the quote', at: 3 }] }))).toEqual([
      expect.objectContaining({ step: null, from: 0, until: Number.POSITIVE_INFINITY }),
    ]);
  });
});

describe('stepLayerAt', () => {
  it('shows the scene’s media until the step bringing its own, and that one from its time', () => {
    const scene = stepsScene();
    expect(stepLayerAt(scene, 0)?.step).toBeNull();
    expect(stepLayerAt(scene, 2.99)?.step).toBeNull();
    expect(stepLayerAt(scene, 3)?.step).toBe(1);
    expect(stepLayerAt(scene, 5.9)?.step).toBe(1);
  });

  it('shows nothing before the first step’s media when the scene brings none', () => {
    const scene = stepsScene({ steps: [{ label: 'Price the lines', at: 0.5, media: SHOT }, { label: 'Send the quote', at: 3, media: SHOT }] });
    delete scene.media;
    expect(stepLayerAt(scene, 0.2)).toBeUndefined();
    expect(stepLayerAt(scene, 0.5)?.step).toBe(0);
  });
});

describe('shiftedMedia', () => {
  it('moves every key, a callout’s end and the cursor by the step’s time, and leaves the rest', () => {
    const media: Media = {
      kind: 'clip',
      file: 'clips/walk.webm',
      start: 10,
      rate: 2,
      camera: [{ at: 1, zoom: 2, focus: { x: 0.5, y: 0.5 } }],
      callouts: [{ at: 0.5, until: 2, kind: 'ring', box: { x: 0, y: 0, w: 0.1, h: 0.1 } }, { at: 1, kind: 'spotlight', box: { x: 0, y: 0, w: 0.1, h: 0.1 } }],
      cursor: [{ at: 0.2, x: 0.1, y: 0.1, click: true }],
    };
    expect(shiftedMedia(media, 3)).toEqual({
      ...media,
      start: 4,
      camera: [{ at: 4, zoom: 2, focus: { x: 0.5, y: 0.5 } }],
      callouts: [{ at: 3.5, until: 5, kind: 'ring', box: { x: 0, y: 0, w: 0.1, h: 0.1 } }, { at: 4, kind: 'spotlight', box: { x: 0, y: 0, w: 0.1, h: 0.1 } }],
      cursor: [{ at: 3.2, x: 0.1, y: 0.1, click: true }],
    });
    expect(mediaSeconds(shiftedMedia(media, 3), 3)).toBe(10);
  });

  it('leaves a media with no keys its file and kind', () => {
    expect(shiftedMedia(SHOT, 2)).toEqual({ ...SHOT, start: -2 });
  });
});

describe('a steps scene on screen', () => {
  it('shows the scene’s media alone before the second step', () => {
    expect(layersOn(drawn(stepsScene(), 2))).toEqual([['scene', 1]]);
  });

  it('raises the second step’s media over the scene’s from its time, then shows it alone', () => {
    const rising = layersOn(drawn(stepsScene(), 3.1));
    expect(rising.map(([layer]) => layer)).toEqual(['scene', '1']);
    expect(rising[1]?.[1]).toBeGreaterThan(0);
    expect(rising[1]?.[1]).toBeLessThan(1);
    expect(layersOn(drawn(stepsScene(), 5))).toEqual([['1', 1]]);
  });

  it('draws a step’s body under its label, and no body where a step holds none', () => {
    const body = 'Each line priced from the catalogue';
    const markup = drawn(stepsScene({ steps: [{ label: 'Price the lines', at: 0, body }, { label: 'Send the quote', at: 3 }] }), 2);
    expect(markup.indexOf(body)).toBeGreaterThan(markup.indexOf('Price the lines'));
    expect(markup.indexOf(body)).toBeLessThan(markup.indexOf('Send the quote'));
    expect(markup.match(/<p /g)).toHaveLength(1);
  });
});

describe('wipeStart', () => {
  it('starts the wipe at its wipeAt, or at 35% of the scene', () => {
    expect(wipeStart(beforeAfter({ wipeAt: 1.8 }))).toBe(1.8);
    expect(wipeStart(beforeAfter({ wipeAt: 0 }))).toBe(0);
    expect(wipeStart(beforeAfter())).toBeCloseTo(1.4, 10);
    expect(wipeStart(beforeAfter({ duration: 10 }))).toBeCloseTo(3.5, 10);
  });
});

// The page's input (PRD 1108 s4): a storyboard and a look, checked by their own schemas, and what the
// page needs to draw them — fonts, a logo, credits and decoded clips.
import { describe, expect, it } from 'vitest';
import { presetLook } from '../lib/pitch/settings.ts';
import { changedStoryboard, fixtureStoryboard } from '../lib/pitch/storyboard.fixture.ts';
import { parseInput } from './input.ts';

describe('parseInput', () => {
  it('reads a storyboard and a partial look, filling the look from its preset', () => {
    const parsed = parseInput({ storyboard: fixtureStoryboard(), look: { preset: 'keynote', colors: { accent: '#112233' } } });
    expect(parsed.problems).toBeUndefined();
    expect(parsed.input?.look).toEqual({ ...presetLook('keynote'), colors: { ...presetLook('keynote').colors, accent: '#112233' } });
    expect(parsed.input).toMatchObject({ fonts: {}, logo: null, credits: [], clips: {} });
    expect(parsed.input?.storyboard.scenes).toHaveLength(6);
  });

  it('keeps the fonts, the logo, the credits and the decoded clips it is given', () => {
    const clip = { frames: 'frames/walk/{n}.png', fps: 30, count: 360, width: 1600, height: 1000 };
    const parsed = parseInput({
      storyboard: fixtureStoryboard(),
      look: presetLook('arcade'),
      fonts: { css: '@font-face {}', heading: '"Anton", system-ui' },
      logo: 'assets/logo.svg',
      credits: ['Music: FreePD, CC0'],
      clips: { 'clips/walk.webm': clip },
    });
    expect(parsed.input).toMatchObject({ fonts: { css: '@font-face {}', heading: '"Anton", system-ui' }, logo: 'assets/logo.svg', credits: ['Music: FreePD, CC0'], clips: { 'clips/walk.webm': clip } });
  });

  it('names every problem of the storyboard and the look with its path', () => {
    const parsed = parseInput({ storyboard: changedStoryboard('scenes.0.title', ''), look: { colors: { ink: 'blue' } } });
    expect(parsed.input).toBeUndefined();
    expect(parsed.problems).toEqual([expect.stringMatching(/^storyboard\.scenes\.0\.title: /), expect.stringMatching(/^look\.colors\.ink: a colour is #RRGGBB/)]);
  });

  it('refuses a field it does not know and a clip with no image number', () => {
    expect(parseInput({ storyboard: fixtureStoryboard(), look: {}, extra: 1 }).problems).toEqual([expect.stringMatching(/^\(top level\): /)]);
    const clips = { 'clips/walk.webm': { frames: 'frames/walk.png', fps: 30, count: 1, width: 10, height: 10 } };
    expect(parseInput({ storyboard: fixtureStoryboard(), look: {}, clips }).problems).toEqual([expect.stringMatching(/^clips\.clips\/walk\.webm\.frames: /)]);
  });
});

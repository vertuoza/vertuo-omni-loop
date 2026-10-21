// The storyboard's timeline (PRD 1108 s4): scenes back to back, each overlapping the next by the
// storyboard's transition, so one crossfades into the next.
import { describe, expect, it } from 'vitest';
import { fixtureStoryboard } from '../lib/pitch/storyboard.fixture.ts';
import { calloutPresence, sampleCamera } from './camera.ts';
import { buildTimeline, entryDelay, scenesAt, stillFrame } from './timeline.ts';

describe('buildTimeline', () => {
  it('places each scene where the one before ends, less the transition, and sums the frames', () => {
    const timeline = buildTimeline(fixtureStoryboard());
    // 3 + 4 + 6 + 6 + 4 + 3 seconds at 30 fps, five overlaps of 0.5 s.
    expect(timeline.frames).toBe(26 * 30 - 5 * 15);
    expect(timeline.scenes.map((scene) => scene.from)).toEqual([0, 75, 180, 345, 510, 615]);
    expect(timeline.scenes.map((scene) => scene.frames)).toEqual([90, 120, 180, 180, 120, 90]);
    expect(timeline.scenes.map((scene) => [scene.enter, scene.exit])).toEqual([
      [0, 15],
      [15, 15],
      [15, 15],
      [15, 15],
      [15, 15],
      [15, 0],
    ]);
  });

  it('never lets an overlap take more than half of either scene', () => {
    const storyboard = fixtureStoryboard();
    storyboard.meta.transition = 2;
    storyboard.scenes = storyboard.scenes.map((scene) => ({ ...scene, duration: scene.type === 'statement' ? 1 : scene.duration }));
    const timeline = buildTimeline(storyboard);
    expect(timeline.scenes[1]?.enter).toBe(15);
    expect(timeline.scenes[1]?.exit).toBe(15);
    expect(timeline.scenes[2]?.enter).toBe(15);
    expect(timeline.scenes[3]?.enter).toBe(60);
  });

  it('plays a single scene alone, with no overlap', () => {
    const storyboard = fixtureStoryboard();
    storyboard.scenes = storyboard.scenes.slice(0, 1);
    const timeline = buildTimeline(storyboard);
    expect(timeline.frames).toBe(90);
    expect(timeline.scenes[0]).toMatchObject({ from: 0, enter: 0, exit: 0 });
  });
});

describe('scenesAt', () => {
  const timeline = buildTimeline(fixtureStoryboard());

  it('names one scene inside it, and two in an overlap', () => {
    expect(scenesAt(timeline, 10).map((scene) => scene.index)).toEqual([0]);
    expect(scenesAt(timeline, 80).map((scene) => scene.index)).toEqual([0, 1]);
    expect(scenesAt(timeline, 90).map((scene) => scene.index)).toEqual([1]);
    expect(scenesAt(timeline, timeline.frames - 1).map((scene) => scene.index)).toEqual([5]);
    expect(scenesAt(timeline, timeline.frames)).toEqual([]);
  });
});

describe('stillFrame', () => {
  it('takes each scene 0.3 s before it starts to leave, the last one 0.3 s before the video ends', () => {
    const timeline = buildTimeline(fixtureStoryboard());
    // 0.3 s at 30 fps is 9 frames before the exit's 15-frame overlap; the outro has no exit.
    expect(timeline.scenes.map((scene) => stillFrame(scene, timeline.fps))).toEqual([66, 171, 336, 501, 606, 696]);
    const outro = timeline.scenes.at(-1);
    if (outro === undefined) throw new Error('the fixture has scenes');
    expect(stillFrame(outro, timeline.fps)).toBe(timeline.frames - 9);
    for (const scene of timeline.scenes) {
      const still = stillFrame(scene, timeline.fps);
      expect(still).toBeGreaterThanOrEqual(scene.from + entryDelay(scene));
      expect(still).toBeLessThan(scene.from + scene.frames - scene.exit);
    }
  });

  it('never takes a still before the scene\'s entrances start, however short the scene', () => {
    const storyboard = fixtureStoryboard();
    storyboard.scenes = storyboard.scenes.map((scene) => ({ ...scene, duration: 0.6 }));
    const timeline = buildTimeline(storyboard);
    const statement = timeline.scenes[1];
    if (statement === undefined) throw new Error('the fixture has a second scene');
    // 18 frames, a 9-frame overlap either side: the exit starts at frame 9, its entrances at frame 5.
    expect([statement.enter, statement.exit, entryDelay(statement)]).toEqual([9, 9, 5]);
    expect(stillFrame(statement, timeline.fps)).toBe(statement.from + 5);
  });

  it('shows a 6.5 s feature once its zoom at 3.2 s and its callout at 3.4 s have arrived', () => {
    const storyboard = fixtureStoryboard();
    const feature = storyboard.scenes[2];
    if (feature?.type !== 'feature') throw new Error('the fixture\'s third scene is a feature');
    const callout = { at: 3.4, kind: 'ring', box: { x: 0.6, y: 0.2, w: 0.2, h: 0.1 }, label: 'Send' } as const;
    const camera = [{ at: 0, zoom: 1, focus: { x: 0.5, y: 0.5 } }, { at: 3.2, zoom: 2.2, focus: { x: 0.7, y: 0.3 } }];
    storyboard.scenes[2] = { ...feature, duration: 6.5, media: { ...feature.media, camera, callouts: [callout] } };
    const timeline = buildTimeline(storyboard);
    const scene = timeline.scenes[2];
    if (scene === undefined) throw new Error('the fixture has a third scene');
    const t = (stillFrame(scene, timeline.fps) - scene.from) / timeline.fps;
    expect(t).toBeCloseTo(5.7, 5);
    expect(sampleCamera(camera, t).zoom).toBeCloseTo(2.2, 5);
    expect(calloutPresence(callout, t, timeline.fps)).toBeGreaterThan(0.99);
  });
});

// The storyboard's timeline (PRD 1108 s4): scenes back to back, each overlapping the next by the
// storyboard's transition, so one crossfades into the next.
import { describe, expect, it } from 'vitest';
import { fixtureStoryboard } from '../lib/pitch/storyboard.fixture.ts';
import { buildTimeline, scenesAt, stillFrame } from './timeline.ts';

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
  it('picks a settled frame inside each scene, before its exit starts', () => {
    const timeline = buildTimeline(fixtureStoryboard());
    for (const scene of timeline.scenes) {
      const still = stillFrame(scene, timeline.fps);
      expect(still).toBeGreaterThanOrEqual(scene.from + scene.enter);
      expect(still).toBeLessThan(scene.from + scene.frames - scene.exit);
    }
    const feature = timeline.scenes[2];
    if (feature === undefined) throw new Error('the fixture has a third scene');
    // Its entrance waits 55% of the 15-frame overlap, then 2.5 s settle it.
    expect(stillFrame(feature, 30)).toBe(180 + 8 + 75);
  });
});

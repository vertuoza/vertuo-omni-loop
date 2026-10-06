// The storyboard's timeline (PRD 1108 s4): its scenes back to back, each overlapping the next by the
// storyboard's transition so the one leaving crossfades into the one arriving. Pure: the page and its
// tests read it the same way.
import type { Scene, Storyboard } from '../lib/pitch/storyboard.ts';

export type TimelineScene = Readonly<{
  index: number;
  scene: Scene;
  /** The video's frame the scene starts on, and how many frames it lasts. */
  from: number;
  frames: number;
  /** The frames it shares with the scene before it, and with the one after it. */
  enter: number;
  exit: number;
}>;

export type Timeline = Readonly<{ fps: number; width: number; height: number; frames: number; scenes: readonly TimelineScene[] }>;

/** How far into its arriving overlap a scene's entrances start: once the scene leaving is mostly gone. */
const ENTRY_SHARE = 0.55;
/** How long after its entrances start a scene reads as settled, for its still. */
const SETTLE_SECONDS = 2.5;

/** The frames scenes `before` and `after` share: the transition, never more than half of either. */
const overlapOf = (transition: number, before: number, after: number): number => Math.min(transition, Math.floor(before / 2), Math.floor(after / 2));

/** The storyboard's scenes on the video's frames. */
export function buildTimeline(storyboard: Storyboard): Timeline {
  const { fps, width, height } = storyboard.meta;
  const transition = Math.round(storyboard.meta.transition * fps);
  const lengths = storyboard.scenes.map((scene) => Math.round(scene.duration * fps));
  const overlaps = lengths.map((length, index) => (index === 0 ? 0 : overlapOf(transition, lengths[index - 1] ?? 0, length)));
  let from = 0;
  const scenes = storyboard.scenes.map((scene, index): TimelineScene => {
    const frames = lengths[index] ?? 0;
    const placed = { index, scene, from, frames, enter: overlaps[index] ?? 0, exit: overlaps[index + 1] ?? 0 };
    from += frames - placed.exit;
    return placed;
  });
  return { fps, width, height, frames: from, scenes };
}

/** The scenes on screen at the video's frame `frame`: one, or two in an overlap, in order. */
export const scenesAt = (timeline: Timeline, frame: number): TimelineScene[] => timeline.scenes.filter((scene) => frame >= scene.from && frame < scene.from + scene.frames);

/** The frames into a scene its entrances wait for. */
export const entryDelay = (scene: TimelineScene): number => Math.round(scene.enter * ENTRY_SHARE);

/** A frame of the video where the scene has settled, before it starts to leave: its still. */
export const stillFrame = (scene: TimelineScene, fps: number): number =>
  scene.from + Math.min(entryDelay(scene) + Math.round(SETTLE_SECONDS * fps), scene.frames - scene.exit - 1);

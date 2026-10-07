// A title built word by word (PRD 1108 s4): each word springs up from below, from blurred to sharp and
// from clear to opaque, a stagger after the word before it. Pure, so a word's state at a frame is known.
import { SPRINGS, interpolate, spring } from './animation.ts';

/** Seconds between two words' starts. */
export const WORD_STAGGER = 0.07;
/** How far below its place a word starts, in ems, and how blurred, in pixels. */
const RISE_EM = 0.42;
const BLUR_PX = 14;
/** The beat after the last word starts before what follows the title arrives, in seconds. */
const AFTER_TITLE = 0.15;
/** A word reads as sharp from this far through its spring. */
const SHARP = 0.995;

/** A title's words, split on its spaces. */
export const titleWords = (title: string): string[] => title.split(/\s+/).filter((word) => word !== '');

export type WordState = Readonly<{ progress: number; opacity: number; rise: number; blur: number }>;

/** Word `index` of a title whose first word starts `delay` seconds in, at frame `frame` of its scene's entrances. */
export function wordState(frame: number, index: number, fps: number, { delay, stagger = WORD_STAGGER }: { delay: number; stagger?: number }): WordState {
  const progress = spring(frame - (delay + index * stagger) * fps, fps, SPRINGS.smooth);
  return {
    progress,
    opacity: interpolate(progress, [0, 0.6], [0, 1]),
    rise: (1 - progress) * RISE_EM,
    blur: progress < SHARP ? (1 - progress) * BLUR_PX : 0,
  };
}

/** The seconds into a scene's entrances when what follows a title starting at `delay` may arrive. */
export const revealEnd = (title: string, delay: number, stagger = WORD_STAGGER): number => delay + titleWords(title).length * stagger + AFTER_TITLE;

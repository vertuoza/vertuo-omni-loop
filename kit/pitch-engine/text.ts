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

/** What marks the accent in a title: `**word**` or `**a few words**` (PRD 2030 s1). */
const MARKER = '**';

/** A title's words, split on its spaces, without the accent markers. */
export const titleWords = (title: string): string[] => title.split(MARKER).join('').split(/\s+/).filter((word) => word !== '');

/** A word of a title, and whether the accent marks it. */
export type TitleWord = Readonly<{ text: string; accent: boolean }>;
/** A title's words, and whether it ends on a full stop, drawn apart in the accent. */
export type ParsedTitle = Readonly<{ words: TitleWord[]; stop: boolean }>;

/** `title` without its markers, and the spans of it a pair of markers holds, as `[from, to)` offsets; a marker left open marks nothing. */
function unmarked(title: string): { text: string; spans: (readonly [number, number])[] } {
  const runs = title.split(MARKER);
  const closed = runs.length % 2 === 1 ? runs.length : runs.length - 1;
  const spans: (readonly [number, number])[] = [];
  let at = 0;
  runs.forEach((run, index) => {
    if (index % 2 === 1 && index < closed) spans.push([at, at + run.length]);
    at += run.length;
  });
  return { text: runs.join(''), spans };
}

/** `title`'s words, each accented when any part of it is: a word may run across a marker. */
function markedWords(title: string): TitleWord[] {
  const { text, spans } = unmarked(title);
  return [...text.matchAll(/\S+/g)].map(({ 0: word, index: from }) => ({ text: word, accent: spans.some(([start, end]) => start < from + word.length && from < end) }));
}

/** `title` parsed into its words, each with its accent flag, and its final stop: one `.` ending it, not an ellipsis. */
export function parseTitle(title: string): ParsedTitle {
  const words = markedWords(title);
  const last = words.at(-1);
  if (last === undefined || !last.text.endsWith('.') || last.text.endsWith('..')) return { words, stop: false };
  const rest = last.text.slice(0, -1);
  return { words: rest === '' ? words.slice(0, -1) : [...words.slice(0, -1), { ...last, text: rest }], stop: true };
}

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

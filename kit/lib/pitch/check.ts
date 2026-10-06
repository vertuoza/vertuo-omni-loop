// `omni pitch check <dir>` (PRD 1108's spec, "The engine, the studio and the render"): what stops a
// storyboard before it is rendered, and what only warns.
//
// Errors: a field the schema refuses (and nothing further is checked then), a media file missing from the
// run folder or outside it, a clip that ends before it starts, an intro that is not the first scene or an
// outro that is not the last (or none), and a music sync point past its scene. Warnings: a field over its
// word count, a scene whose words take longer to read than it lasts, and a whole outside 15 to 60
// seconds. Each finding names its path in the storyboard.
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, normalize } from 'node:path';
import { messageOf } from '../narrow.ts';
import { STORYBOARD_FILE, mediaOf, parseStoryboard } from './storyboard.ts';
import type { Media, Scene, Storyboard } from './storyboard.ts';

/** One finding: where in the storyboard (`scenes.2.media.file`) and what. */
export type Finding = { path: string; message: string };
/** What the check found, and the storyboard's scenes and length in seconds (0 when it does not read). */
export type CheckReport = { errors: Finding[]; warnings: Finding[]; scenes: number; seconds: number };

const refused = (errors: Finding[]): CheckReport => ({ errors, warnings: [], scenes: 0, seconds: 0 });

/** Words a viewer reads per second of a scene. */
const READ_WORDS_PER_SECOND = 3;
/** The bounds of a pitch's length, as the Pitch settings take them. */
const LENGTH_SECONDS = Object.freeze({ min: 15, max: 60 });

/** The most words each field holds before the check warns, and what it is called in the warning. */
const WORD_LIMITS = Object.freeze({
  title: { max: 9, name: 'a title' },
  text: { max: 16, name: 'a statement' },
  bullet: { max: 6, name: 'a bullet' },
  step: { max: 5, name: 'a step' },
  cta: { max: 5, name: 'a call to action' },
  eyebrow: { max: 4, name: 'an eyebrow' },
  tag: { max: 4, name: 'a tag' },
  closing: { max: 12, name: 'a closing line' },
  label: { max: 4, name: 'a label' },
});
type Limit = keyof typeof WORD_LIMITS;

/** A piece of on-screen words: its path, its text and the limit it is held to. */
type Words = { path: string; text: string; limit: Limit };

const countWords = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;
const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;

/** The checked `storyboard.json` of the run folder `dir`, which holds one; JSON that does not read is an error. */
export function checkRunFolder(dir: string): CheckReport {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(join(dir, STORYBOARD_FILE), 'utf8'));
  } catch (error) {
    return refused([{ path: '', message: `${STORYBOARD_FILE} does not read as JSON: ${messageOf(error)}` }]);
  }
  return checkStoryboard(value, { hasFile: (file) => existsSync(join(dir, file)) });
}

/** A finding as one line: its path, then what. */
export const findingLine = ({ path, message }: Finding): string => (path ? `${path}: ${message}` : message);

/** The checked storyboard `value`, given whether a file of the run folder exists. */
export function checkStoryboard(value: unknown, { hasFile }: { hasFile: (file: string) => boolean }): CheckReport {
  const parsed = parseStoryboard(value);
  if (!parsed.storyboard) return refused(parsed.problems);
  const { storyboard } = parsed;
  const seconds = lengthOf(storyboard);
  return {
    errors: [...mediaErrors(storyboard, hasFile), ...orderErrors(storyboard.scenes), ...syncErrors(storyboard)],
    warnings: [...storyboard.scenes.flatMap(sceneWarnings), ...lengthWarnings(seconds)],
    scenes: storyboard.scenes.length,
    seconds,
  };
}

/** The storyboard's length: its scenes, less the overlap of each transition between two. */
function lengthOf({ meta, scenes }: Storyboard): number {
  const total = scenes.reduce((sum, scene) => sum + scene.duration, 0);
  return total - meta.transition * (scenes.length - 1);
}

function mediaErrors({ scenes }: Storyboard, hasFile: (file: string) => boolean): Finding[] {
  return scenes.flatMap((scene, index) => mediaOf(scene, index).flatMap(({ path, media }) => oneMediaErrors(path, media, hasFile)));
}

function oneMediaErrors(path: string, media: Media, hasFile: (file: string) => boolean): Finding[] {
  const errors: Finding[] = [];
  const outside = isAbsolute(media.file) || normalize(media.file).split(/[\\/]/)[0] === '..';
  if (outside) errors.push({ path: `${path}.file`, message: `${media.file} is outside the run folder` });
  else if (!hasFile(media.file)) errors.push({ path: `${path}.file`, message: `${media.file} is missing` });
  const { start = 0, end } = media;
  if (end !== undefined && end <= start) errors.push({ path: `${path}.end`, message: `the clip ends at ${end} s, before it starts at ${start} s` });
  return errors;
}

/** An intro first and only there, an outro last and only there. */
function orderErrors(scenes: Scene[]): Finding[] {
  const last = scenes.length - 1;
  const errors: Finding[] = [];
  scenes.forEach((scene, index) => {
    if (scene.type === 'intro' && index !== 0) errors.push(misplaced('intro', index, 'the first'));
    if (scene.type === 'outro' && index !== last) errors.push(misplaced('outro', index, 'the last'));
  });
  if (!scenes.some((scene) => scene.type === 'intro')) errors.push({ path: 'scenes', message: 'no intro: the first scene is the intro' });
  if (!scenes.some((scene) => scene.type === 'outro')) errors.push({ path: 'scenes', message: 'no outro: the last scene is the outro' });
  return errors;
}

const misplaced = (type: 'intro' | 'outro', index: number, where: string): Finding => ({
  path: `scenes.${index}`,
  message: `an ${type} at scene ${index + 1}: the ${type} is ${where} scene, and the only one`,
});

function syncErrors({ meta, scenes }: Storyboard): Finding[] {
  const sync = meta.music?.sync;
  if (!sync) return [];
  const scene = scenes[sync.scene];
  if (!scene) return [{ path: 'meta.music.sync.scene', message: `no scene ${sync.scene + 1}: the storyboard has ${scenes.length}` }];
  if (sync.at <= scene.duration) return [];
  return [{ path: 'meta.music.sync.at', message: `${sync.at} s is past the end of scene ${sync.scene + 1}, ${scene.duration} s long` }];
}

/** A scene's warnings: each field over its word count, then words that take longer to read than it lasts. */
function sceneWarnings(scene: Scene, index: number): Finding[] {
  const words = wordsOf(scene, `scenes.${index}`);
  const warnings = words.flatMap(overLimit);
  const count = words.reduce((sum, piece) => sum + countWords(piece.text), 0);
  if (count / READ_WORDS_PER_SECOND > scene.duration) {
    const needed = Math.ceil(count / READ_WORDS_PER_SECOND);
    warnings.push({ path: `scenes.${index}`, message: `${plural(count, 'word')} take about ${needed} s to read; the scene lasts ${scene.duration} s` });
  }
  return warnings;
}

function overLimit({ path, text, limit }: Words): Finding[] {
  const count = countWords(text);
  const { max, name } = WORD_LIMITS[limit];
  return count > max ? [{ path, message: `${plural(count, 'word')}; ${name} holds at most ${max}` }] : [];
}

/** Every piece of words a scene shows, with its path. */
function wordsOf(scene: Scene, at: string): Words[] {
  const piece = (key: string, text: string | undefined, limit: Limit): Words[] => (text === undefined ? [] : [{ path: `${at}.${key}`, text, limit }]);
  switch (scene.type) {
    case 'intro':
      return [...piece('eyebrow', scene.eyebrow, 'eyebrow'), ...piece('title', scene.title, 'title'), ...piece('tag', scene.tag, 'tag')];
    case 'statement':
      return piece('text', scene.text, 'text');
    case 'feature':
      return [...piece('title', scene.title, 'title'), ...(scene.bullets ?? []).flatMap((bullet, n) => piece(`bullets.${n}`, bullet, 'bullet')), ...calloutWords(scene.media, `${at}.media`)];
    case 'steps':
      return [...piece('title', scene.title, 'title'), ...scene.steps.flatMap((step, n) => piece(`steps.${n}.label`, step.label, 'step')), ...calloutWords(scene.media, `${at}.media`)];
    case 'beforeAfter':
      return [...piece('title', scene.title, 'title'), ...piece('labels.before', scene.labels?.before, 'label'), ...piece('labels.after', scene.labels?.after, 'label')];
    case 'outro':
      return [...piece('cta', scene.cta, 'cta'), ...piece('closing', scene.closing, 'closing')];
  }
}

/** The labels a media's callouts show; the schema already holds each to four words. */
function calloutWords(media: Media, at: string): Words[] {
  return (media.callouts ?? []).flatMap((callout, n) => (callout.label === undefined ? [] : [{ path: `${at}.callouts.${n}.label`, text: callout.label, limit: 'label' as const }]));
}

function lengthWarnings(seconds: number): Finding[] {
  if (seconds >= LENGTH_SECONDS.min && seconds <= LENGTH_SECONDS.max) return [];
  return [{ path: 'scenes', message: `${seconds} s in all; a pitch lasts ${LENGTH_SECONDS.min} to ${LENGTH_SECONDS.max} s` }];
}

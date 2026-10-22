// `omni pitch check <dir>` (PRD 1108's spec, "The engine, the studio and the render"): what stops a
// storyboard before it is rendered, and what only warns.
//
// Errors: a field the schema refuses (and nothing further is checked then), a media file missing from the
// run folder or outside it, a clip that ends before it starts, an intro that is not the first scene or an
// outro that is not the last (or none), a music sync point past its scene, and a title whose accent is
// left open (a `**` with no closing one, PRD 2030), and a before/after's `wipeAt` that leaves its wipe less
// than its 1.4 s (PRD 2030 s4); a step's own media is checked as a scene's. Warnings: a field over its word
// count (a body over 20, a step's body over 12, PRD 2030; the accent markers are no words), a title with
// more than one accent, a scene whose words take longer to read than it lasts (its eyebrow and body
// counted, and its steps' bodies; a stats scene's figure labels, held to four words, PRD 2030 s5), and a
// whole outside 15 to 60 seconds. A figure without its source is refused by the schema. Each finding names its path in
// the storyboard.
//
// The music's sync (PRD 2038 s2) names its scene by id: an id no scene has is an error, naming the ids
// there are; an index still reads, its error past the last scene kept, and warns to name the scene by
// its id. Two scenes with one id are refused by the schema.
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, normalize } from 'node:path';
import { messageOf, propertyOf } from '../narrow.ts';
import { STORYBOARD_FILE, WIPE_SECONDS, mediaOf, parseStoryboard, sceneIndexOf } from './storyboard.ts';
import type { Media, Scene, SceneRef, Storyboard } from './storyboard.ts';

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
  stepBody: { max: 12, name: 'a step body' },
  cta: { max: 5, name: 'a call to action' },
  eyebrow: { max: 4, name: 'an eyebrow' },
  tag: { max: 4, name: 'a tag' },
  closing: { max: 12, name: 'a closing line' },
  body: { max: 20, name: 'a body' },
  label: { max: 4, name: 'a label' },
});
type Limit = keyof typeof WORD_LIMITS;

/** A piece of on-screen words: its path, its text and the limit it is held to. */
type Words = { path: string; text: string; limit: Limit };

/** What marks a title's accent: `**word**` or `**a few words**`. */
const ACCENT_MARKER = '**';

const countWords = (text: string): number => text.split(ACCENT_MARKER).join('').trim().split(/\s+/).filter(Boolean).length;
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
    errors: [...mediaErrors(storyboard, hasFile), ...orderErrors(storyboard.scenes), ...syncErrors(storyboard), ...storyboard.scenes.flatMap(wipeErrors), ...storyboard.scenes.flatMap(accentErrors)],
    warnings: [...storyboard.scenes.flatMap(sceneWarnings), ...storyboard.scenes.flatMap(accentWarnings), ...lengthWarnings(seconds), ...syncWarnings(storyboard)],
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

/** The music's sync naming no scene, or a point past its scene's end. */
function syncErrors({ meta, scenes }: Storyboard): Finding[] {
  const sync = meta.music?.sync;
  if (!sync) return [];
  const index = sceneIndexOf(scenes, sync.scene);
  const scene = index === null ? undefined : scenes[index];
  if (index === null || !scene) return [{ path: 'meta.music.sync.scene', message: noScene(sync.scene, scenes) }];
  if (sync.at <= scene.duration) return [];
  const name = scene.id === undefined ? '' : ` (${scene.id})`;
  return [{ path: 'meta.music.sync.at', message: `${sync.at} s is past the end of scene ${index + 1}${name}, ${scene.duration} s long` }];
}

/** Why the sync's `ref` names no scene: an index past the last, or an id no scene has. */
function noScene(ref: SceneRef, scenes: Scene[]): string {
  if (typeof ref === 'number') return `no scene ${ref + 1}: the storyboard has ${scenes.length}`;
  const ids = scenes.flatMap((scene) => (scene.id === undefined ? [] : [scene.id]));
  return `no scene has the id ${ref}; ${ids.length === 0 ? `give that scene "id": "${ref}"` : `the ids are ${ids.join(', ')}`}`;
}

/** The music's sync naming its scene by index, which a scene added before it would move. */
function syncWarnings({ meta }: Storyboard): Finding[] {
  const ref = meta.music?.sync?.scene;
  if (typeof ref !== 'number') return [];
  return [{ path: 'meta.music.sync.scene', message: `scene ${ref + 1} is named by its place: name the scene by its id, so a scene added before it does not move the music` }];
}

/** Under this much short of the wipe's length, a scene's end still counts as leaving it its time. */
const WIPE_SLACK = 1e-9;

/** A before/after whose wipe starts too late to finish before the scene ends. */
function wipeErrors(scene: Scene, index: number): Finding[] {
  if (scene.type !== 'beforeAfter' || scene.wipeAt === undefined) return [];
  if (scene.duration - scene.wipeAt >= WIPE_SECONDS - WIPE_SLACK) return [];
  return [{ path: `scenes.${index}.wipeAt`, message: `the wipe starts at ${scene.wipeAt} s and takes ${WIPE_SECONDS} s; the scene ends at ${scene.duration} s` }];
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

/**
 * Where a scene's words are, by path: `*` stands for each item of a list. A scene of a type that has no
 * such field simply holds nothing there. Callout labels are held to four words by the schema already.
 */
const WORD_FIELDS: readonly (readonly [string, Limit])[] = Object.freeze([
  ['eyebrow', 'eyebrow'],
  ['title', 'title'],
  ['tag', 'tag'],
  ['text', 'text'],
  ['body', 'body'],
  ['bullets.*', 'bullet'],
  ['steps.*.label', 'step'],
  ['steps.*.body', 'stepBody'],
  ['labels.before', 'label'],
  ['labels.after', 'label'],
  ['media.callouts.*.label', 'label'],
  ['steps.*.media.callouts.*.label', 'label'],
  ['items.*.label', 'label'],
  ['cta', 'cta'],
  ['closing', 'closing'],
]);

/** Every text at `path` of `value` (`*` expanding each item of a list), with its concrete path. */
function textsAt(value: unknown, path: string[], at: string): { path: string; text: string }[] {
  const [key, ...rest] = path;
  if (key === undefined) return typeof value === 'string' ? [{ path: at, text: value }] : [];
  if (key !== '*') return textsAt(propertyOf(value, key), rest, `${at}.${key}`);
  return Array.isArray(value) ? value.flatMap((item, n) => textsAt(item, rest, `${at}.${n}`)) : [];
}

/** Every piece of words a scene shows, with its path. */
function wordsOf(scene: Scene, at: string): Words[] {
  return WORD_FIELDS.flatMap(([field, limit]) => textsAt(scene, field.split('.'), at).map((piece) => ({ ...piece, limit })));
}

/** The fields that hold a scene's title: the statement's text is its title, the outro's closing line its own. */
const TITLE_FIELDS = Object.freeze(['title', 'text', 'closing']);

/** A scene's titles, each with its path and how many accent markers it holds. */
function titlesOf(scene: Scene, index: number): { path: string; markers: number }[] {
  return TITLE_FIELDS.flatMap((field) => textsAt(scene, [field], `scenes.${index}`)).map(({ path, text }) => ({ path, markers: text.split(ACCENT_MARKER).length - 1 }));
}

/** A title whose last `**` opens an accent that never closes. */
function accentErrors(scene: Scene, index: number): Finding[] {
  return titlesOf(scene, index)
    .filter(({ markers }) => markers % 2 === 1)
    .map(({ path }) => ({ path, message: `an accent is left open: close it with another ${ACCENT_MARKER}` }));
}

/** A title with more than one accent: one word, or a few, carries it. */
function accentWarnings(scene: Scene, index: number): Finding[] {
  return titlesOf(scene, index)
    .map(({ path, markers }) => ({ path, accents: Math.floor(markers / 2) }))
    .filter(({ accents }) => accents > 1)
    .map(({ path, accents }) => ({ path, message: `${plural(accents, 'accent')}; a title holds one` }));
}

function lengthWarnings(seconds: number): Finding[] {
  if (seconds >= LENGTH_SECONDS.min && seconds <= LENGTH_SECONDS.max) return [];
  return [{ path: 'scenes', message: `${seconds} s in all; a pitch lasts ${LENGTH_SECONDS.min} to ${LENGTH_SECONDS.max} s` }];
}

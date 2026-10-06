// A pitch's storyboard (PRD 1108's spec, "The storyboard"): `storyboard.json` in the run's folder,
// `{ "storyboard": 1, meta, scenes[] }`, written by `/omni:pitch` and read by `omni pitch check`, the
// studio and the render. Every object is strict: a field the schema does not name is refused, so a typo
// never renders as a silent default.
//
// - Scenes: `intro` (eyebrow, title, tag), `statement` (one sentence), `feature` (media, at most four
//   bullets, a layout), `steps` (two to four steps driving the media), `beforeAfter` (a wipe between two
//   media) and `outro` (call to action, closing line, credits). Each lasts 1 to 20 seconds.
// - Media: a clip or a screenshot, by its path in the run's folder, with `start`, `end`, `rate`, `crop`, a
//   `device` frame, and keyframed `camera` (zoom 1 to 4 on a focus point), `callouts` (a ring or a
//   spotlight, a label of at most four words) and `cursor` (moves and clicks). Coordinates are 0..1 of
//   the media; times are seconds into the scene.
// - Meta: 30 fps, 1920×1080, the transition's length, the music and its sync point (`{ scene, at }`), and
//   the sources the words came from.
import { z } from 'zod';

export const STORYBOARD_FILE = 'storyboard.json';
const STORYBOARD_VERSION = 1;
export const SCENE_TYPES = Object.freeze(['intro', 'statement', 'feature', 'steps', 'beforeAfter', 'outro'] as const);
type SceneType = (typeof SCENE_TYPES)[number];

const text = z.string().trim().min(1);
const unit = z.number().min(0).max(1);
const seconds = z.number().min(0);
const point = z.strictObject({ x: unit, y: unit });
const box = z.strictObject({ x: unit, y: unit, w: unit, h: unit });
const words = (max: number) => text.refine((value) => value.split(/\s+/).length <= max, `at most ${max} words`);

const cameraKey = z.strictObject({ at: seconds, zoom: z.number().min(1).max(4), focus: point });
const callout = z.strictObject({
  at: seconds,
  until: seconds.optional(),
  kind: z.enum(['ring', 'spotlight']),
  box,
  label: words(4).optional(),
});
const cursorKey = z.strictObject({ at: seconds, x: unit, y: unit, click: z.boolean().optional() });

const MediaSchema = z.strictObject({
  kind: z.enum(['clip', 'screenshot']),
  file: text,
  start: seconds.optional(),
  end: seconds.optional(),
  rate: z.number().positive().max(4).optional(),
  crop: box.optional(),
  device: z.enum(['none', 'browser', 'laptop', 'phone']).optional(),
  camera: z.array(cameraKey).optional(),
  callouts: z.array(callout).optional(),
  cursor: z.array(cursorKey).optional(),
});
export type Media = z.infer<typeof MediaSchema>;

const duration = z.number().min(1).max(20);
const scene = <T extends SceneType, Shape extends z.ZodRawShape>(type: T, shape: Shape) =>
  z.strictObject({ type: z.literal(type), duration, ...shape });

const SceneSchema = z.discriminatedUnion('type', [
  scene('intro', { eyebrow: text.optional(), title: text, tag: text.optional() }),
  scene('statement', { text }),
  scene('feature', {
    title: text.optional(),
    media: MediaSchema,
    bullets: z.array(text).max(4).optional(),
    layout: z.enum(['left', 'right', 'full']).optional(),
  }),
  scene('steps', {
    title: text.optional(),
    media: MediaSchema,
    steps: z.array(z.strictObject({ label: text, at: seconds })).min(2).max(4),
  }),
  scene('beforeAfter', { title: text.optional(), before: MediaSchema, after: MediaSchema, labels: z.strictObject({ before: text, after: text }).optional() }),
  scene('outro', { cta: text, closing: text.optional(), credits: z.boolean().optional() }),
]);
export type Scene = z.infer<typeof SceneSchema>;

const MetaSchema = z.strictObject({
  fps: z.literal(30),
  width: z.literal(1920),
  height: z.literal(1080),
  transition: z.number().min(0).max(2),
  music: z.strictObject({ sync: z.strictObject({ scene: z.number().int().min(0), at: seconds }) }).optional(),
  sources: z.array(text).min(1),
});

const StoryboardSchema = z.strictObject({
  storyboard: z.literal(STORYBOARD_VERSION),
  meta: MetaSchema,
  scenes: z.array(SceneSchema).min(1),
});
export type Storyboard = z.infer<typeof StoryboardSchema>;

/** One thing wrong with a storyboard: where (`scenes.2.media.file`, or `` for the whole) and why. */
export type StoryboardProblem = { path: string; message: string };

/** The storyboard `value` holds, or every field it refuses, each with its path. */
export function parseStoryboard(value: unknown): { storyboard: Storyboard; problems?: undefined } | { problems: StoryboardProblem[]; storyboard?: undefined } {
  const parsed = StoryboardSchema.safeParse(value);
  if (parsed.success) return { storyboard: parsed.data };
  return { problems: parsed.error.issues.map((issue) => ({ path: issue.path.map(String).join('.'), message: issue.message })) };
}

/** Every media a scene shows, with the path of its object in the storyboard. */
export function mediaOf(scene: Scene, index: number): { path: string; media: Media }[] {
  const at = (key: string, media: Media) => ({ path: `scenes.${index}.${key}`, media });
  if (scene.type === 'feature' || scene.type === 'steps') return [at('media', scene.media)];
  if (scene.type === 'beforeAfter') return [at('before', scene.before), at('after', scene.after)];
  return [];
}

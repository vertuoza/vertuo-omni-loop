// A pitch's storyboard (PRD 1108's spec, "The storyboard"): `storyboard.json` in the run's folder,
// `{ "storyboard": 1, meta, scenes[] }`, written by `/omni:pitch` and read by `omni pitch check`, the
// studio and the render. Every object is strict: a field the schema does not name is refused, so a typo
// never renders as a silent default.
//
// - Scenes: `intro` (eyebrow, title, tag), `statement` (one sentence), `feature` (media, at most four
//   bullets, a layout), `steps` (two to four steps driving the media), `beforeAfter` (a wipe between two
//   media) and `outro` (call to action, closing line, credits). Each lasts 1 to 20 seconds.
// - Supporting lines (PRD 2030): the statement, feature, steps and before/after take an `eyebrow` above
//   their title and a `body` under it, one plain sentence; the outro a `body` under its closing line,
//   and the `team` that built the feature, the words after "Built by" as the person gave them.
// - Steps with their own media (PRD 2030 s4): a step takes a `body` under its label and a `media` of its
//   own, whose times count from the step's `at`; the scene's `media` is then optional when every step
//   brings one. The before/after takes `wipeAt`, the second into the scene its wipe starts.
// - Figures (PRD 2030 s5): a `stats` scene holds an eyebrow, title and body, each optional, and 1 to 3
//   `items`, each a value with its prefix, suffix and decimals (0 to 2), its label, and its `source`:
//   where the figure came from, `spec`, `release` (the release note) or `asked` (the person gave it).
//   An item without a source is refused. `meta.locale`, a BCP 47 tag, says how figures are written.
// - Media: a clip or a screenshot, by its path in the run's folder, with `start`, `end`, `rate`, `crop`, a
//   `device` frame, and keyframed `camera` (zoom 1 to 4 on a focus point), `callouts` (a ring or a
//   spotlight, a label of at most four words) and `cursor` (moves and clicks). Coordinates are 0..1 of
//   the media; times are seconds into the scene.
// - Meta: 30 fps, 1920×1080, the transition's length, the music, the sources the words came from, and the
//   locale figures are written for (`en` when absent).
// - Scene ids and the music (PRD 2038 s2): a scene takes an optional `id` (lower-case letters, digits and
//   hyphens, 1 to 32 characters), each its own. `meta.music` takes the `track` the provider offers, by
//   title, and a `sync: { scene, at, cue? }`: `scene` a scene's id or, as before, its index; `at` seconds
//   into that scene; `cue` seconds into the track, the moment of it that plays at `at`.
import { z } from 'zod';

export const STORYBOARD_FILE = 'storyboard.json';
const STORYBOARD_VERSION = 1;
export const SCENE_TYPES = Object.freeze(['intro', 'statement', 'feature', 'steps', 'beforeAfter', 'stats', 'outro'] as const);
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

/** How long the before/after's wipe takes, in seconds. */
export const WIPE_SECONDS = 1.4;

/** A scene's id, which the music's sync names it by: lower-case letters, digits and hyphens. */
const sceneId = z.string().regex(/^[a-z0-9-]{1,32}$/, 'lower-case letters, digits and hyphens, 1 to 32 characters');

const duration = z.number().min(1).max(20);
const scene = <T extends SceneType, Shape extends z.ZodRawShape>(type: T, shape: Shape) =>
  z.strictObject({ type: z.literal(type), id: sceneId.optional(), duration, ...shape });

/** Where a figure came from: the spec, the release note, or the person, asked. */
const FIGURE_SOURCES =Object.freeze(['spec', 'release', 'asked'] as const);

/** A figure of a stats scene: its prefix and suffix kept as written, spaces included. */
const FigureSchema = z.strictObject({
  value: z.number(),
  prefix: z.string().min(1).optional(),
  suffix: z.string().min(1).optional(),
  decimals: z.number().int().min(0).max(2).optional(),
  label: text,
  source: z.enum(FIGURE_SOURCES, { error: 'where the figure came from: spec, release or asked' }),
});

/** A scene's supporting lines: the small line above its title, and the sentence under it. */
const lines = { eyebrow: text.optional(), body: text.optional() };

const SceneSchema = z.discriminatedUnion('type', [
  scene('intro', { eyebrow: text.optional(), title: text, tag: text.optional() }),
  scene('statement', { text, ...lines }),
  scene('feature', {
    title: text.optional(),
    ...lines,
    media: MediaSchema,
    bullets: z.array(text).max(4).optional(),
    layout: z.enum(['left', 'right', 'full']).optional(),
  }),
  scene('steps', {
    title: text.optional(),
    ...lines,
    media: MediaSchema.optional(),
    steps: z.array(z.strictObject({ label: text, at: seconds, body: text.optional(), media: MediaSchema.optional() })).min(2).max(4),
  }).refine((steps) => steps.media !== undefined || steps.steps.every((step) => step.media !== undefined), 'a steps scene shows a media: give the scene one, or every step its own'),
  scene('beforeAfter', {
    title: text.optional(),
    ...lines,
    before: MediaSchema,
    after: MediaSchema,
    labels: z.strictObject({ before: text, after: text }).optional(),
    wipeAt: seconds.optional(),
  }),
  scene('stats', { title: text.optional(), ...lines, items: z.array(FigureSchema).min(1).max(3) }),
  scene('outro', { cta: text, closing: text.optional(), body: text.optional(), team: text.optional(), credits: z.boolean().optional() }),
]);
export type Scene = z.infer<typeof SceneSchema>;

/** Whether `tag` is a BCP 47 language tag. */
function isLanguageTag(tag: string): boolean {
  try {
    return Intl.getCanonicalLocales(tag).length === 1;
  } catch {
    return false;
  }
}

const MetaSchema = z.strictObject({
  fps: z.literal(30),
  width: z.literal(1920),
  height: z.literal(1080),
  transition: z.number().min(0).max(2),
  music: z
    .strictObject({
      track: text.optional(),
      sync: z.strictObject({ scene: z.union([sceneId, z.number().int().min(0)]), at: seconds, cue: seconds.optional() }).optional(),
    })
    .optional(),
  sources: z.array(text).min(1),
  locale: z.string().refine(isLanguageTag, 'a BCP 47 language tag, such as en or fr-BE').optional(),
});

/** Two scenes sharing an id: the second is refused, naming the first. */
function sharedIds(scenes: readonly { id?: string | undefined }[], context: z.RefinementCtx): void {
  const first = new Map<string, number>();
  scenes.forEach(({ id }, index) => {
    if (id === undefined) return;
    const earlier = first.get(id);
    if (earlier === undefined) first.set(id, index);
    else context.addIssue({ code: 'custom', path: [index, 'id'], message: `scenes.${earlier}.id and scenes.${index}.id are both ${id}: each scene has an id of its own` });
  });
}

const StoryboardSchema = z.strictObject({
  storyboard: z.literal(STORYBOARD_VERSION),
  meta: MetaSchema,
  scenes: z.array(SceneSchema).min(1).superRefine(sharedIds),
});
export type Storyboard = z.infer<typeof StoryboardSchema>;
/** How the music's sync names its scene: by its id, or by its index (which the check warns about). */
export type SceneRef = string | number;

/** The index of the scene `ref` names, by id or by index, or null when there is none. */
export function sceneIndexOf(scenes: readonly Scene[], ref: SceneRef): number | null {
  const index = typeof ref === 'number' ? ref : scenes.findIndex((scene) => scene.id === ref);
  return index >= 0 && index < scenes.length ? index : null;
}

/** One thing wrong with a storyboard: where (`scenes.2.media.file`, or `` for the whole) and why. */
export type StoryboardProblem = { path: string; message: string };

/** The storyboard `value` holds, or every field it refuses, each with its path. */
export function parseStoryboard(value: unknown): { storyboard: Storyboard; problems?: undefined } | { problems: StoryboardProblem[]; storyboard?: undefined } {
  const parsed = StoryboardSchema.safeParse(value);
  if (parsed.success) return { storyboard: parsed.data };
  return { problems: parsed.error.issues.map((issue) => ({ path: issue.path.map(String).join('.'), message: issue.message })) };
}

/** Every media a scene shows, with the path of its object in the storyboard: a steps scene's own, then each step's. */
export function mediaOf(scene: Scene, index: number): { path: string; media: Media }[] {
  const at = (key: string, media: Media) => ({ path: `scenes.${index}.${key}`, media });
  if (scene.type === 'feature') return [at('media', scene.media)];
  if (scene.type === 'steps') {
    const own = scene.media === undefined ? [] : [at('media', scene.media)];
    return [...own, ...scene.steps.flatMap((step, n) => (step.media === undefined ? [] : [at(`steps.${n}.media`, step.media)]))];
  }
  if (scene.type === 'beforeAfter') return [at('before', scene.before), at('after', scene.after)];
  return [];
}

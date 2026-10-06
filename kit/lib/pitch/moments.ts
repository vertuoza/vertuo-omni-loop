// A pitch's filmed moments (PRD 1108's spec, "4. Filmed moments"). `/omni:pitch` writes the walk-through as
// `walk.json` in the run's folder, a list of steps on production; `omni pitch film` plays it in a browser,
// films it into `walk.webm`, and writes `moments.json`: for each step that acts on an element, its time in the clip and the
// box of that element, as 0..1 of the clip. The storyboard's camera, callouts and cursor come from it,
// never from guessed coordinates.
//
// The walk-through only looks: a step that would click something whose words save, send, delete or change
// anything (or a submit button) is refused before it is played, and typed text never holds a line break, so
// nothing is ever sent.
import { z } from 'zod';

export const WALK_FILE = 'walk.json';
export const MOMENTS_FILE = 'moments.json';
/** The walk-through's clip, remuxed so the engine's page seeks it frame by frame. */
export const WALK_CLIP = 'walk.webm';
/** The size the walk-through is filmed at: the video's own. */
export const FILM_SIZE = Object.freeze({ width: 1920, height: 1080 });

const text = z.string().trim().min(1);
const name = z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/, 'a moment is named in lower case, digits and dashes, 1 to 40 characters');
const pause = z.number().min(0).max(5).optional();
const http = z.url({ protocol: /^https?$/, error: 'an http or https address' });
const onElement = { moment: name, target: text, pause };

const StepSchema = z.discriminatedUnion('do', [
  z.strictObject({ do: z.literal('goto'), url: http, pause }),
  z.strictObject({ do: z.literal('hover'), ...onElement }),
  z.strictObject({ do: z.literal('click'), ...onElement }),
  z.strictObject({ do: z.literal('scroll'), ...onElement }),
  z.strictObject({ do: z.literal('type'), ...onElement, text: z.string().min(1).max(200).refine((value) => !/[\r\n]/.test(value), 'typed text never holds a line break: nothing is ever sent') }),
  z.strictObject({ do: z.literal('wait'), seconds: z.number().min(0.1).max(5) }),
]);
export type WalkStep = z.infer<typeof StepSchema>;

const WalkSchema = z
  .strictObject({ walk: z.literal(1), url: http, steps: z.array(StepSchema).min(1).max(40) })
  .refine(({ steps }) => {
    const named = steps.flatMap((step) => ('moment' in step ? [step.moment] : []));
    return new Set(named).size === named.length;
  }, 'each moment is named once');
export type Walk = z.infer<typeof WalkSchema>;

/** The walk-through `value` holds, or every field it refuses, as `<path>: <why>`. */
export function parseWalk(value: unknown): { walk: Walk; errors?: undefined } | { errors: string[]; walk?: undefined } {
  const parsed = WalkSchema.safeParse(value);
  if (parsed.success) return { walk: parsed.data };
  return { errors: parsed.error.issues.map((issue) => `${issue.path.map(String).join('.') || WALK_FILE}: ${issue.message}`) };
}

const unit = z.number().min(0).max(1);
const BoxSchema = z.strictObject({ x: unit, y: unit, w: unit, h: unit });
export type Box = z.infer<typeof BoxSchema>;

const MomentSchema = z.strictObject({
  name,
  do: z.enum(['hover', 'click', 'scroll', 'type']),
  at: z.number().min(0),
  box: BoxSchema,
  focus: z.strictObject({ x: unit, y: unit }),
  zoom: z.number().min(1).max(4),
});
export type Moment = z.infer<typeof MomentSchema>;

const MomentsSchema = z.strictObject({
  moments: z.literal(1),
  clip: z.literal(WALK_CLIP),
  width: z.literal(FILM_SIZE.width),
  height: z.literal(FILM_SIZE.height),
  seconds: z.number().positive(),
  steps: z.array(MomentSchema),
});
export type Moments = z.infer<typeof MomentsSchema>;

/** The moments `value` holds, or null when it is out of shape. */
export const parseMoments = (value: unknown): Moments | null => {
  const parsed = MomentsSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

const round = (value: number, places = 4): number => Math.round(value * 10 ** places) / 10 ** places;
const clampUnit = (value: number): number => Math.min(1, Math.max(0, value));

/** An element's box in the page's pixels, as 0..1 of a `width` × `height` clip, cut to the clip. */
export function boxOf(rect: { x: number; y: number; width: number; height: number }, { width, height }: { width: number; height: number }): Box {
  const left = clampUnit(rect.x / width);
  const top = clampUnit(rect.y / height);
  const right = clampUnit((rect.x + rect.width) / width);
  const bottom = clampUnit((rect.y + rect.height) / height);
  return { x: round(left), y: round(top), w: round(right - left), h: round(bottom - top) };
}

/** How far the camera zooms on a box: until it fills about half the frame, between 1 and 3. */
const ZOOM = Object.freeze({ fill: 0.5, min: 1, max: 3 });

/** Where the camera looks to show `box`: its centre, and a zoom that makes it fill about half the frame. */
export function cameraOn(box: Box): { focus: { x: number; y: number }; zoom: number } {
  const side = Math.max(box.w, box.h, 0.01);
  const zoom = Math.min(ZOOM.max, Math.max(ZOOM.min, ZOOM.fill / side));
  return { focus: { x: round(box.x + box.w / 2), y: round(box.y + box.h / 2) }, zoom: round(zoom, 1) };
}

/** Words on a control that save, send, delete or change something, in English and in French. */
const CHANGING_WORDS = Object.freeze([
  'save', 'submit', 'send', 'delete', 'remove', 'archive', 'invite', 'pay', 'buy', 'purchase', 'order', 'confirm', 'publish',
  'create', 'add', 'update', 'apply', 'approve', 'reject', 'validate', 'upload', 'import', 'duplicate', 'restore', 'sign out', 'log out',
  'enregistrer', 'sauvegarder', 'envoyer', 'supprimer', 'archiver', 'inviter', 'payer', 'acheter', 'commander', 'confirmer', 'publier',
  'créer', 'ajouter', 'modifier', 'appliquer', 'approuver', 'valider', 'refuser', 'importer', 'dupliquer', 'restaurer', 'déconnexion',
]);

const wordIn = (haystack: string, word: string): boolean => new RegExp(`(^|[^\\p{L}])${word}([^\\p{L}]|$)`, 'u').test(haystack);

/** What a walk-through reads of an element before it clicks it: its words and whether it submits a form. */
export type ElementFacts = { words: string; submits: boolean };

/** Why a click on an element would change production, or null when it only looks. */
export function changingClick({ words, submits }: ElementFacts): string | null {
  if (submits) return 'it submits a form';
  const lower = words.toLowerCase().replace(/\s+/g, ' ');
  const word = CHANGING_WORDS.find((candidate) => wordIn(lower, candidate));
  return word === undefined ? null : `its words say "${word}"`;
}

// A product's Pitch settings (PRD 1108 s1, spec "1. Pitch settings, per product"): the one `pitch` value
// a product carries (supabase/migrations/20261107090000_pitch_settings.sql), read by the CLI and the
// Omni page alike, so both parse it here.
//
// - **Look:** four colour tokens (ink, paper, accent, cta), a Heading font (titles) and a Text font
//   (description, bullets, labels), each a Google Fonts family or a file uploaded to the product, a logo
//   (`asset:<name>`, a file in the product's folder of the `pitch-assets` bucket) and a theme. Two
//   presets, Arcade and Keynote (PRD 859's two looks), fill the whole look; `preset` names the one a look
//   was filled from.
// - **Voice:** a preset and free instructions, at most 600 characters.
// - **Intro / outro:** the intro's eyebrow; the outro's call to action and whether credits show.
// - **Music:** a provider and its options. Which providers exist is the providers' registry's business,
//   not this schema's: a name it does not know falls back there.
// - **Length:** the video's bounds, 15 to 60 seconds.
//
// A stored value may be partial: what it leaves out comes from its look's preset, then from the defaults.
// parsePitchSettings() fills it, then refuses anything out of shape, naming each field.
import { z } from 'zod';

export const PITCH_PRESETS = Object.freeze(['arcade', 'keynote'] as const);
export type PitchPreset = (typeof PITCH_PRESETS)[number];

/** The preset a product with no settings, and a repository with no product, reads. */
export const DEFAULT_PRESET: PitchPreset = 'arcade';

export const VOICE_PRESETS = Object.freeze(['confident-warm', 'playful', 'formal', 'hype'] as const);

const INSTRUCTIONS_MAX = 600;
const WORDS_MAX = 60;
const LENGTH = Object.freeze({ min: 15, max: 60 });

const COLOUR = 'a colour is #RRGGBB, like #08104D';
const SECONDS = `the length is ${LENGTH.min} to ${LENGTH.max} seconds`;
const OBJECT = 'an object';

const section = <T extends z.ZodRawShape>(shape: T) => z.object(shape, { error: OBJECT });
const colour = z.string({ error: COLOUR }).regex(/^#[0-9A-Fa-f]{6}$/, { error: COLOUR });
const words = z.string({ error: `at most ${WORDS_MAX} characters` }).max(WORDS_MAX, { error: `at most ${WORDS_MAX} characters` });
const seconds = z.number({ error: SECONDS }).int({ error: SECONDS }).min(LENGTH.min, { error: SECONDS }).max(LENGTH.max, { error: SECONDS });
const asset = (error: string) => z.string({ error }).regex(/^asset:[^/\\]{1,120}$/, { error });

const FAMILY = 'a font family is 1 to 80 characters';
const WEIGHT = 'a weight is 100 to 900, in hundreds';
const PROVIDER = 'a provider is a name of 1 to 40 characters';
const provider = z.string({ error: PROVIDER }).trim().min(1, { error: PROVIDER }).max(40, { error: PROVIDER });

const FontSchema = section({
  provider,
  family: z.string({ error: FAMILY }).trim().min(1, { error: FAMILY }).max(80, { error: FAMILY }),
  weight: z.number({ error: WEIGHT }).int({ error: WEIGHT }).min(100, { error: WEIGHT }).max(900, { error: WEIGHT }).multipleOf(100, { error: WEIGHT }),
});

const LookSchema = section({
  preset: z.enum(PITCH_PRESETS, { error: `one of ${PITCH_PRESETS.join(', ')}` }),
  colors: section({ ink: colour, paper: colour, accent: colour, cta: colour }),
  heading: FontSchema,
  text: FontSchema,
  logo: asset('a logo is a file uploaded to the product, asset:<name>').nullable(),
  theme: z.enum(['light', 'dark'], { error: 'light or dark' }),
});

const OPTION = 'an option is at most 120 characters';

const PitchSettingsSchema = z.object(
  {
    look: LookSchema,
    voice: section({
      preset: z.enum(VOICE_PRESETS, { error: `one of ${VOICE_PRESETS.join(', ')}` }),
      instructions: z.string({ error: `at most ${INSTRUCTIONS_MAX} characters` }).max(INSTRUCTIONS_MAX, { error: `at most ${INSTRUCTIONS_MAX} characters` }),
    }),
    intro: section({ eyebrow: words }),
    outro: section({ cta: words, credits: z.boolean({ error: 'credits show or not: true or false' }) }),
    music: section({
      provider,
      mood: z.string({ error: OPTION }).max(120, { error: OPTION }).optional(),
      file: asset('a music file is a file uploaded to the product, asset:<name>').optional(),
    }),
    length: section({ min: seconds, max: seconds }).refine(({ min, max }) => min <= max, { error: 'the shortest is longer than the longest' }),
  },
  { error: 'the Pitch settings are an object' },
);

export type PitchSettings = z.infer<typeof PitchSettingsSchema>;
export type PitchLook = PitchSettings['look'];

const LOOKS: Readonly<Record<PitchPreset, PitchLook>> = Object.freeze({
  arcade: {
    preset: 'arcade',
    colors: { ink: '#E7E7FF', paper: '#07071A', accent: '#4EE1FF', cta: '#FFD23F' },
    heading: { provider: 'google-fonts', family: 'Anton', weight: 400 },
    text: { provider: 'google-fonts', family: 'Inter', weight: 500 },
    logo: null,
    theme: 'dark',
  },
  keynote: {
    preset: 'keynote',
    colors: { ink: '#0B0B12', paper: '#FBFBFD', accent: '#6D28D9', cta: '#DB2777' },
    heading: { provider: 'google-fonts', family: 'Inter', weight: 900 },
    text: { provider: 'google-fonts', family: 'Inter', weight: 500 },
    logo: null,
    theme: 'light',
  },
});

/** The whole look a preset fills, as a copy of its own. */
export const presetLook = (preset: PitchPreset): PitchLook => structuredClone(LOOKS[preset]);

/** The settings a product starts with: the default preset's look and every section's default. */
export function defaultPitchSettings(preset: PitchPreset = DEFAULT_PRESET): PitchSettings {
  return {
    look: presetLook(preset),
    voice: { preset: 'confident-warm', instructions: '' },
    intro: { eyebrow: 'New' },
    outro: { cta: 'Available now', credits: true },
    music: { provider: 'none' },
    length: { min: 20, max: 40 },
  };
}

/** The preset a look was filled from: what PRD 859's two looks called it. */
export const presetOf = (settings: PitchSettings): PitchPreset => settings.look.preset;

type Plain = Record<string, unknown>;

const isPlain = (value: unknown): value is Plain => typeof value === 'object' && value !== null && !Array.isArray(value);

/** `over` laid on `base`, object by object; anything else `over` holds replaces `base`'s. */
function overlay(base: unknown, over: unknown): unknown {
  if (over === undefined) return base;
  if (!isPlain(base) || !isPlain(over)) return over;
  const merged: Plain = { ...base };
  for (const [key, value] of Object.entries(over)) merged[key] = overlay(base[key], value);
  return merged;
}

/** The preset a stored value's look names, or the default when it names none it knows. */
function storedPreset(value: Plain): PitchPreset {
  const look = value['look'];
  const named = isPlain(look) ? look['preset'] : undefined;
  return PITCH_PRESETS.find((preset) => preset === named) ?? DEFAULT_PRESET;
}

export type ParsedPitchSettings = { ok: true; settings: PitchSettings } | { ok: false; errors: string[] };

/**
 * A stored or submitted `pitch` value, filled from its look's preset and the defaults, or every error
 * in it as `<path>: <what it must be>`. Nothing (null, undefined) reads as the defaults.
 */
export function parsePitchSettings(value: unknown): ParsedPitchSettings {
  const stored = value ?? {};
  const filled = isPlain(stored) ? overlay(defaultPitchSettings(storedPreset(stored)), stored) : stored;
  const result = PitchSettingsSchema.safeParse(filled);
  if (result.success) return { ok: true, settings: result.data };
  const errors = result.error.issues.map((issue) => `${issue.path.join('.') || '(top level)'}: ${issue.message}`);
  return { ok: false, errors: [...new Set(errors)] };
}

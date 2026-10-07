import { presetLook, type PitchPreset, type PitchSettings } from 'vertuo-omni-plan/kit/lib/pitch/settings.ts';

// A product's Pitch section as pure data (PRD 1108 s2, spec "1. Pitch settings, per product"): the
// choices each field offers, the edits the form makes to a draft of the settings, and the page's state
// (the settings as saved, the draft being edited, a save or an upload on its way, what was refused).
// The draft is the whole settings, filled (kit/lib/pitch/settings.ts): Save sends it as it is, and
// store.ts's setPitch() parses it again before the database sees it.

/** The voice presets, in the spec's order, as the page names them. */
export const VOICES = [
  { value: 'confident-warm', label: 'Confident & warm' },
  { value: 'playful', label: 'Playful' },
  { value: 'formal', label: 'Formal' },
  { value: 'hype', label: 'Hype (inside only)' },
] as const;

/** The music providers the page offers (kit/lib/pitch/providers/music/): an unknown one falls back there. */
export const MUSIC_PROVIDERS = [
  { value: 'none', label: 'No music' },
  { value: 'freepd', label: 'Free music (FreePD, public domain)' },
  { value: 'file', label: 'Our own track' },
] as const;

/** FreePD's moods, the five the music provider knows (settled item s5-02). */
export const MOODS = [
  { value: 'upbeat', label: 'Upbeat' },
  { value: 'calm', label: 'Calm' },
  { value: 'epic', label: 'Epic' },
  { value: 'playful', label: 'Playful' },
  { value: 'electronic', label: 'Electronic' },
] as const;

/** The fonts providers the page offers (kit/lib/pitch/providers/fonts/). */
export const FONT_PROVIDERS = [
  { value: 'google-fonts', label: 'Google Fonts' },
  { value: 'system', label: 'System font' },
  { value: 'file', label: 'Uploaded file' },
] as const;

export const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const;

export const THEMES = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const;

export const COLOUR_TOKENS = [
  { value: 'ink', label: 'Ink' },
  { value: 'paper', label: 'Paper' },
  { value: 'accent', label: 'Accent' },
  { value: 'cta', label: 'Call to action' },
] as const;

export type ColourToken = (typeof COLOUR_TOKENS)[number]['value'];
export type FontRole = 'heading' | 'text';
export type Font = PitchSettings['look']['heading'];

/** Where an uploaded file goes in the settings: the logo, a font's file, or the music's track. */
export type AssetTarget = 'logo' | FontRole | 'music';

/** The label of `value` among `choices`, or the value itself when it is none of them. */
export function labelOf(choices: readonly { value: string; label: string }[], value: string | undefined): string {
  return choices.find((c) => c.value === value)?.label ?? value ?? '';
}

/** A file reference (`asset:logo.svg`) as the page names it: the file's name. */
export const fileNameOf = (ref: string | null | undefined): string | null => (ref?.startsWith('asset:') ? ref.slice('asset:'.length) : null);

// ── Edits to a draft ─────────────────────────────────────────────────────────────

type Section = Exclude<keyof PitchSettings, 'look'>;

/** `pitch` with `part` laid over one of its sections. */
export function withSection<K extends Section>(pitch: PitchSettings, key: K, part: Partial<PitchSettings[K]>): PitchSettings {
  return { ...pitch, [key]: { ...pitch[key], ...part } };
}

export function withColour(pitch: PitchSettings, token: ColourToken, value: string): PitchSettings {
  return { ...pitch, look: { ...pitch.look, colors: { ...pitch.look.colors, [token]: value.toUpperCase() } } };
}

export function withTheme(pitch: PitchSettings, theme: PitchSettings['look']['theme']): PitchSettings {
  return { ...pitch, look: { ...pitch.look, theme } };
}

/**
 * `pitch` with one of its fonts changed. Leaving an uploaded file for a named family brings back the
 * preset's family, since a file's name is no family a provider can load.
 */
export function withFont(pitch: PitchSettings, role: FontRole, part: Partial<Font>): PitchSettings {
  const font = { ...pitch.look[role], ...part };
  const family = font.provider !== 'file' && fileNameOf(font.family) ? presetLook(pitch.look.preset)[role].family : font.family;
  return { ...pitch, look: { ...pitch.look, [role]: { ...font, family } } };
}

/** `pitch` once the file `asset` was uploaded for `target`: a font or a track switches to its file. */
export function withAsset(pitch: PitchSettings, target: AssetTarget, asset: string): PitchSettings {
  if (target === 'logo') return { ...pitch, look: { ...pitch.look, logo: asset } };
  if (target === 'music') return withSection(pitch, 'music', { provider: 'file', file: asset });
  return withFont(pitch, target, { provider: 'file', family: asset });
}

/** The music section once its provider is chosen: FreePD starts on a mood. */
export function withMusicProvider(pitch: PitchSettings, provider: string): PitchSettings {
  const mood = provider === 'freepd' ? pitch.music.mood ?? MOODS[0].value : pitch.music.mood;
  return withSection(pitch, 'music', mood === undefined ? { provider } : { provider, mood });
}

/** A number field's text as the settings hold it: a bound the parser refuses stays one it names. */
export const secondsOf = (text: string): number => (text.trim() === '' ? Number.NaN : Number(text));

// ── The section's state ──────────────────────────────────────────────────────────

export interface PitchFormState {
  /** The settings as the database holds them. */
  saved: PitchSettings;
  /** The settings as the form shows them. */
  draft: PitchSettings;
  /** A save or an upload is on its way: the form waits. */
  busy: boolean;
  /** What the last save or upload was refused with, or null. */
  refusal: string | null;
  /** What the last step did, in a few words, or null. */
  notice: string | null;
}

export type PitchFormAction =
  | { type: 'edit'; draft: PitchSettings }
  | { type: 'preset'; preset: PitchPreset }
  | { type: 'busy' }
  | { type: 'uploaded'; target: AssetTarget; asset: string }
  | { type: 'saved'; pitch: PitchSettings }
  | { type: 'refused'; message: string }
  | { type: 'reset' };

export const SAVED = 'Saved.';
export const UPLOADED = 'Uploaded. Save to keep it.';

export const initialPitchForm = (pitch: PitchSettings): PitchFormState => ({ saved: pitch, draft: pitch, busy: false, refusal: null, notice: null });

/** Whether the draft differs from what is saved. */
export const isDirty = (state: PitchFormState): boolean => JSON.stringify(state.draft) !== JSON.stringify(state.saved);

/** The preset's whole look, keeping the product's own logo. */
function presetDraft(draft: PitchSettings, preset: PitchPreset): PitchSettings {
  return { ...draft, look: { ...presetLook(preset), logo: draft.look.logo } };
}

export function pitchFormReducer(state: PitchFormState, action: PitchFormAction): PitchFormState {
  switch (action.type) {
    case 'edit':
      return { ...state, draft: action.draft, refusal: null, notice: null };
    case 'preset':
      return { ...state, draft: presetDraft(state.draft, action.preset), refusal: null, notice: null };
    case 'busy':
      return { ...state, busy: true, refusal: null, notice: null };
    case 'uploaded':
      return { ...state, draft: withAsset(state.draft, action.target, action.asset), busy: false, notice: UPLOADED };
    case 'saved':
      return { ...initialPitchForm(action.pitch), notice: SAVED };
    case 'refused':
      return { ...state, busy: false, refusal: action.message };
    case 'reset':
      return initialPitchForm(state.saved);
  }
}

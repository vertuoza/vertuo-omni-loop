import { describe, expect, it } from 'vitest';
import { defaultPitchSettings, parsePitchSettings, presetLook } from 'vertuo-omni-plan/kit/lib/pitch/settings.ts';
import {
  fileNameOf, initialPitchForm, isDirty, labelOf, MOODS, pitchFormReducer, SAVED, secondsOf, UPLOADED, VOICES,
  withAsset, withColour, withFont, withMusicProvider, withSection, withTheme,
} from './pitch-form-model';

// A product's Pitch section as pure data (PRD 1108 s2): the choices, the edits the form makes to its
// draft (each one still parsing as settings), and the section's state through a save or an upload.

const ARCADE = defaultPitchSettings('arcade');

const parses = (pitch: unknown) => parsePitchSettings(pitch).ok;

describe('the choices', () => {
  it('name the spec\'s four voices, Confident & warm first, and FreePD\'s five moods', () => {
    expect(VOICES.map((v) => v.value)).toEqual(['confident-warm', 'playful', 'formal', 'hype']);
    expect(MOODS.map((m) => m.value)).toEqual(['upbeat', 'calm', 'epic', 'playful', 'electronic']);
  });

  it('label a value, or say it as it is when it is none of them', () => {
    expect(labelOf(VOICES, 'hype')).toBe('Hype (inside only)');
    expect(labelOf(VOICES, 'whisper')).toBe('whisper');
    expect(labelOf(VOICES, undefined)).toBe('');
  });

  it('name an uploaded file by its name, and nothing else as one', () => {
    expect(fileNameOf('asset:logo.svg')).toBe('logo.svg');
    expect(fileNameOf('Inter')).toBeNull();
    expect(fileNameOf(null)).toBeNull();
  });
});

describe('the edits', () => {
  it('lay a part over one section and keep the rest', () => {
    const pitch = withSection(ARCADE, 'outro', { credits: false });
    expect(pitch.outro).toEqual({ cta: 'Available now', credits: false });
    expect(pitch.intro).toBe(ARCADE.intro);
    expect(parses(pitch)).toBe(true);
  });

  it('change a colour, written as the schema reads it, and the theme', () => {
    const pitch = withTheme(withColour(ARCADE, 'accent', '#3d5afe'), 'light');
    expect(pitch.look.colors).toEqual({ ...ARCADE.look.colors, accent: '#3D5AFE' });
    expect(pitch.look.theme).toBe('light');
    expect(parses(pitch)).toBe(true);
  });

  it('change a font, bringing back the preset\'s family when an uploaded file is left', () => {
    expect(withFont(ARCADE, 'heading', { family: 'Gantari', weight: 700 }).look.heading).toEqual({ provider: 'google-fonts', family: 'Gantari', weight: 700 });
    const uploaded = withAsset(ARCADE, 'heading', 'asset:brand.woff2');
    expect(uploaded.look.heading).toEqual({ provider: 'file', family: 'asset:brand.woff2', weight: 400 });
    expect(withFont(uploaded, 'heading', { provider: 'google-fonts' }).look.heading).toEqual({ provider: 'google-fonts', family: 'Anton', weight: 400 });
    expect(withFont(uploaded, 'heading', { weight: 700 }).look.heading.family).toBe('asset:brand.woff2');
    expect(withFont(ARCADE, 'text', { provider: 'file' }).look.text.family).toBe('Inter');
  });

  it('put an uploaded file where it goes: the logo, a font, or the track', () => {
    expect(withAsset(ARCADE, 'logo', 'asset:logo.svg').look.logo).toBe('asset:logo.svg');
    expect(withAsset(ARCADE, 'music', 'asset:theme.mp3').music).toEqual({ provider: 'file', file: 'asset:theme.mp3' });
    expect(parses(withAsset(withAsset(ARCADE, 'logo', 'asset:logo.svg'), 'text', 'asset:body.ttf'))).toBe(true);
  });

  it('start FreePD on the first mood, keeping a mood already chosen', () => {
    expect(withMusicProvider(ARCADE, 'freepd').music).toEqual({ provider: 'freepd', mood: 'upbeat' });
    const calm = withSection(withMusicProvider(ARCADE, 'freepd'), 'music', { mood: 'calm' });
    expect(withMusicProvider(withMusicProvider(calm, 'none'), 'freepd').music).toEqual({ provider: 'freepd', mood: 'calm' });
    expect(withMusicProvider(ARCADE, 'none').music).toEqual({ provider: 'none' });
  });

  it('read a length as a number, an empty one as a bound the parser refuses', () => {
    expect(secondsOf('30')).toBe(30);
    expect(secondsOf(' ')).toBeNaN();
    expect(parsePitchSettings(withSection(ARCADE, 'length', { min: secondsOf('') }))).toMatchObject({ ok: false });
  });
});

describe('the section\'s state', () => {
  it('starts on the saved settings, with nothing to save', () => {
    const state = initialPitchForm(ARCADE);
    expect(state).toEqual({ saved: ARCADE, draft: ARCADE, busy: false, refusal: null, notice: null });
    expect(isDirty(state)).toBe(false);
  });

  it('edits a draft, which then differs from what is saved, and discards it', () => {
    const edited = pitchFormReducer(initialPitchForm(ARCADE), { type: 'edit', draft: withTheme(ARCADE, 'light') });
    expect(isDirty(edited)).toBe(true);
    expect(edited.saved).toBe(ARCADE);
    expect(pitchFormReducer(edited, { type: 'reset' })).toEqual(initialPitchForm(ARCADE));
  });

  it('fills the whole look from a preset, keeping the product\'s logo', () => {
    const withLogo = withAsset(ARCADE, 'logo', 'asset:logo.svg');
    const state = pitchFormReducer(initialPitchForm(withLogo), { type: 'preset', preset: 'keynote' });
    expect(state.draft.look).toEqual({ ...presetLook('keynote'), logo: 'asset:logo.svg' });
    expect(state.draft.voice).toBe(withLogo.voice);
  });

  it('waits while a save is on its way, then holds the saved settings and says so', () => {
    const busy = pitchFormReducer(pitchFormReducer(initialPitchForm(ARCADE), { type: 'edit', draft: withTheme(ARCADE, 'light') }), { type: 'busy' });
    expect(busy).toMatchObject({ busy: true, refusal: null, notice: null });
    const saved = pitchFormReducer(busy, { type: 'saved', pitch: withTheme(ARCADE, 'light') });
    expect(saved).toEqual({ saved: withTheme(ARCADE, 'light'), draft: withTheme(ARCADE, 'light'), busy: false, refusal: null, notice: SAVED });
    expect(isDirty(saved)).toBe(false);
  });

  it('keeps the draft and says why when a save or an upload is refused; the next edit clears it', () => {
    const edited = pitchFormReducer(initialPitchForm(ARCADE), { type: 'edit', draft: withTheme(ARCADE, 'light') });
    const refused = pitchFormReducer(pitchFormReducer(edited, { type: 'busy' }), { type: 'refused', message: 'No.' });
    expect(refused).toMatchObject({ draft: edited.draft, busy: false, refusal: 'No.' });
    expect(pitchFormReducer(refused, { type: 'edit', draft: ARCADE }).refusal).toBeNull();
  });

  it('puts an uploaded file in the draft, to be saved with the rest', () => {
    const state = pitchFormReducer(pitchFormReducer(initialPitchForm(ARCADE), { type: 'busy' }), { type: 'uploaded', target: 'logo', asset: 'asset:logo.svg' });
    expect(state).toMatchObject({ busy: false, notice: UPLOADED });
    expect(state.draft.look.logo).toBe('asset:logo.svg');
    expect(isDirty(state)).toBe(true);
  });
});

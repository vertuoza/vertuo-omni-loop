import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PRESET,
  PITCH_PRESETS,
  VOICE_PRESETS,
  defaultPitchSettings,
  parsePitchSettings,
  presetLook,
  presetOf,
  type PitchSettings,
} from './settings.ts';

// A product's Pitch settings (PRD 1108 s1, spec "1. Pitch settings, per product"): one `pitch` value per
// product, read by the CLI and the Omni page. A stored value may be partial: what it leaves out comes
// from its look's preset, then from the defaults.

const SPEC_EXAMPLE = {
  look: {
    colors: { ink: '#08104D', paper: '#FFFFFF', accent: '#3D5AFE', cta: '#FF4217' },
    heading: { provider: 'google-fonts', family: 'Gantari', weight: 700 },
    text: { provider: 'google-fonts', family: 'Gantari', weight: 400 },
    logo: 'asset:logo.svg',
    theme: 'light',
  },
  voice: { preset: 'confident-warm', instructions: "Customers' words: worksite, quote, invoice." },
  intro: { eyebrow: 'New in Vertuoza' },
  outro: { cta: 'Available now', credits: true },
  music: { provider: 'freepd', mood: 'upbeat' },
  length: { min: 20, max: 40 },
};

function settingsOf(value: unknown): PitchSettings {
  const parsed = parsePitchSettings(value);
  if (!parsed.ok) throw new Error(parsed.errors.join('; '));
  return parsed.settings;
}

function errorsOf(value: unknown): string[] {
  const parsed = parsePitchSettings(value);
  if (parsed.ok) throw new Error('expected a refusal');
  return parsed.errors;
}

describe('parsePitchSettings', () => {
  it("parses the spec's example as written", () => {
    const settings = settingsOf(SPEC_EXAMPLE);
    expect(settings.look.colors).toEqual(SPEC_EXAMPLE.look.colors);
    expect(settings.look.heading).toEqual(SPEC_EXAMPLE.look.heading);
    expect(settings.look.text).toEqual(SPEC_EXAMPLE.look.text);
    expect(settings.look.logo).toBe('asset:logo.svg');
    expect(settings.look.theme).toBe('light');
    expect(settings.voice).toEqual(SPEC_EXAMPLE.voice);
    expect(settings.intro).toEqual(SPEC_EXAMPLE.intro);
    expect(settings.outro).toEqual(SPEC_EXAMPLE.outro);
    expect(settings.music).toEqual(SPEC_EXAMPLE.music);
    expect(settings.length).toEqual(SPEC_EXAMPLE.length);
  });

  it('fills every field of an empty value, or of nothing at all, with the defaults', () => {
    expect(settingsOf({})).toEqual(defaultPitchSettings());
    expect(settingsOf(null)).toEqual(defaultPitchSettings());
    expect(settingsOf(undefined)).toEqual(defaultPitchSettings());
    const defaults = defaultPitchSettings();
    expect(defaults.look).toEqual(presetLook(DEFAULT_PRESET));
    expect(defaults.voice).toEqual({ preset: 'confident-warm', instructions: '' });
    expect(defaults.length).toEqual({ min: 20, max: 40 });
    expect(defaults.music).toEqual({ provider: 'none' });
    expect(defaults.outro.credits).toBe(true);
  });

  it("fills the look from its preset: a stored keynote preset reads as the whole keynote look", () => {
    expect(settingsOf({ look: { preset: 'keynote' } }).look).toEqual(presetLook('keynote'));
    expect(settingsOf({ look: { preset: 'arcade' } }).look).toEqual(presetLook('arcade'));
  });

  it("keeps what a stored look sets over its preset's, field by field", () => {
    const look = settingsOf({ look: { preset: 'keynote', colors: { accent: '#123456' }, theme: 'dark' } }).look;
    expect(look.colors).toEqual({ ...presetLook('keynote').colors, accent: '#123456' });
    expect(look.theme).toBe('dark');
    expect(look.heading).toEqual(presetLook('keynote').heading);
  });

  it('keeps a partial section beside the defaults of the others', () => {
    const settings = settingsOf({ voice: { preset: 'playful' }, length: { max: 55 } });
    expect(settings.voice).toEqual({ preset: 'playful', instructions: '' });
    expect(settings.length).toEqual({ min: 20, max: 55 });
    expect(settings.intro).toEqual(defaultPitchSettings().intro);
  });

  it('takes a font uploaded to the product, and a music file', () => {
    const settings = settingsOf({
      look: { heading: { provider: 'file', family: 'asset:brand-bold.woff2', weight: 800 } },
      music: { provider: 'file', file: 'asset:theme.mp3' },
    });
    expect(settings.look.heading).toEqual({ provider: 'file', family: 'asset:brand-bold.woff2', weight: 800 });
    expect(settings.music).toEqual({ provider: 'file', file: 'asset:theme.mp3' });
  });

  it('refuses a bad colour, naming the token', () => {
    expect(errorsOf({ look: { colors: { ink: 'red' } } })).toEqual(['look.colors.ink: a colour is #RRGGBB, like #08104D']);
    expect(errorsOf({ look: { colors: { cta: '#FFF' } } })).toEqual(['look.colors.cta: a colour is #RRGGBB, like #08104D']);
  });

  it('refuses a length outside 15 to 60 seconds, and a minimum over the maximum', () => {
    expect(errorsOf({ length: { min: 10 } })).toEqual(['length.min: the length is 15 to 60 seconds']);
    expect(errorsOf({ length: { max: 61 } })).toEqual(['length.max: the length is 15 to 60 seconds']);
    expect(errorsOf({ length: { min: 20.5 } })).toEqual(['length.min: the length is 15 to 60 seconds']);
    expect(errorsOf({ length: { min: 50, max: 30 } })).toEqual(['length: the shortest is longer than the longest']);
  });

  it('refuses instructions over 600 characters', () => {
    expect(settingsOf({ voice: { instructions: 'x'.repeat(600) } }).voice.instructions).toHaveLength(600);
    expect(errorsOf({ voice: { instructions: 'x'.repeat(601) } })).toEqual(['voice.instructions: at most 600 characters']);
  });

  it('refuses an unknown voice preset, naming the ones there are', () => {
    expect(errorsOf({ voice: { preset: 'grumpy' } })).toEqual(['voice.preset: one of confident-warm, playful, formal, hype']);
    expect(VOICE_PRESETS).toEqual(['confident-warm', 'playful', 'formal', 'hype']);
  });

  it('refuses an unknown look preset, a theme, a font weight and a logo out of shape', () => {
    expect(errorsOf({ look: { preset: 'neon' } })).toEqual(['look.preset: one of arcade, keynote']);
    expect(errorsOf({ look: { theme: 'sepia' } })).toEqual(['look.theme: light or dark']);
    expect(errorsOf({ look: { text: { weight: 450 } } })).toEqual(['look.text.weight: a weight is 100 to 900, in hundreds']);
    expect(errorsOf({ look: { heading: { family: '' } } })).toEqual(['look.heading.family: a font family is 1 to 80 characters']);
    expect(errorsOf({ look: { logo: 'https://example.com/logo.svg' } })).toEqual(['look.logo: a logo is a file uploaded to the product, asset:<name>']);
  });

  it('refuses a value that is not an object, and a section that is not one, naming every error', () => {
    expect(errorsOf('arcade')).toEqual(['(top level): the Pitch settings are an object']);
    expect(errorsOf([])).toEqual(['(top level): the Pitch settings are an object']);
    expect(errorsOf({ look: { colors: { ink: 'red', paper: 'blue' } }, length: { min: 1 } })).toEqual([
      'look.colors.ink: a colour is #RRGGBB, like #08104D',
      'look.colors.paper: a colour is #RRGGBB, like #08104D',
      'length.min: the length is 15 to 60 seconds',
    ]);
    expect(errorsOf({ voice: 'formal' })).toEqual(['voice: an object']);
  });

  it('refuses intro and outro words that are too long', () => {
    expect(errorsOf({ intro: { eyebrow: 'x'.repeat(61) } })).toEqual(['intro.eyebrow: at most 60 characters']);
    expect(errorsOf({ outro: { cta: 'x'.repeat(61) } })).toEqual(['outro.cta: at most 60 characters']);
  });
});

describe('the presets', () => {
  it('are the two looks of PRD 859, arcade the default', () => {
    expect(PITCH_PRESETS).toEqual(['arcade', 'keynote']);
    expect(DEFAULT_PRESET).toBe('arcade');
    expect(presetLook('arcade').theme).toBe('dark');
    expect(presetLook('keynote').theme).toBe('light');
  });

  it('each parse as settings of their own', () => {
    for (const preset of PITCH_PRESETS) expect(settingsOf({ look: presetLook(preset) }).look).toEqual(presetLook(preset));
  });

  it('hand out copies, so a caller changing one never changes the next', () => {
    const look = presetLook('keynote');
    look.colors.ink = '#000000';
    expect(presetLook('keynote').colors.ink).not.toBe('#000000');
  });

  it('name the preset a look was filled from', () => {
    expect(presetOf(settingsOf({ look: { preset: 'keynote' } }))).toBe('keynote');
    expect(presetOf(settingsOf({}))).toBe('arcade');
  });
});

// The settings a pitch run starts with (PRD 1108 s7): the product's, filled, or the default preset's with
// one line; the files they point at; and an uploaded font asked of the fonts provider by its file.
import { describe, expect, it } from 'vitest';
import { assetsOf, fontRequestOf, startSettings } from './run.ts';
import { defaultPitchSettings } from './settings.ts';

describe('startSettings', () => {
  it("is the product's settings, filled from their preset", () => {
    const { settings, why } = startSettings({ reply: { settings: { look: { preset: 'keynote' }, intro: { eyebrow: 'New in Widgets' } } } });
    expect(why).toBeNull();
    expect(settings.look.preset).toBe('keynote');
    expect(settings.look.colors).toEqual(defaultPitchSettings('keynote').look.colors);
    expect(settings.intro.eyebrow).toBe('New in Widgets');
  });

  it('is the default preset, Arcade, with one line, when the Omni page cannot be read', () => {
    expect(startSettings({ failure: 'unreachable' })).toEqual({
      settings: defaultPitchSettings(),
      why: "settings: the arcade preset (the product's Pitch settings could not be read: unreachable)",
    });
  });

  it('is the default preset, with one line naming the first field, when the answer is out of shape', () => {
    const { settings, why } = startSettings({ reply: { settings: { length: { min: 5, max: 40 } } } });
    expect(settings).toEqual(defaultPitchSettings());
    expect(why).toBe("settings: the arcade preset (the product's Pitch settings could not be read: out of shape, length.min: the length is 15 to 60 seconds)");
  });
});

describe('assetsOf', () => {
  it('names the logo, the uploaded fonts and the music file once each', () => {
    const settings = defaultPitchSettings();
    settings.look.logo = 'asset:logo.svg';
    settings.look.heading = { provider: 'file', family: 'asset:brand.woff2', weight: 700 };
    settings.look.text = { provider: 'file', family: 'asset:brand.woff2', weight: 400 };
    settings.music = { provider: 'file', file: 'asset:theme.mp3' };
    expect(assetsOf(settings)).toEqual(['logo.svg', 'brand.woff2', 'theme.mp3']);
  });

  it('names nothing for settings that point at no file', () => {
    expect(assetsOf(defaultPitchSettings())).toEqual([]);
  });
});

describe('fontRequestOf', () => {
  it('asks an uploaded font by its file name, from that file', () => {
    expect(fontRequestOf({ provider: 'file', family: 'asset:Brand Sans.woff2', weight: 700 })).toEqual({ provider: 'file', family: 'Brand Sans', weight: 700, asset: 'asset:Brand Sans.woff2' });
  });

  it('asks a named family as it is', () => {
    expect(fontRequestOf({ provider: 'google-fonts', family: 'Gantari', weight: 400 })).toEqual({ provider: 'google-fonts', family: 'Gantari', weight: 400 });
  });
});

// What the render and the studio hand the engine's page (PRD 1108 s6): the run's settings filled or
// refused, its uploaded files, its fonts through their provider, its logo, and `input.json`.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contractNetwork, scratch } from './providers/fakes.ts';
import { RenderRefused, runAssets, runSettings, writePageInput } from './render-input.ts';
import { presetLook } from './settings.ts';
import { fixtureStoryboard } from './storyboard.fixture.ts';

const write = (dir: string, file: string, value: unknown): void => {
  mkdirSync(join(dir, file, '..'), { recursive: true });
  writeFileSync(join(dir, file), typeof value === 'string' ? value : JSON.stringify(value));
};

describe('runSettings', () => {
  it("reads the run's settings.json, filled from its preset", () => {
    const dir = scratch('input');
    write(dir, 'settings.json', { look: { preset: 'keynote' }, music: { provider: 'freepd', mood: 'calm' } });
    const settings = runSettings(dir);
    expect(settings.look).toEqual(presetLook('keynote'));
    expect(settings.music).toEqual({ provider: 'freepd', mood: 'calm' });
    expect(settings.length).toEqual({ min: 20, max: 40 });
  });

  it('without settings.json, reads the preset pitch.json names, else the defaults', () => {
    const dir = scratch('input');
    expect(runSettings(dir).look.preset).toBe('arcade');
    write(dir, 'pitch.json', { look: 'keynote' });
    expect(runSettings(dir).look).toEqual(presetLook('keynote'));
  });

  it('refuses settings out of shape, naming each field, and settings that do not read', () => {
    const dir = scratch('input');
    write(dir, 'settings.json', { look: { colors: { ink: 'navy' } }, length: { min: 5, max: 40 } });
    const refused = (() => {
      try {
        runSettings(dir);
      } catch (error) {
        return error;
      }
      return null;
    })();
    expect(refused).toBeInstanceOf(RenderRefused);
    expect(refused instanceof RenderRefused ? refused.lines : []).toEqual([
      'settings.json: look.colors.ink: a colour is #RRGGBB, like #08104D',
      'settings.json: length.min: the length is 15 to 60 seconds',
    ]);
    write(dir, 'settings.json', '{ nope');
    expect(() => runSettings(dir)).toThrow(/settings\.json does not read as JSON/);
  });
});

describe('runAssets', () => {
  it("resolves asset:<name> to the run's assets/<name>, and refuses one it does not hold", async () => {
    const dir = scratch('input');
    write(dir, 'assets/logo.svg', '<svg/>');
    await expect(runAssets(dir)('asset:logo.svg')).resolves.toBe(join(dir, 'assets/logo.svg'));
    await expect(runAssets(dir)('asset:track.mp3')).rejects.toThrow('the run holds no assets/track.mp3');
  });
});

describe('writePageInput', () => {
  it("writes input.json with the storyboard, the look, the fonts' rules and stacks, the logo and the credits", async () => {
    const dir = scratch('input');
    write(dir, 'assets/logo.svg', '<svg/>');
    const { fetch } = contractNetwork();
    const lines: string[] = [];
    const settings = runSettings(dir);
    const look = { ...settings.look, heading: { provider: 'google-fonts', family: 'Gantari', weight: 700 }, text: { provider: 'google-fonts', family: 'Gantari', weight: 700 }, logo: 'asset:logo.svg' };
    const input = await writePageInput(dir, { storyboard: fixtureStoryboard(), settings: { ...settings, look }, credits: ['Music: a track'], fetch, warn: (line) => lines.push(line) });
    expect(lines).toEqual([]);
    expect(JSON.parse(readFileSync(join(dir, 'input.json'), 'utf8'))).toEqual(input);
    expect(input.logo).toBe('assets/logo.svg');
    expect(input.credits).toEqual(['Music: a track']);
    expect(input.fonts.heading).toMatch(/^"Gantari", /);
    expect(input.fonts.text).toBe(input.fonts.heading);
    expect(input.fonts.css.match(/@font-face/g)).toHaveLength(2);
    expect(input.fonts.css).toContain('url(fonts/gantari-700-0.woff2)');
  });

  it("draws a font uploaded to the product (the family asset:<file>) from the run's assets/<file> (PRD 1108 s7)", async () => {
    const dir = scratch('input');
    write(dir, 'assets/Brand Sans.woff2', 'wOF2');
    const settings = runSettings(dir);
    const look = { ...settings.look, heading: { provider: 'file', family: 'asset:Brand Sans.woff2', weight: 700 } };
    const lines: string[] = [];
    const { fetch } = contractNetwork();
    const input = await writePageInput(dir, { storyboard: fixtureStoryboard(), settings: { ...settings, look }, credits: [], fetch, warn: (line) => lines.push(line) });
    expect(lines).toEqual([]);
    expect(input.fonts.heading).toMatch(/^"Brand Sans", /);
    expect(input.fonts.css).toContain('font-family: "Brand Sans"; font-weight: 700');
    expect(readFileSync(join(dir, 'fonts/brand-sans-700.woff2'), 'utf8')).toBe('wOF2');
  });

  it("leaves out a logo the run does not hold, and a font that cannot be had falls back, each with one line", async () => {
    const dir = scratch('input');
    const settings = runSettings(dir);
    const look = { ...settings.look, heading: { provider: 'gone', family: 'Gantari', weight: 700 }, logo: 'asset:logo.svg' };
    const lines: string[] = [];
    const { fetch } = contractNetwork();
    const input = await writePageInput(dir, { storyboard: fixtureStoryboard(), settings: { ...settings, look }, credits: [], fetch, warn: (line) => lines.push(line) });
    expect(input.logo).toBeNull();
    expect(input.fonts.heading).toMatch(/^system-ui/);
    expect(lines).toEqual([
      'the fonts provider "gone" is not registered: using system',
      'logo: the run holds no assets/logo.svg, so the video shows none',
    ]);
  });
});

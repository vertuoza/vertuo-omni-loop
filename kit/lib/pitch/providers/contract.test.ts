// The contract every provider passes (PRD 1108 s5): each registered provider, whatever its name, is run
// through its kind's interface on the same fakes and must answer its shape. A provider added to the
// registry is tested here with no line of its own; one removed takes nothing else with it.
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MP3, WOFF2, contractNetwork, fakeAssets, fakeBrowser, fakeExec, scratch } from './fakes.ts';
import { DEFAULTS, REGISTRY } from './registry.ts';
import { KINDS, SHAPES, frameFile } from './types.ts';

const named = <T extends { id: string }>(providers: readonly T[]): [string, T][] => providers.map((provider) => [provider.id, provider]);
const assets = () => fakeAssets({ 'theme.mp3': MP3, 'brand.woff2': WOFF2 });

describe('the registry', () => {
  it('registers each kind under its own name, ids unique within a kind, its default among them', () => {
    for (const kind of KINDS) {
      const ids = REGISTRY[kind].map((provider) => provider.id);
      expect(REGISTRY[kind].every((provider) => provider.kind === kind), kind).toBe(true);
      expect(new Set(ids).size, kind).toBe(ids.length);
      expect(ids, kind).toContain(DEFAULTS[kind]);
    }
  });
});

describe.each(named(REGISTRY.music))('the music provider %s', (_, provider) => {
  it('writes a track for a mood and a length inside the run folder, with its licence and credit', async () => {
    const dir = scratch('music');
    const track = await provider.pick({ mood: 'upbeat', seconds: 30, asset: 'asset:theme.mp3' }, { dir, fetch: contractNetwork().fetch, asset: assets() });
    expect(dirname(track.file)).toBe(dir);
    expect(readFileSync(track.file).length).toBeGreaterThan(0);
    expect(track.licence === null || track.licence.length > 0).toBe(true);
    expect(track.credit === null || track.credit.length > 0).toBe(true);
  });
});

describe.each(named(REGISTRY.fonts))('the fonts provider %s', (_, provider) => {
  it('gives the CSS of a family and weight, every file it names written in the run folder, and a stack ending in a system font', async () => {
    const dir = scratch('fonts');
    const font = await provider.load({ family: 'Gantari', weight: 700, asset: 'asset:brand.woff2' }, { dir, fetch: contractNetwork().fetch, asset: assets() });
    for (const file of font.files) {
      expect(existsSync(join(dir, file)), file).toBe(true);
      expect(font.css, file).toContain(file);
    }
    expect(font.stack).toMatch(/sans-serif$/);
  });
});

describe.each(named(REGISTRY.capture))('the capture provider %s', (_, provider) => {
  it('writes one numbered PNG per frame and closes its browser', async () => {
    const dir = scratch('capture');
    const browser = fakeBrowser();
    const frames = await provider.frames({ url: 'http://127.0.0.1:4173/', count: 5, width: 320, height: 180, pages: 2 }, { dir, cwd: dir, launch: browser.launch });
    expect(frames.map((frame) => basename(frame))).toEqual([0, 1, 2, 3, 4].map(frameFile));
    expect(frames.every((frame) => existsSync(frame))).toBe(true);
    expect(browser.log.at(-1)).toBe('close');
  });
});

describe.each(named(REGISTRY.encode))('the encode provider %s', (_, provider) => {
  it.each(SHAPES)('encodes the frames into the %s file in the output folder', async (shape) => {
    const dir = scratch('encode');
    const { exec } = fakeExec();
    const file = await provider.video({ frames: { dir, count: 60, fps: 30 }, audio: { file: join(dir, 'music.mp3') }, shape }, { dir, exec });
    expect(dirname(file)).toBe(dir);
    expect(existsSync(file)).toBe(true);
  });
});

// The registry (PRD 1108 s5): a name not registered falls back to its kind's default with one line, a
// music or a font that fails does the same, and removing any provider but a default leaves every other
// one answering to its own name.
import { describe, expect, it } from 'vitest';
import { contractNetwork, fakeAssets, scratch } from './fakes.ts';
import { DEFAULTS, REGISTRY, loadFont, pickMusic, providerFor } from './registry.ts';
import type { Registry } from './registry.ts';
import { KINDS } from './types.ts';
import type { FontsProvider, MusicProvider } from './types.ts';

const lines = () => {
  const said: string[] = [];
  return { said, warn: (line: string) => void said.push(line) };
};

const music = (id: string, fails = false): MusicProvider => ({
  kind: 'music',
  id,
  pick: () => (fails ? Promise.reject(new Error('the network is down')) : Promise.resolve({ file: `/run/${id}.mp3`, licence: `${id} licence`, credit: null })),
});
const fonts = (id: string, fails = false): FontsProvider => ({
  kind: 'fonts',
  id,
  load: () => (fails ? Promise.reject(new Error('no such family')) : Promise.resolve({ css: `/* ${id} */`, files: [], stack: `${id}, sans-serif` })),
});

/** The real registry with these music and fonts providers in place of its own. */
const registry = (musicProviders: MusicProvider[], fontsProviders: FontsProvider[]): Registry => ({ ...REGISTRY, music: musicProviders, fonts: fontsProviders });
const context = () => ({ dir: scratch('registry'), fetch: contractNetwork().fetch, asset: fakeAssets({}) });

describe('providerFor', () => {
  it('answers the provider a name registers, saying nothing', () => {
    const { said, warn } = lines();
    for (const kind of KINDS) for (const provider of REGISTRY[kind]) expect(providerFor(kind, provider.id, warn)).toBe(provider);
    expect(said).toEqual([]);
  });

  it("falls back to the kind's default with one line when the name is not registered", () => {
    const { said, warn } = lines();
    expect(providerFor('music', 'spotify', warn).id).toBe(DEFAULTS.music);
    expect(providerFor('fonts', 'adobe-fonts', warn).id).toBe(DEFAULTS.fonts);
    expect(said).toEqual(['the music provider "spotify" is not registered: using none', 'the fonts provider "adobe-fonts" is not registered: using system']);
  });

  it('refuses when even the default is gone', () => {
    expect(() => providerFor('music', 'spotify', () => undefined, registry([music('jukebox')], [fonts('system')]))).toThrow('no music provider to fall back to: none is not registered');
  });

  it('keeps every other provider answering to its name when one that is not a default is removed', () => {
    for (const kind of KINDS) {
      for (const removed of REGISTRY[kind].filter((provider) => provider.id !== DEFAULTS[kind])) {
        const without: Registry = { ...REGISTRY, [kind]: REGISTRY[kind].filter((provider) => provider !== removed) };
        const { said, warn } = lines();
        for (const other of without[kind]) expect(providerFor(kind, other.id, warn, without), `${kind} without ${removed.id}`).toBe(other);
        expect(said).toEqual([]);
        expect(providerFor(kind, removed.id, warn, without).id).toBe(DEFAULTS[kind]);
        expect(said).toHaveLength(1);
      }
    }
  });
});

describe('pickMusic and loadFont', () => {
  it('answer the named provider, and say which', async () => {
    const { said, warn } = lines();
    const two = registry([music('none'), music('jukebox')], [fonts('system'), fonts('typekit')]);
    expect(await pickMusic({ provider: 'jukebox', mood: 'upbeat', seconds: 30 }, context(), warn, two)).toEqual({ file: '/run/jukebox.mp3', licence: 'jukebox licence', credit: null, provider: 'jukebox' });
    expect(await loadFont({ provider: 'typekit', family: 'Gantari', weight: 700 }, context(), warn, two)).toEqual({ css: '/* typekit */', files: [], stack: 'typekit, sans-serif', provider: 'typekit' });
    expect(said).toEqual([]);
  });

  it("fall back to the kind's default with one line when the provider fails", async () => {
    const { said, warn } = lines();
    const flaky = registry([music('none'), music('jukebox', true)], [fonts('system'), fonts('typekit', true)]);
    expect(await pickMusic({ provider: 'jukebox', mood: 'upbeat', seconds: 30 }, context(), warn, flaky)).toMatchObject({ provider: 'none', file: '/run/none.mp3' });
    expect(await loadFont({ provider: 'typekit', family: 'Gantari', weight: 700 }, context(), warn, flaky)).toMatchObject({ provider: 'system' });
    expect(said).toEqual(['the music from jukebox failed (the network is down): using none', 'the fonts from typekit failed (no such family): using system']);
  });

  it('fail when the default itself fails', async () => {
    const broken = registry([music('none', true)], [fonts('system')]);
    await expect(pickMusic({ provider: 'none', mood: 'upbeat', seconds: 30 }, context(), () => undefined, broken)).rejects.toThrow('the network is down');
  });

  it('give a silent track and a system font through the real registry when the setting names neither', async () => {
    const { said, warn } = lines();
    expect(await pickMusic({ provider: 'gone', mood: 'upbeat', seconds: 5 }, context(), warn)).toMatchObject({ provider: 'none', licence: null });
    expect(await loadFont({ provider: 'gone', family: 'Gantari', weight: 400 }, context(), warn)).toMatchObject({ provider: 'system', files: [] });
    expect(said).toHaveLength(2);
  });
});

// A pitch's music for the render (PRD 1108 s6, acceptance 8): the track through its provider with its
// licence, silence with one line for a provider that is not registered, and the track placed so its key
// moment lands on the storyboard's sync point.
import { describe, expect, it } from 'vitest';
import { contractNetwork, fakeAssets, scratch } from './providers/fakes.ts';
import { TRACK_KEY_SECONDS, audioOf, pickRunMusic } from './render-music.ts';

const pick = async (music: { provider: string; mood?: string; file?: string }) => {
  const lines: string[] = [];
  const { fetch, calls } = contractNetwork();
  const picked = await pickRunMusic(music, { dir: scratch('music'), seconds: 12, fetch, asset: fakeAssets({ 'track.mp3': 'mp3' }), warn: (line) => lines.push(line) });
  return { picked, lines, calls };
};

describe('pickRunMusic', () => {
  it('picks a CC0 track by mood, upbeat when the settings name none, and records its licence', async () => {
    const { picked, lines, calls } = await pick({ provider: 'freepd' });
    expect(lines).toEqual([]);
    expect(calls.map((call) => call.url)).toEqual([expect.stringMatching(/^https:\/\/archive\.org\/download\/freepd\/upbeat\//)]);
    expect(picked.record).toMatchObject({ provider: 'freepd', licence: 'CC0 1.0 Universal (public domain)' });
    expect(picked.record.credit).toContain('FreePD.com');
    expect(picked.credit).toBe(picked.record.credit);
    expect(audioOf(picked, null)).toEqual({ file: picked.file, start: 0 });
  });

  it("hands the provider the product's uploaded track", async () => {
    const { picked } = await pick({ provider: 'file', file: 'asset:track.mp3' });
    expect(picked.record).toEqual({ provider: 'file', licence: "the product's own file", credit: null });
    expect(audioOf(picked, null)).not.toBeNull();
  });

  it('is silence, with no audio under the video, for none and for a provider that is not registered, said in one line', async () => {
    const none = await pick({ provider: 'none' });
    expect(none.lines).toEqual([]);
    expect(audioOf(none.picked, 3)).toBeNull();
    const gone = await pick({ provider: 'jukebox', mood: 'upbeat' });
    expect(gone.lines).toEqual(['the music provider "jukebox" is not registered: using none']);
    expect(gone.picked.record).toEqual({ provider: 'none', licence: null, credit: null });
    expect(audioOf(gone.picked, 3)).toBeNull();
  });
});

describe('audioOf', () => {
  it("starts the track so its key moment lands on the sync point, never before the track's start", async () => {
    const { picked } = await pick({ provider: 'freepd' });
    expect(audioOf(picked, 2.5)).toEqual({ file: picked.file, start: TRACK_KEY_SECONDS - 2.5 });
    expect(audioOf(picked, 1 / 3)?.start).toBe(Math.round((TRACK_KEY_SECONDS - 1 / 3) * 1000) / 1000);
    expect(audioOf(picked, TRACK_KEY_SECONDS + 4)?.start).toBe(0);
  });
});

// The `none` music provider (PRD 1108 s5): silence for the video's length, owing no licence.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fakeAssets, fakeFetch, scratch } from '../fakes.ts';
import { noneMusic } from './none.ts';

describe('noneMusic.pick', () => {
  it('writes a silent WAV of the video length and owes no licence or credit', async () => {
    const dir = scratch('none');
    const track = await noneMusic.pick({ mood: 'upbeat', seconds: 20 }, { dir, fetch: fakeFetch([]).fetch, asset: fakeAssets({}) });
    expect(track).toEqual({ file: join(dir, 'silence.wav'), licence: null, credit: null });
    const wav = readFileSync(track.file);
    expect(wav.readUInt32LE(40)).toBe(20 * 44100 * 4);
    expect(wav.subarray(44).every((byte) => byte === 0)).toBe(true);
  });
});

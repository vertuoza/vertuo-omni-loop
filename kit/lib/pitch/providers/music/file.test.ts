// The `file` music provider (PRD 1108 s5): the track a product uploaded, copied into the run.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MP3, fakeAssets, fakeFetch, scratch } from '../fakes.ts';
import { fileMusic } from './file.ts';

describe('fileMusic.pick', () => {
  it("returns the product's uploaded track, copied into the run folder", async () => {
    const dir = scratch('music-file');
    const track = await fileMusic.pick({ mood: 'upbeat', seconds: 30, asset: 'asset:Theme.MP3' }, { dir, fetch: fakeFetch([]).fetch, asset: fakeAssets({ 'Theme.MP3': MP3 }) });
    expect(track).toEqual({ file: join(dir, 'music.mp3'), licence: "the product's own file", credit: null });
    expect(new Uint8Array(readFileSync(track.file))).toEqual(MP3);
  });

  it('fails when the setting names no file, or the file is not there', async () => {
    const context = { dir: scratch('music-file'), fetch: fakeFetch([]).fetch, asset: fakeAssets({}) };
    await expect(fileMusic.pick({ mood: 'upbeat', seconds: 30 }, context)).rejects.toThrow('the music settings name no file');
    await expect(fileMusic.pick({ mood: 'upbeat', seconds: 30, asset: 'asset:gone.mp3' }, context)).rejects.toThrow('no uploaded file asset:gone.mp3');
  });
});

// The `freepd` music provider (PRD 1108 s5): a pinned CC0 track by mood, fetched from the archive of
// FreePD.com, against a faked network only.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MP3, fakeAssets, fakeFetch, scratch } from '../fakes.ts';
import { FREEPD_TRACKS, freepdMusic, pickTrack, trackUrl } from './freepd.ts';

const ARCHIVE = /^https:\/\/archive\.org\/download\/freepd\//;
const pick = (fetch: ReturnType<typeof fakeFetch>['fetch'], mood = 'upbeat', seconds = 30) => {
  const dir = scratch('freepd');
  return { dir, track: freepdMusic.pick({ mood, seconds }, { dir, fetch, asset: fakeAssets({}) }) };
};

describe('the pinned list', () => {
  it('holds tracks for every mood, each an MP3 in a mood folder of the FreePD archive', () => {
    expect(Object.keys(FREEPD_TRACKS)).toEqual(['upbeat', 'calm', 'epic', 'playful', 'electronic']);
    for (const [mood, tracks] of Object.entries(FREEPD_TRACKS)) {
      expect(tracks.length, mood).toBeGreaterThanOrEqual(3);
      for (const track of tracks) expect(trackUrl(track), track.title).toMatch(/^https:\/\/archive\.org\/download\/freepd\/[a-z]+\/[^/]+\.mp3$/);
    }
    expect(trackUrl({ title: 'City Sunshine', folder: 'upbeat', seconds: 185 })).toBe('https://archive.org/download/freepd/upbeat/City%20Sunshine.mp3');
  });

  it("picks the mood's shortest track that covers the video, else its longest, the same every time", () => {
    expect(pickTrack('upbeat', 30).title).toBe('Advertime');
    expect(pickTrack('upbeat', 140).title).toBe('Funshine');
    expect(pickTrack('upbeat', 400).title).toBe('City Sunshine');
    expect(pickTrack('epic', 60).title).toBe('Heroic Adventure');
    expect(pickTrack('calm', 30)).toEqual(pickTrack('calm', 30));
  });

  it('refuses a mood it has no tracks for, naming the moods it has', () => {
    expect(() => pickTrack('sombre', 30)).toThrow(/no FreePD tracks for the mood "sombre" \(upbeat, calm, epic, playful, electronic\)/);
  });
});

describe('freepdMusic.pick', () => {
  it('downloads the picked track into the run folder and returns its CC0 licence and credit', async () => {
    const network = fakeFetch([[ARCHIVE, MP3]]);
    const { dir, track } = pick(network.fetch);
    expect(await track).toEqual({
      file: join(dir, 'music.mp3'),
      licence: 'CC0 1.0 Universal (public domain)',
      credit: '"Advertime" from FreePD.com (public domain), archived at archive.org/details/freepd',
    });
    expect(network.calls.map((call) => call.url)).toEqual(['https://archive.org/download/freepd/upbeat/Advertime.mp3']);
    expect(new Uint8Array(readFileSync(join(dir, 'music.mp3')))).toEqual(MP3);
  });

  it('asks again when the archive answers an error, up to three times', async () => {
    let answers = 0;
    const network = fakeFetch([[ARCHIVE, () => (++answers < 3 ? 500 : MP3)]]);
    await expect(pick(network.fetch).track).resolves.toMatchObject({ licence: 'CC0 1.0 Universal (public domain)' });
    expect(network.calls).toHaveLength(3);
  });

  it('fails naming the last answer when no attempt gives an MP3', async () => {
    await expect(pick(fakeFetch([[ARCHIVE, 500]]).fetch).track).rejects.toThrow('the archive answered 500 for "Advertime"');
    await expect(pick(fakeFetch([[ARCHIVE, '<html>500 Internal Server Error</html>']]).fetch).track).rejects.toThrow('the download is not an MP3 for "Advertime"');
  });

  it("downloads from the item's own server when the archive's download address answers 500 (#1129)", async () => {
    const metadata = JSON.stringify({ d1: 'ia601509.us.archive.org', d2: 'ia801509.us.archive.org', dir: '/18/items/freepd' });
    const network = fakeFetch([
      [ARCHIVE, 500],
      [/^https:\/\/archive\.org\/metadata\/freepd$/, metadata],
      [/^https:\/\/ia601509\.us\.archive\.org\/18\/items\/freepd\/upbeat\/Advertime\.mp3$/, MP3],
    ]);
    await expect(pick(network.fetch).track).resolves.toMatchObject({ licence: 'CC0 1.0 Universal (public domain)' });
  });

  it('accepts an MP3 that opens on a frame, with no ID3 tag', async () => {
    const track = await pick(fakeFetch([[ARCHIVE, new Uint8Array([0xff, 0xfb, 0x90, 0x64])]]).fetch).track;
    expect(track.credit).toContain('Advertime');
  });
});

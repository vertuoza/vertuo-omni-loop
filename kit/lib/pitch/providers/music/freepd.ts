// The `freepd` music provider: a CC0 (public domain) track from FreePD.com, picked by mood from a short
// list pinned here, downloaded on demand. Never a search, never a scrape: the list is the catalogue.
//
// FreePD.com closed in 2025; its catalogue, all CC0, is kept whole by the Internet Archive at
// archive.org/details/freepd, in the site's own mood folders, which is where every track below is
// fetched from. Each track is the shortest the list holds that still covers the video, so the pick is
// the same every time for a mood and a length.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Fetch, MusicProvider } from '../types.ts';

const ARCHIVE = 'https://archive.org/download/freepd';
const LICENCE = 'CC0 1.0 Universal (public domain)';

type PinnedTrack = { title: string; folder: string; seconds: number };

/** The pinned tracks by mood, each with its length in seconds as the archive lists it. */
export const FREEPD_TRACKS: Readonly<Record<string, readonly PinnedTrack[]>> = Object.freeze({
  upbeat: [
    { title: 'Advertime', folder: 'upbeat', seconds: 134 },
    { title: 'Inspiration', folder: 'upbeat', seconds: 138 },
    { title: 'Funshine', folder: 'upbeat', seconds: 165 },
    { title: 'City Sunshine', folder: 'upbeat', seconds: 185 },
  ],
  calm: [
    { title: 'Lovely Piano Song', folder: 'romantic', seconds: 95 },
    { title: 'Shining Stars', folder: 'romantic', seconds: 140 },
    { title: 'Pond', folder: 'romantic', seconds: 152 },
  ],
  epic: [
    { title: 'New Hero in Town', folder: 'epic', seconds: 56 },
    { title: 'Heroic Adventure', folder: 'epic', seconds: 142 },
    { title: 'Epic Blockbuster 2', folder: 'epic', seconds: 159 },
  ],
  playful: [
    { title: 'Llama in Pajama', folder: 'comedy', seconds: 97 },
    { title: 'Going Bananas', folder: 'comedy', seconds: 140 },
    { title: 'Spring Chicken', folder: 'comedy', seconds: 166 },
  ],
  electronic: [
    { title: 'Hippety Hop', folder: 'electronic', seconds: 116 },
    { title: 'Favorite', folder: 'electronic', seconds: 175 },
    { title: 'Beat One', folder: 'electronic', seconds: 179 },
  ],
});

/** A pinned track's address in the archive. */
export const trackUrl = ({ folder, title }: PinnedTrack): string => `${ARCHIVE}/${folder}/${encodeURIComponent(`${title}.mp3`)}`;

/** The mood's shortest track that covers `seconds`, else its longest. */
export function pickTrack(mood: string, seconds: number): PinnedTrack {
  const tracks = FREEPD_TRACKS[mood];
  if (tracks === undefined) throw new Error(`no FreePD tracks for the mood "${mood}" (${Object.keys(FREEPD_TRACKS).join(', ')})`);
  const longest = tracks.reduce((best, track) => (track.seconds > best.seconds ? track : best));
  return tracks.find((track) => track.seconds >= seconds) ?? longest;
}

/** Whether `bytes` open like an MP3: an ID3 tag or an MPEG frame's sync bits. */
const isMp3 = (bytes: Uint8Array): boolean =>
  (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) || (bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0);

/** The archive's mirrors answer an error now and then: a track is asked for this many times. */
const ATTEMPTS = 3;

/** A pinned track's bytes, asked for up to `ATTEMPTS` times; the last refusal when none answers an MP3. */
async function download(track: PinnedTrack, fetch: Fetch): Promise<Uint8Array> {
  let reason = '';
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    const answer = await fetch(trackUrl(track));
    const bytes = answer.ok ? new Uint8Array(await answer.arrayBuffer()) : null;
    if (bytes !== null && isMp3(bytes)) return bytes;
    reason = bytes === null ? `the archive answered ${String(answer.status)}` : 'the download is not an MP3';
  }
  throw new Error(`${reason} for "${track.title}"`);
}

export const freepdMusic: MusicProvider = Object.freeze({
  kind: 'music',
  id: 'freepd',
  pick: async ({ mood, seconds }, { dir, fetch }) => {
    const track = pickTrack(mood, seconds);
    const file = join(dir, 'music.mp3');
    const credit = `"${track.title}" from FreePD.com (public domain), archived at archive.org/details/freepd`;
    writeFileSync(file, await download(track, fetch));
    return { file, licence: LICENCE, credit };
  },
});

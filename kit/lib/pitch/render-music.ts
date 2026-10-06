// A pitch's music, for `omni pitch render` (PRD 1108 s6): the track the settings name, through the music
// provider, placed so the storyboard's sync point lands on the track's key moment.
//
// - A provider that is not registered, or a track that cannot be had, falls back to silence with one line
//   (./providers/registry.ts). The kind's default is silence: a video under it carries no audio track.
// - A track's key moment is taken as `TRACK_KEY_SECONDS` into it, where the tracks a pitch picks have
//   left their opening bars. With a sync point, the track starts that far before it, so its key moment
//   lands on the scene's `at`; with none, or one too early, it starts at its beginning.
// - The encode provider normalises it, fades it in and out and cuts it to the video's length.
import { DEFAULTS, pickMusic } from './providers/registry.ts';
import type { Registry, Warn } from './providers/registry.ts';
import type { AssetResolver, Fetch } from './providers/types.ts';
import type { PitchSettings } from './settings.ts';

/** The mood a music setting without one asks for. */
const DEFAULT_MOOD = 'upbeat';
/** How far into a track its key moment is taken to be. */
export const TRACK_KEY_SECONDS = 8;

/** What the run records of its music. */
export type MusicRecord = { provider: string; licence: string | null; credit: string | null };
/** The music a video is encoded with: a track and the second of it the video starts on, or none. */
export type PickedMusic = { file: string; credit: string | null; record: MusicRecord };

/** The track the settings name, written in `dir`, for a video of at most `seconds`. */
export async function pickRunMusic(
  music: PitchSettings['music'],
  { dir, seconds, fetch, asset, warn, registry }: { dir: string; seconds: number; fetch: Fetch; asset: AssetResolver; warn: Warn; registry?: Registry },
): Promise<PickedMusic> {
  const request = { provider: music.provider, mood: music.mood ?? DEFAULT_MOOD, seconds, ...(music.file === undefined ? {} : { asset: music.file }) };
  const track = await pickMusic(request, { dir, fetch, asset }, warn, registry);
  return { file: track.file, credit: track.credit, record: { provider: track.provider, licence: track.licence, credit: track.credit } };
}

/** The audio under the video: none for silence, else the track from the second that puts its key moment on `syncSeconds`. */
export function audioOf(music: PickedMusic, syncSeconds: number | null): { file: string; start: number } | null {
  if (music.record.provider === DEFAULTS.music) return null;
  const start = syncSeconds === null ? 0 : Math.max(0, TRACK_KEY_SECONDS - syncSeconds);
  return { file: music.file, start: Math.round(start * 1000) / 1000 };
}

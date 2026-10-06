// Where a media sits (PRD 1108 s4): its device frame's chrome, the largest box of its proportions that
// fits a region with that chrome around it, and the second of its file a scene shows. Pure.
import type { Media } from '../lib/pitch/storyboard.ts';

export type Device = NonNullable<Media['device']>;
export type Size = Readonly<{ width: number; height: number }>;

/** The device frames' measures, in pixels. */
export const CHROME = Object.freeze({ browserBar: 52, phoneBezel: 18, laptopBezel: 16, laptopBase: 28 });
/** The whole media, as a crop. */
export const FULL = Object.freeze({ x: 0, y: 0, w: 1, h: 1 });

const PADDING: Readonly<Record<Device, { across: number; down: number }>> = {
  none: { across: 0, down: 0 },
  browser: { across: 0, down: CHROME.browserBar },
  laptop: { across: CHROME.laptopBezel * 2, down: CHROME.browserBar + CHROME.laptopBezel * 2 + CHROME.laptopBase },
  phone: { across: CHROME.phoneBezel * 2, down: CHROME.phoneBezel * 2 },
};

/** The media's box once fitted in a region: `width` × `height` of media, `outer` with its device frame. */
export type Fitted = Readonly<{ width: number; height: number; outer: Size }>;

/** The largest box of the media's proportions (its crop's) that fits in `room` with its device frame around it. */
export function fit(media: Media, size: Size, room: Size): Fitted {
  const crop = media.crop ?? FULL;
  const ratio = (size.width * crop.w) / (size.height * crop.h);
  const chrome = PADDING[media.device ?? 'none'];
  const across = room.width - chrome.across;
  const height = Math.min(across / ratio, room.height - chrome.down);
  const width = Math.round(height * ratio);
  const rounded = Math.round(height);
  return { width, height: rounded, outer: { width: width + chrome.across, height: rounded + chrome.down } };
}

/** The second of the media's file a scene shows at `t` seconds: its start, at its rate, held at its end. */
export const mediaSeconds = (media: Media, t: number): number => Math.min((media.start ?? 0) + t * (media.rate ?? 1), media.end ?? Number.POSITIVE_INFINITY);

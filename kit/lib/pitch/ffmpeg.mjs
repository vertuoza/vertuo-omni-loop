// The ffmpeg recipe of a pitch's videos (PRD 859's spec, "The video"), as a pure function of the run's
// file names and the walk-through's length: the arguments of each ffmpeg call, nothing run here.
//
// - `normalise`: the walk-through Playwright recorded (`walk.webm`, whose length is often unknown to
//   ffprobe) as `walk.mp4`, 1920×1080 at 30 fps, silent, so its length can be read.
// - `wide`: `pitch.mp4`, 1920×1080: the slide card, the walk-through, the closing card, music under it
//   with a one-second fade in and out, cut to the video's length; H.264 with AAC.
// - `square`: `pitch-square.mp4`, 1080×1080: the same, the walk-through centred on the look's backdrop.
// - `gif`: `pitch.gif`: the walk-through only, silent, at most 8 seconds, 640 pixels wide.
//
// A video is 20 to 30 seconds: a walk-through past 24 s is cut so the whole holds 30, and a short one
// keeps the closing card on screen longer, so the whole reaches 20.

export const CARD_SECONDS = 3;
export const FADE_SECONDS = 1;
const VIDEO_MIN_SECONDS = 20;
const VIDEO_MAX_SECONDS = 30;
const GIF_MAX_SECONDS = 8;
const GIF_WIDTH = 640;
const FPS = 30;

/** The run's files by role, as `/omni:pitch` and `omni pitch slide` name them in the run folder. */
export const PITCH_INPUTS = Object.freeze({
  slide: 'slide.png',
  slideSquare: 'slide-square.png',
  close: 'close.png',
  closeSquare: 'close-square.png',
  backdropSquare: 'backdrop-square.png',
  walk: 'walk.webm',
  walkNormal: 'walk.mp4',
  music: 'music.wav',
});

const OUTPUTS = Object.freeze({ wide: 'pitch.mp4', square: 'pitch-square.mp4', gif: 'pitch.gif' });

const seconds = (value) => String(Math.round(value * 1000) / 1000);

/**
 * How long each part of a video lasts, from the walk-through's own length.
 * @returns {{ slide: number, walk: number, close: number, total: number }}
 */
export function pitchCut(walkSeconds) {
  if (!(walkSeconds > 0)) throw new RangeError(`the walk-through has no length (${String(walkSeconds)} s)`);
  const walk = Math.min(walkSeconds, VIDEO_MAX_SECONDS - 2 * CARD_SECONDS);
  const close = Math.max(CARD_SECONDS, VIDEO_MIN_SECONDS - CARD_SECONDS - walk);
  return { slide: CARD_SECONDS, walk, close, total: CARD_SECONDS + walk + close };
}

/** A card, a looped still, scaled to `width`×`height` at the video's rate. */
const card = (input, width, height, out) => `[${input}:v]scale=${width}:${height},setsar=1,fps=${FPS},format=yuv420p[${out}]`;

/** The music under the whole, cut to `total` with its fades. */
const music = (input, total) =>
  `[${input}:a]atrim=0:${seconds(total)},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=${FADE_SECONDS},afade=t=out:st=${seconds(total - FADE_SECONDS)}:d=${FADE_SECONDS}[m]`;

/** The arguments every video ends with: its streams, codecs, length and file. */
const encode = (total, output) => [
  '-map', '[v]', '-map', '[m]',
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', String(FPS),
  '-c:a', 'aac', '-b:a', '160k',
  '-t', seconds(total), '-movflags', '+faststart', output,
];

const still = (file, length) => ['-loop', '1', '-t', seconds(length), '-i', file];

function wideArgs(files, cut) {
  const walk = `[1:v]trim=0:${seconds(cut.walk)},setpts=PTS-STARTPTS,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${FPS},format=yuv420p[b]`;
  const graph = [card(0, 1920, 1080, 'a'), walk, card(2, 1920, 1080, 'c'), '[a][b][c]concat=n=3:v=1:a=0[v]', music(3, cut.total)].join(';');
  return [
    '-y',
    ...still(files.slide, cut.slide),
    '-i', files.walkNormal,
    ...still(files.close, cut.close),
    '-i', files.music,
    '-filter_complex', graph,
    ...encode(cut.total, OUTPUTS.wide),
  ];
}

function squareArgs(files, cut) {
  const walk = [
    `[1:v]trim=0:${seconds(cut.walk)},setpts=PTS-STARTPTS,scale=1080:-2,setsar=1[w]`,
    '[3:v]scale=1080:1080,setsar=1[bg]',
    `[bg][w]overlay=(W-w)/2:(H-h)/2:shortest=1,fps=${FPS},format=yuv420p[b]`,
  ];
  const graph = [card(0, 1080, 1080, 'a'), ...walk, card(2, 1080, 1080, 'c'), '[a][b][c]concat=n=3:v=1:a=0[v]', music(4, cut.total)].join(';');
  return [
    '-y',
    ...still(files.slideSquare, cut.slide),
    '-i', files.walkNormal,
    ...still(files.closeSquare, cut.close),
    ...still(files.backdropSquare, cut.walk),
    '-i', files.music,
    '-filter_complex', graph,
    ...encode(cut.total, OUTPUTS.square),
  ];
}

function gifArgs(files, cut) {
  const graph = `fps=12,scale=${GIF_WIDTH}:-1:flags=lanczos,split[x][y];[x]palettegen[p];[y][p]paletteuse`;
  return ['-y', '-t', seconds(Math.min(cut.walk, GIF_MAX_SECONDS)), '-i', files.walkNormal, '-filter_complex', graph, '-an', '-loop', '0', OUTPUTS.gif];
}

/** The ffmpeg call that turns the recorded walk-through into `walk.mp4`, before its length is read. */
export function normaliseArgs(files = PITCH_INPUTS) {
  const graph = `scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${FPS},format=yuv420p`;
  return ['-y', '-i', files.walk, '-vf', graph, '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', files.walkNormal];
}

/**
 * The three ffmpeg calls of a pitch, each an argument list run in the run folder, and the cut they make.
 * @param {{ walkSeconds: number, files?: typeof PITCH_INPUTS }} input
 */
export function pitchRecipe({ walkSeconds, files = PITCH_INPUTS }) {
  const cut = pitchCut(walkSeconds);
  return { cut, wide: wideArgs(files, cut), square: squareArgs(files, cut), gif: gifArgs(files, cut) };
}

/** The files a recipe writes, in the order the run lists them. */
export const PITCH_VIDEOS = Object.freeze(Object.values(OUTPUTS));

// The ffmpeg recipe of a pitch's videos (PRD 1108 s5), as a pure function of the frames and the music:
// the arguments of each ffmpeg call, nothing run here. PRD 859's recipe, which stitched a still slide, a
// walk-through and a closing card, is gone (PRD 1108 s6).

export const FADE_SECONDS = 1;
const GIF_MAX_SECONDS = 8;
const GIF_WIDTH = 640;
const FPS = 30;

const OUTPUTS = Object.freeze({ wide: 'pitch.mp4', square: 'pitch-square.mp4', gif: 'pitch.gif' });

const seconds = (value: number): string => String(Math.round(value * 1000) / 1000);

/** The music under the whole, cut to `total` with its fades. */
const music = (input: number, total: number): string =>
  `[${input}:a]atrim=0:${seconds(total)},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=${FADE_SECONDS},afade=t=out:st=${seconds(total - FADE_SECONDS)}:d=${FADE_SECONDS}[m]`;

// PRD 1108: the encode provider's recipe. The engine's frames, a numbered PNG sequence, become one of
// the three files; the music under them starts `start` seconds into its track, is normalised, faded in
// and out, and cut to the frames' length. The GIF keeps the first 8 seconds, silent.

/** A numbered frame sequence (`pattern` as ffmpeg reads it), `count` frames at `fps`. */
export type FrameSequence = { pattern: string; count: number; fps: number };
/** The three files a frame sequence is encoded into. */
export type FramesShape = 'wide' | 'square' | 'gif';

/** The file a shape is encoded into. A function, not a table, so the CLI's bundle drops it until a command uses it. */
function outputOf(shape: FramesShape): string {
  if (shape === 'gif') return OUTPUTS.gif;
  return shape === 'square' ? OUTPUTS.square : OUTPUTS.wide;
}

/** Fits the frames inside `width`×`height`, centred, letterboxed. */
const fit = (width: number, height: number): string =>
  `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p`;

/** The music under a video of `total` seconds: normalised, cut and faded. */
const underscore = (total: number): string => music(1, total).replace('[1:a]', '[1:a]loudnorm=I=-16:TP=-1.5,');

function videoArgs(frames: FrameSequence, audio: { file: string; start?: number } | null, shape: 'wide' | 'square', total: number): string[] {
  const [width, height] = shape === 'wide' ? [1920, 1080] : [1080, 1080];
  const picture = `[0:v]${fit(width, height)}[v]`;
  const sound = audio === null ? [] : ['-ss', seconds(audio.start ?? 0), '-i', audio.file];
  const graph = audio === null ? picture : `${picture};${underscore(total)}`;
  const streams = audio === null ? ['-map', '[v]', '-an'] : ['-map', '[v]', '-map', '[m]', '-c:a', 'aac', '-b:a', '160k'];
  return [
    '-y', '-framerate', String(frames.fps), '-i', frames.pattern, ...sound,
    '-filter_complex', graph, ...streams,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-t', seconds(total), '-movflags', '+faststart', outputOf(shape),
  ];
}

function framesGifArgs(frames: FrameSequence, total: number): string[] {
  const graph = `[0:v]fps=12,scale=${GIF_WIDTH}:-1:flags=lanczos,split[x][y];[x]palettegen[p];[y][p]paletteuse`;
  return ['-y', '-framerate', String(frames.fps), '-t', seconds(Math.min(total, GIF_MAX_SECONDS)), '-i', frames.pattern, '-filter_complex', graph, '-an', '-loop', '0', OUTPUTS.gif];
}

/** The ffmpeg call that encodes a frame sequence into one shape's file, run in the output folder, and that file's name. */
export function framesArgs({ frames, audio, shape }: { frames: FrameSequence; audio: { file: string; start?: number } | null; shape: FramesShape }): { output: string; args: string[] } {
  if (!(frames.count > 0 && frames.fps > 0)) throw new RangeError(`no frames to encode (${String(frames.count)} at ${String(frames.fps)} fps)`);
  const total = frames.count / frames.fps;
  const args = shape === 'gif' ? framesGifArgs(frames, total) : videoArgs(frames, audio, shape, total);
  return { output: outputOf(shape), args };
}

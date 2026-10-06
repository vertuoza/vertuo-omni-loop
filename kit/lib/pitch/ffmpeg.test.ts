// The ffmpeg recipe of a pitch (PRD 859 s4): a pure function of the files and the walk-through's length,
// with both cards, the fades and the cut length in its arguments; and, where ffmpeg is installed, a run
// on fixtures that gives pitch.mp4 (1920×1080, 20–30 s, an audio track), pitch-square.mp4 (1080×1080) and
// pitch.gif (at most 8 s, 640 px wide).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CARD_SECONDS, FADE_SECONDS, PITCH_INPUTS, framesArgs, normaliseArgs, pitchCut, pitchRecipe } from './ffmpeg.ts';
import { pitchMusic } from './music.ts';
import { makeVideos } from './run.ts';

const graphOf = (args: string[]): string | undefined => args[args.indexOf('-filter_complex') + 1];
const inputs = (args: string[]): (string | undefined)[] => args.flatMap((arg, index) => (arg === '-i' ? [args[index + 1]] : []));

describe('pitchCut', () => {
  it('is the slide card, the walk-through and the closing card, 20 to 30 seconds in all', () => {
    expect(pitchCut(15)).toEqual({ slide: 3, walk: 15, close: 3, total: 21 });
    expect(pitchCut(10)).toEqual({ slide: 3, walk: 10, close: 7, total: 20 });
    expect(pitchCut(24)).toEqual({ slide: 3, walk: 24, close: 3, total: 30 });
    expect(pitchCut(40)).toEqual({ slide: 3, walk: 24, close: 3, total: 30 });
    for (const walk of [1, 5, 10, 12.4, 15, 20, 24, 60]) {
      const { total, slide, close } = pitchCut(walk);
      expect(total, String(walk)).toBeGreaterThanOrEqual(20);
      expect(total, String(walk)).toBeLessThanOrEqual(30);
      expect(slide).toBe(CARD_SECONDS);
      expect(close).toBeGreaterThanOrEqual(CARD_SECONDS);
    }
  });

  it('refuses a walk-through with no length', () => {
    expect(() => pitchCut(Number.NaN)).toThrow(/no length/);
    expect(() => pitchCut(0)).toThrow(/no length/);
  });
});

describe('pitchRecipe', () => {
  it('is a pure function of the files and the length', () => {
    expect(pitchRecipe({ walkSeconds: 12 })).toEqual(pitchRecipe({ walkSeconds: 12 }));
    expect(pitchRecipe({ walkSeconds: 12 })).not.toEqual(pitchRecipe({ walkSeconds: 14 }));
    const renamed = pitchRecipe({ walkSeconds: 12, files: { ...PITCH_INPUTS, music: 'other.wav' } });
    expect(inputs(renamed.wide)).toContain('other.wav');
  });

  it('puts both cards, the walk-through and the music in each video, the cards held for their seconds', () => {
    const { wide, square, cut } = pitchRecipe({ walkSeconds: 12 });
    expect(inputs(wide)).toEqual(['slide.png', 'walk.mp4', 'close.png', 'music.wav']);
    expect(inputs(square)).toEqual(['slide-square.png', 'walk.mp4', 'close-square.png', 'backdrop-square.png', 'music.wav']);
    expect(wide.slice(1, 5)).toEqual(['-loop', '1', '-t', String(cut.slide)]);
    expect(wide.slice(9, 13)).toEqual(['-loop', '1', '-t', String(cut.close)]);
    for (const args of [wide, square]) {
      expect(graphOf(args)).toContain('concat=n=3:v=1:a=0');
      expect(graphOf(args)).toContain(`trim=0:${cut.walk}`);
    }
    expect(graphOf(square)).toContain('overlay=(W-w)/2:(H-h)/2');
  });

  it('fades the music in and out over one second and cuts each video to its length, in H.264 with AAC', () => {
    const { wide, square, cut } = pitchRecipe({ walkSeconds: 12 });
    expect(cut.total).toBe(20);
    for (const args of [wide, square]) {
      expect(graphOf(args)).toContain(`afade=t=in:st=0:d=${FADE_SECONDS}`);
      expect(graphOf(args)).toContain(`afade=t=out:st=${cut.total - FADE_SECONDS}:d=${FADE_SECONDS}`);
      expect(graphOf(args)).toContain(`atrim=0:${cut.total}`);
      expect(args.slice(args.indexOf('-t', args.indexOf('-filter_complex')), args.indexOf('-t', args.indexOf('-filter_complex')) + 2)).toEqual(['-t', '20']);
      expect(args).toEqual(expect.arrayContaining(['libx264', 'aac']));
    }
    expect(wide.at(-1)).toBe('pitch.mp4');
    expect(square.at(-1)).toBe('pitch-square.mp4');
  });

  it('makes the GIF from the walk-through only, silent, at most 8 seconds and 640 pixels wide', () => {
    const { gif } = pitchRecipe({ walkSeconds: 12 });
    expect(inputs(gif)).toEqual(['walk.mp4']);
    expect(gif.slice(1, 3)).toEqual(['-t', '8']);
    expect(graphOf(gif)).toContain('scale=640:-1');
    expect(gif).toContain('-an');
    expect(gif.at(-1)).toBe('pitch.gif');
    expect(pitchRecipe({ walkSeconds: 5 }).gif.slice(1, 3)).toEqual(['-t', '5']);
  });

  it('normalises the recorded walk-through to a 1920×1080 walk.mp4 first', () => {
    const args = normaliseArgs();
    expect(inputs(args)).toEqual(['walk.webm']);
    expect(args.at(-1)).toBe('walk.mp4');
    expect(args.join(' ')).toContain('scale=1920:1080');
  });
});

describe('framesArgs (PRD 1108 s5)', () => {
  const frames = { pattern: '/run/frames/frame-%05d.png', count: 300, fps: 30 };
  const audio = { file: '/run/music.mp3', start: 4.5 };

  it('encodes the frames into pitch.mp4 at 1920×1080 with the music normalised, faded and cut to the frames', () => {
    const { output, args } = framesArgs({ frames, audio, shape: 'wide' });
    expect(output).toBe('pitch.mp4');
    expect(args.slice(0, 5)).toEqual(['-y', '-framerate', '30', '-i', '/run/frames/frame-%05d.png']);
    expect(args).toEqual(expect.arrayContaining(['-ss', '4.5', '-i', '/run/music.mp3', '-c:a', 'aac']));
    const graph = graphOf(args) ?? '';
    expect(graph).toContain('scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080');
    expect(graph).toContain('loudnorm');
    expect(graph).toContain(`afade=t=in:st=0:d=${FADE_SECONDS}`);
    expect(graph).toContain(`afade=t=out:st=${10 - FADE_SECONDS}:d=${FADE_SECONDS}`);
    expect(args.slice(-5)).toEqual(['-t', '10', '-movflags', '+faststart', 'pitch.mp4']);
  });

  it('encodes pitch-square.mp4 at 1080×1080, and a silent video when there is no music', () => {
    const { output, args } = framesArgs({ frames, audio: null, shape: 'square' });
    expect(output).toBe('pitch-square.mp4');
    expect(graphOf(args)).toContain('pad=1080:1080');
    expect(inputs(args)).toEqual(['/run/frames/frame-%05d.png']);
    expect(args).toContain('-an');
    expect(graphOf(args)).not.toContain('[1:a]');
  });

  it('encodes pitch.gif from at most the first 8 seconds, 640 px wide, silent', () => {
    const { output, args } = framesArgs({ frames, audio, shape: 'gif' });
    expect(output).toBe('pitch.gif');
    expect(inputs(args)).toEqual(['/run/frames/frame-%05d.png']);
    expect(args).toEqual(expect.arrayContaining(['-t', '8', '-an']));
    expect(graphOf(args)).toContain('scale=640:-1');
    expect(framesArgs({ frames: { ...frames, count: 90 }, audio, shape: 'gif' }).args).toEqual(expect.arrayContaining(['-t', '3']));
  });

  it('refuses frames it cannot time', () => {
    expect(() => framesArgs({ frames: { ...frames, count: 0 }, audio, shape: 'wide' })).toThrow(/no frames/);
    expect(() => framesArgs({ frames: { ...frames, fps: 0 }, audio, shape: 'wide' })).toThrow(/no frames/);
  });
});

const hasTool = (name: string): boolean => {
  try {
    execFileSync(name, ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};
const ffmpegHere = hasTool('ffmpeg') && hasTool('ffprobe');

/** The width, height, length and stream kinds ffprobe reads of `file`. */
type Probed = { streams: { codec_type: string; width?: number; height?: number }[]; format: { duration: string } };

function probe(file: string) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height:format=duration', '-of', 'json', file], { encoding: 'utf8' });
  const { streams, format } = JSON.parse(out) as Probed;
  const video = streams.find((stream) => stream.codec_type === 'video');
  return { width: video?.width, height: video?.height, seconds: Number(format.duration), kinds: streams.map((stream) => stream.codec_type).sort() };
}

describe.skipIf(!ffmpegHere)('a pitch made with ffmpeg on fixtures', () => {
  it('gives pitch.mp4, pitch-square.mp4 and pitch.gif in their shapes and lengths', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pitch-video-'));
    const ff = (args: string[]) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { cwd: dir });
    ff(['-f', 'lavfi', '-i', 'testsrc=size=1280x720:rate=25:duration=12', '-c:v', 'libvpx', '-b:v', '300k', PITCH_INPUTS.walk]);
    for (const [name, size] of [['slide.png', '1920x1080'], ['close.png', '1920x1080'], ['slide-square.png', '1080x1080'], ['close-square.png', '1080x1080'], ['backdrop-square.png', '1080x1080']] as const) {
      ff(['-f', 'lavfi', '-i', `color=c=navy:size=${size}`, '-frames:v', '1', name]);
    }
    writeFileSync(join(dir, PITCH_INPUTS.music), pitchMusic('inside'));

    const made = makeVideos({ dir, exec: execFileSync });
    expect(made.files).toEqual(['pitch.mp4', 'pitch-square.mp4', 'pitch.gif']);

    const wide = probe(join(dir, 'pitch.mp4'));
    expect(wide).toMatchObject({ width: 1920, height: 1080, kinds: ['audio', 'video'] });
    expect(wide.seconds).toBeGreaterThanOrEqual(19.9);
    expect(wide.seconds).toBeLessThanOrEqual(30.1);
    const square = probe(join(dir, 'pitch-square.mp4'));
    expect(square).toMatchObject({ width: 1080, height: 1080, kinds: ['audio', 'video'] });
    const gif = probe(join(dir, 'pitch.gif'));
    expect(gif).toMatchObject({ width: 640, kinds: ['video'] });
    expect(gif.seconds).toBeLessThanOrEqual(8.1);
  });
});

// The ffmpeg recipe of a pitch (PRD 859 s4): a pure function of the files and the walk-through's length,
// with both cards, the fades and the cut length in its arguments; and, where ffmpeg is installed, a run
// on fixtures that gives pitch.mp4 (1920×1080, 20–30 s, an audio track), pitch-square.mp4 (1080×1080) and
// pitch.gif (at most 8 s, 640 px wide).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CARD_SECONDS, FADE_SECONDS, PITCH_INPUTS, normaliseArgs, pitchCut, pitchRecipe } from './ffmpeg.mjs';
import { pitchMusic } from './music.mjs';
import { makeVideos } from './run.mjs';

const graphOf = (args) => args[args.indexOf('-filter_complex') + 1];
const inputs = (args) => args.flatMap((arg, index) => (arg === '-i' ? [args[index + 1]] : []));

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

const hasTool = (name) => {
  try {
    execFileSync(name, ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};
const ffmpegHere = hasTool('ffmpeg') && hasTool('ffprobe');

/** The width, height, length and stream kinds ffprobe reads of `file`. */
function probe(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height:format=duration', '-of', 'json', file], { encoding: 'utf8' });
  const { streams, format } = JSON.parse(out);
  const video = streams.find((stream) => stream.codec_type === 'video');
  return { width: video.width, height: video.height, seconds: Number(format.duration), kinds: streams.map((stream) => stream.codec_type).sort() };
}

describe.skipIf(!ffmpegHere)('a pitch made with ffmpeg on fixtures', () => {
  it('gives pitch.mp4, pitch-square.mp4 and pitch.gif in their shapes and lengths', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pitch-video-'));
    const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { cwd: dir });
    ff(['-f', 'lavfi', '-i', 'testsrc=size=1280x720:rate=25:duration=12', '-c:v', 'libvpx', '-b:v', '300k', PITCH_INPUTS.walk]);
    for (const [name, size] of [['slide.png', '1920x1080'], ['close.png', '1920x1080'], ['slide-square.png', '1080x1080'], ['close-square.png', '1080x1080'], ['backdrop-square.png', '1080x1080']]) {
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

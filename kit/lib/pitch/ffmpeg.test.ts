// The ffmpeg recipe of a pitch (PRD 1108 s5): a pure function of the frames and the music, the fades and
// the cut length in its arguments. A real encode is the encode provider's test and the render's.
import { describe, expect, it } from 'vitest';
import { FADE_SECONDS, framesArgs } from './ffmpeg.ts';

const graphOf = (args: string[]): string | undefined => args[args.indexOf('-filter_complex') + 1];
const inputs = (args: string[]): (string | undefined)[] => args.flatMap((arg, index) => (arg === '-i' ? [args[index + 1]] : []));

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

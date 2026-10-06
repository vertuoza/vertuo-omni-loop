// The `ffmpeg` encode provider (PRD 1108 s5): the frames and the music into pitch.mp4, pitch-square.mp4 and
// pitch.gif — its calls against a faked child process, and, where ffmpeg is installed, a real encode of a
// small frame sequence checked with ffprobe.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { silenceWav } from '../../music.ts';
import { fakeExec, scratch } from '../fakes.ts';
import { ffmpegEncode } from './ffmpeg.ts';

describe('ffmpegEncode.video', () => {
  it('runs ffmpeg in the output folder on the numbered frames and returns the file it wrote', async () => {
    const dir = scratch('encode');
    const { exec, calls } = fakeExec();
    const file = await ffmpegEncode.video({ frames: { dir: '/run/frames', count: 90, fps: 30 }, audio: { file: '/run/music.mp3', start: 2 }, shape: 'square' }, { dir, exec });
    expect(file).toBe(join(dir, 'pitch-square.mp4'));
    expect(calls).toHaveLength(1);
    expect(calls[0]?.file).toBe('ffmpeg');
    expect(calls[0]?.args).toEqual(expect.arrayContaining(['-i', '/run/frames/frame-%05d.png', '-ss', '2', '/run/music.mp3']));
  });

  it('rejects when ffmpeg fails', async () => {
    const exec = () => {
      throw new Error('ffmpeg: no such file');
    };
    await expect(ffmpegEncode.video({ frames: { dir: '/run', count: 1, fps: 30 }, audio: null, shape: 'gif' }, { dir: scratch('encode'), exec })).rejects.toThrow('ffmpeg: no such file');
  });
});

const ffmpegHere = (() => {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    execFileSync('ffprobe', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

type Probed = { streams: { codec_type: string; width?: number; height?: number }[]; format: { duration: string } };

function probe(file: string) {
  const { streams, format } = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height:format=duration', '-of', 'json', file], { encoding: 'utf8' })) as Probed;
  const video = streams.find((stream) => stream.codec_type === 'video');
  return { width: video?.width, height: video?.height, seconds: Number(format.duration), kinds: streams.map((stream) => stream.codec_type).sort() };
}

describe.skipIf(!ffmpegHere)('a frame sequence encoded with ffmpeg', () => {
  it('gives the three files in their shapes, with the music only in the videos', async () => {
    const dir = scratch('encode-real');
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=size=480x270:rate=30:duration=3', join(dir, 'frame-%05d.png')]);
    writeFileSync(join(dir, 'music.wav'), silenceWav(5));
    const request = { frames: { dir, count: 90, fps: 30 }, audio: { file: join(dir, 'music.wav') } };
    const wide = probe(await ffmpegEncode.video({ ...request, shape: 'wide' }, { dir, exec: execFileSync }));
    expect(wide).toMatchObject({ width: 1920, height: 1080, kinds: ['audio', 'video'] });
    expect(wide.seconds).toBeCloseTo(3, 0);
    expect(probe(await ffmpegEncode.video({ ...request, shape: 'square' }, { dir, exec: execFileSync }))).toMatchObject({ width: 1080, height: 1080, kinds: ['audio', 'video'] });
    expect(probe(await ffmpegEncode.video({ ...request, shape: 'gif' }, { dir, exec: execFileSync }))).toMatchObject({ width: 640, kinds: ['video'] });
  });
});

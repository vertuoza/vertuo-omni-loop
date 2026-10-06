// The `ffmpeg` encode provider: the captured frames and the music made into one of a pitch's three
// files, with the recipe of `kit/lib/pitch/ffmpeg.ts`, run in the output folder. ffmpeg is the
// computer's own, as for PRD 859.
import { join } from 'node:path';
import { framesArgs } from '../../ffmpeg.ts';
import { FRAME_PATTERN } from '../types.ts';
import type { EncodeProvider } from '../types.ts';

export const ffmpegEncode: EncodeProvider = Object.freeze({
  kind: 'encode',
  id: 'ffmpeg',
  video: ({ frames, audio, shape }, { dir, exec }) =>
    Promise.resolve().then(() => {
      const { output, args } = framesArgs({ frames: { pattern: join(frames.dir, FRAME_PATTERN), count: frames.count, fps: frames.fps }, audio, shape });
      exec('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args], { cwd: dir, stdio: ['ignore', 'ignore', 'pipe'] });
      return join(dir, output);
    }),
});

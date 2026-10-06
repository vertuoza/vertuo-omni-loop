// The `none` music provider: silence for the video's length, so a pitch with no music encodes like any
// other. The kind's default: a setting naming a provider that is gone, or a track that cannot be had,
// falls back to it.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { silenceWav } from '../../music.ts';
import type { MusicProvider } from '../types.ts';

export const noneMusic: MusicProvider = Object.freeze({
  kind: 'music',
  id: 'none',
  pick: ({ seconds }, { dir }) =>
    Promise.resolve().then(() => {
      const file = join(dir, 'silence.wav');
      writeFileSync(file, silenceWav(seconds));
      return { file, licence: null, credit: null };
    }),
});

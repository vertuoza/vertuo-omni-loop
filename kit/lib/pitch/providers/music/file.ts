// The `file` music provider: the track a product uploaded with its Pitch settings, copied into the run's
// folder. Its licence is the product's own business: the run records that it was their file.
import { copyFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import type { MusicProvider } from '../types.ts';

export const fileMusic: MusicProvider = Object.freeze({
  kind: 'music',
  id: 'file',
  pick: async ({ asset }, context) => {
    if (asset === undefined) throw new Error('no uploaded track: the music settings name no file');
    const source = await context.asset(asset);
    const file = join(context.dir, `music${extname(source).toLowerCase() || '.mp3'}`);
    copyFileSync(source, file);
    return { file, licence: "the product's own file", credit: null };
  },
});

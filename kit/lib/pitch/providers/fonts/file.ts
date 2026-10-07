// The `file` fonts provider: a font file a product uploaded with its Pitch settings, copied into the
// run's fonts folder with its `@font-face` rule.
import { copyFileSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { FONTS_DIR, fontFace, slugOf, stackOf } from './css.ts';
import type { FontsProvider } from '../types.ts';

export const fileFonts: FontsProvider = Object.freeze({
  kind: 'fonts',
  id: 'file',
  load: async ({ family, weight, asset }, context) => {
    if (asset === undefined) throw new Error(`no uploaded file for the font "${family}"`);
    const source = await context.asset(asset);
    const path = `${FONTS_DIR}/${slugOf(family)}-${String(weight)}${extname(source).toLowerCase()}`;
    mkdirSync(join(context.dir, FONTS_DIR), { recursive: true });
    copyFileSync(source, join(context.dir, path));
    return { css: fontFace({ family, weight, path }), files: [path], stack: stackOf(family) };
  },
});

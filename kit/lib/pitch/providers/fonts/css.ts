// What every fonts provider writes the same way: where a font's files go in the run's folder, the CSS
// family stack a page uses, and an `@font-face` rule for a file of its own.
import { extname } from 'node:path';

/** The folder of a run where fonts are written, relative to the run's folder. */
export const FONTS_DIR = 'fonts';

/** The fallback stack every font ends with, and the whole stack of the system font. */
export const SYSTEM_STACK = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** The family's name as a file name: `Open Sans` → `open-sans`. */
export const slugOf = (family: string): string => family.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'font';

/** The CSS family stack for `family`, the system fonts after it. */
export const stackOf = (family: string): string => `"${family.replace(/["\\]/g, '')}", ${SYSTEM_STACK}`;

const FORMATS: Readonly<Record<string, string>> = Object.freeze({ '.woff2': 'woff2', '.woff': 'woff', '.ttf': 'truetype', '.otf': 'opentype' });

/** The `@font-face` rule of one font file, `path` relative to the run's folder. */
export function fontFace({ family, weight, path }: { family: string; weight: number; path: string }): string {
  const format = FORMATS[extname(path).toLowerCase()];
  const source = format === undefined ? `url("${path}")` : `url("${path}") format("${format}")`;
  return `@font-face { font-family: "${family.replace(/["\\]/g, '')}"; font-weight: ${String(weight)}; font-style: normal; font-display: block; src: ${source}; }\n`;
}

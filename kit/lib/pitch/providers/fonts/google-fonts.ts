// The `google-fonts` fonts provider: a family and a weight from Google Fonts' public CSS API, which needs
// no account and no key. The stylesheet it answers names its font files; each is downloaded into the
// run's fonts folder and the stylesheet rewritten to point at them, so the page renders offline.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { FONTS_DIR, slugOf, stackOf } from './css.ts';
import type { ProviderFetch, FontRequest, FontsProvider } from '../types.ts';

const API = 'https://fonts.googleapis.com/css2';
/** Google Fonts answers WOFF2 files to a browser that says it reads them. */
const BROWSER = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const FONT_URL = /url\((https:\/\/fonts\.gstatic\.com\/[^)\s]+)\)/g;

/** The stylesheet's address for one family at one weight. */
export const cssUrl = ({ family, weight }: FontRequest): string =>
  `${API}?family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@${String(weight)}&display=block`;

async function answered(fetch: ProviderFetch, url: string, what: string) {
  const answer = await fetch(url, { headers: { 'user-agent': BROWSER } });
  if (!answer.ok) throw new Error(`Google Fonts answered ${String(answer.status)} for ${what}`);
  return answer;
}

export const googleFonts: FontsProvider = Object.freeze({
  kind: 'fonts',
  id: 'google-fonts',
  load: async (request, { dir, fetch }) => {
    const what = `"${request.family}" ${String(request.weight)}`;
    const sheet = await (await answered(fetch, cssUrl(request), what)).text();
    const urls = [...new Set([...sheet.matchAll(FONT_URL)].map((match) => match[1] ?? ''))];
    if (urls.length === 0) throw new Error(`Google Fonts named no file for ${what}`);
    mkdirSync(join(dir, FONTS_DIR), { recursive: true });
    let css = sheet;
    const files: string[] = [];
    for (const [index, url] of urls.entries()) {
      const path = `${FONTS_DIR}/${slugOf(request.family)}-${String(request.weight)}-${String(index)}.woff2`;
      writeFileSync(join(dir, path), new Uint8Array(await (await answered(fetch, url, what)).arrayBuffer()));
      css = css.split(url).join(path);
      files.push(path);
    }
    return { css, files, stack: stackOf(request.family) };
  },
});

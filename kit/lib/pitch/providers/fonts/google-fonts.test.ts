// The `google-fonts` fonts provider (PRD 1108 s5): a family and a weight from Google Fonts' CSS API, its
// files downloaded beside the run, against a faked network only.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WOFF2, fakeAssets, fakeFetch, googleSheet, scratch } from '../fakes.ts';
import { cssUrl, googleFonts } from './google-fonts.ts';

const API = /^https:\/\/fonts\.googleapis\.com\/css2\?/;
const FILES = /^https:\/\/fonts\.gstatic\.com\//;
const load = (fetch: ReturnType<typeof fakeFetch>['fetch'], family = 'Open Sans', weight = 700) => {
  const dir = scratch('google-fonts');
  return { dir, font: googleFonts.load({ family, weight }, { dir, fetch, asset: fakeAssets({}) }) };
};

describe('cssUrl', () => {
  it('asks the CSS API for one family at one weight', () => {
    expect(cssUrl({ family: 'Open Sans', weight: 700 })).toBe('https://fonts.googleapis.com/css2?family=Open+Sans:wght@700&display=block');
    expect(cssUrl({ family: 'Gantari', weight: 400 })).toBe('https://fonts.googleapis.com/css2?family=Gantari:wght@400&display=block');
  });
});

describe('googleFonts.load', () => {
  it('downloads every file the stylesheet names and points the stylesheet at them', async () => {
    const network = fakeFetch([
      [API, googleSheet('Open Sans', 700, ['opensans/v40/latin', 'opensans/v40/latin-ext'])],
      [FILES, WOFF2],
    ]);
    const { dir, font } = load(network.fetch);
    const loaded = await font;
    expect(loaded.files).toEqual(['fonts/open-sans-700-0.woff2', 'fonts/open-sans-700-1.woff2']);
    expect(loaded.css).toContain('src: url(fonts/open-sans-700-0.woff2)');
    expect(loaded.css).toContain('src: url(fonts/open-sans-700-1.woff2)');
    expect(loaded.css).not.toContain('gstatic');
    expect(loaded.stack).toBe('"Open Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif');
    expect(new Uint8Array(readFileSync(join(dir, 'fonts/open-sans-700-0.woff2')))).toEqual(WOFF2);
    expect(network.calls.map((call) => call.url)).toEqual([
      'https://fonts.googleapis.com/css2?family=Open+Sans:wght@700&display=block',
      'https://fonts.gstatic.com/s/opensans/v40/latin.woff2',
      'https://fonts.gstatic.com/s/opensans/v40/latin-ext.woff2',
    ]);
    expect(network.calls.every((call) => /Chrome\//.test(call.headers['user-agent'] ?? ''))).toBe(true);
  });

  it('fails naming the family when the API refuses it or names no file', async () => {
    await expect(load(fakeFetch([[API, 400]]).fetch, 'Not A Font').font).rejects.toThrow('Google Fonts answered 400 for "Not A Font" 700');
    await expect(load(fakeFetch([[API, '/* nothing */']]).fetch).font).rejects.toThrow('Google Fonts named no file for "Open Sans" 700');
    await expect(load(fakeFetch([[API, googleSheet('Open Sans', 700, ['x'])], [FILES, 503]]).fetch).font).rejects.toThrow('Google Fonts answered 503');
  });
});

// The `file` fonts provider (PRD 1108 s5): a product's uploaded font, copied beside the run with its rule.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WOFF2, fakeAssets, fakeFetch, scratch } from '../fakes.ts';
import { fileFonts } from './file.ts';

describe('fileFonts.load', () => {
  it("copies the product's font into the run and writes its @font-face rule", async () => {
    const dir = scratch('font-file');
    const font = await fileFonts.load({ family: 'Brand Sans', weight: 700, asset: 'asset:Brand.WOFF2' }, { dir, fetch: fakeFetch([]).fetch, asset: fakeAssets({ 'Brand.WOFF2': WOFF2 }) });
    expect(font).toEqual({
      css: '@font-face { font-family: "Brand Sans"; font-weight: 700; font-style: normal; font-display: block; src: url("fonts/brand-sans-700.woff2") format("woff2"); }\n',
      files: ['fonts/brand-sans-700.woff2'],
      stack: '"Brand Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    });
    expect(new Uint8Array(readFileSync(join(dir, 'fonts/brand-sans-700.woff2')))).toEqual(WOFF2);
  });

  it('fails when the setting names no file, or the file is not there', async () => {
    const context = { dir: scratch('font-file'), fetch: fakeFetch([]).fetch, asset: fakeAssets({}) };
    await expect(fileFonts.load({ family: 'Brand', weight: 400 }, context)).rejects.toThrow('no uploaded file for the font "Brand"');
    await expect(fileFonts.load({ family: 'Brand', weight: 400, asset: 'asset:gone.ttf' }, context)).rejects.toThrow('no uploaded file asset:gone.ttf');
  });
});

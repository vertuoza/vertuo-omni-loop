// What the engine's render tests serve and compare (PRD 1108 s4). A small local server answers the built
// page under `/engine/` and one run folder per input under `/run/<name>/`: its `input.json`, the fixture's
// media drawn as SVG (the clip as numbered images, so every frame is exact), a logo, and two free fonts
// (OFL) the repository's design package already carries, so the text is drawn the same on every machine.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { z } from 'zod';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const ENGINE_DIR = join(repoRoot, 'kit/dist/pitch-engine');
const FONTS_DIR = join(repoRoot, 'packages/design/fonts');

/** The fonts the render tests load: a condensed Heading font and a plain Text font. */
export const TEST_FONTS = Object.freeze({
  css: [
    '@font-face { font-family: "Anton"; font-weight: 400; src: url("fonts/anton-latin-400-normal.woff2") format("woff2"); }',
    '@font-face { font-family: "Atkinson Hyperlegible Next"; font-weight: 400; src: url("fonts/atkinson-hyperlegible-next-latin-400-normal.woff2") format("woff2"); }',
    '@font-face { font-family: "Atkinson Hyperlegible Next"; font-weight: 700; src: url("fonts/atkinson-hyperlegible-next-latin-700-normal.woff2") format("woff2"); }',
  ].join('\n'),
  heading: '"Anton", sans-serif',
  text: '"Atkinson Hyperlegible Next", sans-serif',
});

/** The fixture clip decoded: 400 images of a 1600×1000 screen at 30 fps. */
export const TEST_CLIP = Object.freeze({ frames: 'frames/walk/{n}.svg', fps: 30, count: 400, width: 1600, height: 1000 });

/** A mock application screen: a side bar, rows, and a button whose bar grows with `n`. */
function screen(n: number, tint: string): string {
  const rows = [0, 1, 2, 3, 4, 5].map((row) => `<rect x="420" y="${220 + row * 110}" width="${900 - row * 60}" height="56" rx="10" fill="#d9dde8"/>`).join('');
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000">',
    '<rect width="1600" height="1000" fill="#f4f6fb"/>',
    `<rect width="320" height="1000" fill="${tint}"/>`,
    '<rect x="380" y="60" width="1160" height="100" rx="16" fill="#ffffff"/>',
    rows,
    `<rect x="1060" y="300" width="320" height="96" rx="48" fill="#2b2f3a"/>`,
    `<rect x="380" y="940" width="${Math.min(1160, n * 3)}" height="16" rx="8" fill="#8a93a8"/>`,
    '</svg>',
  ].join('');
}

const LOGO = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="48" viewBox="0 0 200 48"><rect width="48" height="48" rx="12" fill="#7a7a7a"/><rect x="64" y="14" width="136" height="20" rx="10" fill="#7a7a7a"/></svg>';

const TYPES: Readonly<Record<string, string>> = Object.freeze({ '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2' });

/** What the server answers for a path of a run folder, or nothing. */
function runFile(path: string, input: unknown): { body: string | Buffer; type: string } | undefined {
  if (path === 'input.json') return { body: JSON.stringify(input), type: 'application/json' };
  const frame = /^frames\/walk\/(\d+)\.svg$/.exec(path);
  if (frame !== null) return { body: screen(Number(frame[1]), '#3b4252'), type: 'image/svg+xml' };
  if (path === 'shots/before.png') return { body: screen(0, '#8c8c8c'), type: 'image/svg+xml' };
  if (path === 'shots/after.png') return { body: screen(400, '#2e7d5b'), type: 'image/svg+xml' };
  if (path === 'assets/logo.svg') return { body: LOGO, type: 'image/svg+xml' };
  if (path.startsWith('fonts/')) return { body: readFileSync(join(FONTS_DIR, path.slice('fonts/'.length))), type: 'font/woff2' };
  return undefined;
}

/** The answer to one request: the built page's files, or a run's. */
function answer(inputs: ReadonlyMap<string, unknown>, url: string): { body: string | Buffer; type: string } | undefined {
  const path = decodeURIComponent(new URL(url, 'http://localhost').pathname);
  if (path.startsWith('/engine/')) {
    const file = path.slice('/engine/'.length);
    return { body: readFileSync(join(ENGINE_DIR, file)), type: TYPES[extname(file)] ?? 'application/octet-stream' };
  }
  const run = /^\/run\/([^/]+)\/(.+)$/.exec(path);
  if (run === null) return undefined;
  const input = inputs.get(run[1] ?? '');
  return input === undefined ? undefined : runFile(run[2] ?? '', input);
}

export type Served = { origin: string; close: () => Promise<void> };

/** Serves the built page and one run folder per input, on a free local port. */
export async function serve(inputs: ReadonlyMap<string, unknown>): Promise<Served> {
  const server = createServer((request: IncomingMessage, response: ServerResponse) => {
    let found: { body: string | Buffer; type: string } | undefined;
    try {
      found = answer(inputs, request.url ?? '/');
    } catch {
      found = undefined;
    }
    if (found === undefined) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { 'content-type': found.type }).end(found.body);
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : 0;
  return { origin: `http://127.0.0.1:${port}`, close: () => new Promise((done) => server.close(() => { done(); })) };
}

/** The page of the run `name`. */
export const pageUrl = (served: Served, name: string): string => `${served.origin}/engine/index.html?input=/run/${name}/input.json`;

/** The size reference images are kept and compared at: a quarter of the frame each way. */
export const REFERENCE = Object.freeze({ width: 480, height: 270 });

/** How two images of the same size differ: the mean channel difference (0..255) and the share of pixels off by more than 48. */
export type Difference = { mean: number; off: number };

/** Runs in a blank page: draws PNGs on a canvas, scaled, and reads or compares their pixels. */
const PIXELS = `(() => {
  const load = (url) => new Promise((done, fail) => { const image = new Image(); image.onload = () => done(image); image.onerror = fail; image.src = url; });
  const pixels = async (url, width, height) => {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d');
    context.imageSmoothingQuality = 'high';
    context.drawImage(await load(url), 0, 0, width, height);
    return { canvas, data: context.getImageData(0, 0, width, height).data };
  };
  window.scaled = async (url, width, height) => (await pixels(url, width, height)).canvas.toDataURL('image/png');
  window.compare = async (a, b, width, height) => {
    const [one, two] = [(await pixels(a, width, height)).data, (await pixels(b, width, height)).data];
    let sum = 0, off = 0;
    for (let i = 0; i < one.length; i += 4) {
      const worst = Math.max(Math.abs(one[i] - two[i]), Math.abs(one[i + 1] - two[i + 1]), Math.abs(one[i + 2] - two[i + 2]));
      sum += Math.abs(one[i] - two[i]) + Math.abs(one[i + 1] - two[i + 1]) + Math.abs(one[i + 2] - two[i + 2]);
      if (worst > 48) off += 1;
    }
    const count = one.length / 4;
    return { mean: sum / (count * 3), off: off / count };
  };
  window.colours = async (url, width, height) => {
    const data = (await pixels(url, width, height)).data;
    const counts = {};
    for (let i = 0; i < data.length; i += 4) {
      const key = '#' + [data[i], data[i + 1], data[i + 2]].map((c) => c.toString(16).padStart(2, '0')).join('');
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  };
})()`;

/** A blank page with the pixel helpers, for working on images. */
export async function imagePage(page: Page): Promise<Page> {
  await page.goto('about:blank');
  await page.evaluate(PIXELS);
  return page;
}

const dataUrl = (png: Buffer): string => `data:image/png;base64,${png.toString('base64')}`;

/** Calls one of the pixel helpers with JSON arguments. */
const call = (tools: Page, helper: string, ...args: unknown[]): Promise<unknown> => tools.evaluate(`window.${helper}(${args.map((arg) => JSON.stringify(arg)).join(', ')})`);

/** A screenshot scaled to the reference size, as a PNG. */
export async function scaled(tools: Page, png: Buffer): Promise<Buffer> {
  const url = z.string().parse(await call(tools, 'scaled', dataUrl(png), REFERENCE.width, REFERENCE.height));
  return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
}

const DifferenceSchema = z.object({ mean: z.number(), off: z.number() });

/** How a scaled screenshot differs from its reference. */
export async function difference(tools: Page, png: Buffer, reference: Buffer): Promise<Difference> {
  return DifferenceSchema.parse(await call(tools, 'compare', dataUrl(png), dataUrl(reference), REFERENCE.width, REFERENCE.height));
}

/** How many pixels of a screenshot, at the reference size, hold each colour. */
export async function colourCounts(tools: Page, png: Buffer): Promise<Record<string, number>> {
  return z.record(z.string(), z.number()).parse(await call(tools, 'colours', dataUrl(png), REFERENCE.width, REFERENCE.height));
}

// `omni pitch film`, then a storyboard made from its moments (PRD 1108 s7, acceptance 7), through `main()`:
// a walk-through of a local test page is filmed into walk.webm and moments.json; a storyboard whose feature
// scene's camera comes from the moment `filter` passes the check; in the studio's page, the intro builds
// the PRD's title word by word in the Heading font the product uploaded; and in the feature scene's still,
// as `render --stills` draws it, the camera has zoomed on the element its moment names: the magenta Filter
// button fills the middle of the frame, where at zoom 1 it is a small patch right of centre.
//
// Runs in Playwright's Chromium with the computer's ffmpeg, where both are installed; elsewhere it skips.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { parseMoments } from '../../lib/pitch/moments.ts';
import type { Moment } from '../../lib/pitch/moments.ts';
import { main } from '../omni.ts';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const ANTON = join(repoRoot, 'packages/design/fonts/anton-latin-400-normal.woff2');

const hasTool = (name: string): boolean => {
  try {
    execFileSync(name, ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};
const browserHere = ((): boolean => {
  try {
    return existsSync(chromium.executablePath());
  } catch {
    return false;
  }
})();
const toolsHere = browserHere && hasTool('ffmpeg') && hasTool('ffprobe');

/** The page filmed: a quote list, and a magenta Filter button the walk-through hovers. */
const PAGE = `<!doctype html><html><body style="margin:0;background:#fff;font:20px sans-serif">
<div style="position:absolute;left:120px;top:120px;width:700px;height:60px;background:#dde2ee"></div>
<div style="position:absolute;left:120px;top:220px;width:700px;height:60px;background:#dde2ee"></div>
<button id="filter" style="position:absolute;left:1000px;top:400px;width:240px;height:80px;background:#ff00ff;border:0">Filter</button>
</body></html>`;

const TITLE = 'Quotes that send themselves';

/** `omni pitch <args>` on the run `dir`, the network answering nothing, the walk-through filmed in Chromium. */
async function omni(args: string[], { dir, studioUntil }: { dir: string; studioUntil?: (url: string) => Promise<void> }) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(['pitch', ...args], {
    cwd: dir, env: {}, fetch: () => Promise.resolve(new Response('', { status: 404 })), film: () => chromium.launch(), openBrowser: () => undefined, studioUntil,
    stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) },
  });
  return { code, out: out.join(''), err: err.join('') };
}

/** The storyboard the skill would write: the PRD's title, then the walk-through with the camera on `moment`, then the outro. */
const storyboardOn = (moment: Moment) => ({
  storyboard: 1,
  meta: { fps: 30, width: 1920, height: 1080, transition: 0.5, sources: ['spec.md', 'release.md'] },
  scenes: [
    { type: 'intro', duration: 3, eyebrow: 'New in Widgets', title: TITLE },
    {
      type: 'feature',
      duration: 4,
      layout: 'full',
      media: {
        kind: 'clip',
        file: 'walk.webm',
        start: Math.max(0, moment.at - 1),
        camera: [{ at: 0.2, zoom: 1, focus: { x: 0.5, y: 0.5 } }, { at: 1.4, zoom: moment.zoom, focus: moment.focus }],
      },
    },
    { type: 'outro', duration: 3, cta: 'Available now' },
  ],
});

/** Counts the magenta pixels of a screenshot, and where they sit, in a blank page's canvas. */
const MAGENTA = `async (url) => {
  const image = await new Promise((done, fail) => { const img = new Image(); img.onload = () => done(img); img.onerror = fail; img.src = url; });
  const canvas = document.createElement('canvas');
  canvas.width = image.width; canvas.height = image.height;
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0);
  const data = context.getImageData(0, 0, image.width, image.height).data;
  let count = 0, sx = 0, sy = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] > 190 && data[i + 1] < 90 && data[i + 2] > 190) { const p = i / 4; count += 1; sx += p % image.width; sy += Math.floor(p / image.width); }
  }
  return { share: count / (image.width * image.height), x: count ? sx / count / image.width : 0, y: count ? sy / count / image.height : 0 };
}`;
const MagentaSchema = z.object({ share: z.number(), x: z.number(), y: z.number() });

const TitleSchema = z.object({ font: z.string(), loaded: z.boolean(), words: z.array(z.tuple([z.string(), z.number()])) });

let server: Server | undefined;
let origin = '';
let browser: Browser | undefined;

beforeAll(async () => {
  server = createServer((_, response) => { response.writeHead(200, { 'content-type': 'text/html' }).end(PAGE); });
  await new Promise<void>((done) => server?.listen(0, '127.0.0.1', done));
  const address = server.address();
  origin = `http://127.0.0.1:${typeof address === 'object' && address !== null ? address.port : 0}`;
});

afterAll(async () => {
  await browser?.close();
  await new Promise((done) => server?.close(done));
});

/** A run folder as `omni pitch start` leaves it, the product's Heading font uploaded, and its walk-through. */
function run(): string {
  const dir = join(mkdtempSync(join(tmpdir(), 'pitch-film-run-')), 'run');
  mkdirSync(join(dir, 'assets'), { recursive: true });
  copyFileSync(ANTON, join(dir, 'assets/anton.woff2'));
  const look = { preset: 'keynote', heading: { provider: 'file', family: 'asset:anton.woff2', weight: 400 }, text: { provider: 'file', family: 'asset:anton.woff2', weight: 400 } };
  writeFileSync(join(dir, 'settings.json'), JSON.stringify({ look }));
  writeFileSync(join(dir, 'pitch.json'), JSON.stringify({ prd: 7, audience: 'customers', look: 'keynote', commit: 'abcdef1234' }));
  writeFileSync(join(dir, 'walk.json'), JSON.stringify({ walk: 1, url: `${origin}/`, steps: [{ do: 'hover', moment: 'filter', target: '#filter', pause: 1.5 }] }));
  return dir;
}

/** The magenta of an image: its share of the pixels, and where it sits, as 0..1 of the image. */
async function magentaOf(tools: Page, png: Buffer) {
  const url = `data:image/png;base64,${png.toString('base64')}`;
  return MagentaSchema.parse(await tools.evaluate(`(${MAGENTA})(${JSON.stringify(url)})`));
}

/** The intro's title at frame 15, mid-build: its font, whether that font loaded, each word and its opacity. */
async function titleAt(page: Page) {
  await page.evaluate('window.__pitchSeek(15)');
  return TitleSchema.parse(await page.evaluate(`(() => {
    const h1 = document.querySelector('h1');
    const words = [...h1.querySelectorAll('span > span')].map((word) => [word.textContent, Number(getComputedStyle(word).opacity)]);
    return { font: getComputedStyle(h1).fontFamily, loaded: document.fonts.check('400 64px "anton"'), words };
  })()`));
}

/** The opacity of each word of the intro's title once it has settled. */
async function settledTitle(page: Page): Promise<unknown> {
  await page.evaluate('window.__pitchSeek(80)');
  return page.evaluate("[...document.querySelector('h1').querySelectorAll('span > span')].map((word) => Number(getComputedStyle(word).opacity))");
}

/** What the studio's page showed of the intro's title: mid-build, and settled. */
type Seen = { title: z.infer<typeof TitleSchema>; settled: unknown };

/** Opens the studio's page at `url` and measures the intro's title. */
async function measure(url: string, opened: Browser): Promise<Seen> {
  const page = await opened.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(url);
  const title = await titleAt(page);
  const settled = await settledTitle(page);
  await page.close();
  return { title, settled };
}

describe.skipIf(!toolsHere)('omni pitch film, then the storyboard from its moments (acceptance 7)', () => {
  let dir = '';
  let filmed = { code: -1, out: '', err: '' };
  let checked = { code: -1, out: '', err: '' };
  let studio = { code: -1, out: '', err: '' };
  let stills = { code: -1, out: '', err: '' };
  let seen: Seen | undefined;
  let feature: z.infer<typeof MagentaSchema> | undefined;

  beforeAll(async () => {
    dir = run();
    filmed = await omni(['film', '.'], { dir });
    const moment = parseMoments(JSON.parse(readFileSync(join(dir, 'moments.json'), 'utf8')))?.steps[0];
    if (moment === undefined) throw new Error(`film wrote no moment: ${filmed.err}`);
    writeFileSync(join(dir, 'storyboard.json'), JSON.stringify(storyboardOn(moment)));
    checked = await omni(['check', '.'], { dir });
    const opened = await chromium.launch();
    browser = opened;
    studio = await omni(['studio', '.', '--no-open'], { dir, studioUntil: async (url) => { seen = await measure(url, opened); } });
    stills = await omni(['render', '.', '--stills'], { dir });
    const tools = await opened.newPage();
    feature = await magentaOf(tools, readFileSync(join(dir, 'stills/02-feature.png')));
  });

  it('films the walk-through: walk.webm, moments.json, and a line per moment with its box and camera', () => {
    expect({ code: filmed.code, err: filmed.err }).toEqual({ code: 0, err: '' });
    const lines = filmed.out.trim().split('\n');
    expect(lines.slice(0, 2)).toEqual([join(dir, 'walk.webm'), join(dir, 'moments.json')]);
    expect(lines[2]).toMatch(/^filter: hover at [\d.]+ s, box x 0\.52\d* y 0\.37\d* w 0\.125 h 0\.074\d*, camera zoom 3 on x 0\.58\d* y 0\.40\d*$/);
    expect(lines[3]).toMatch(/^[\d.]+ s$/);
    expect(checked.code, checked.err).toBe(0);
    expect(studio.code, studio.err).toBe(0);
    expect(stills.code, stills.err).toBe(0);
  });

  it("builds the PRD's title word by word in the Heading font the product uploaded", () => {
    if (seen === undefined) throw new Error('the studio page was not measured');
    const { title, settled } = seen;
    expect(title.font).toMatch(/^"?anton"?,/);
    expect(title.loaded).toBe(true);
    expect(title.words.map(([word]) => word)).toEqual(TITLE.split(' '));
    expect(title.words[0]?.[1]).toBeGreaterThan(0.5);
    expect(title.words[3]?.[1]).toBe(0);
    expect(settled).toEqual([1, 1, 1, 1]);
  });

  it("zooms the feature scene's still on the element its moment names: the button fills the middle of the frame", () => {
    // At zoom 1 the button is under half a percent of the frame, right of centre; at its moment's zoom, centred.
    if (feature === undefined) throw new Error('the feature still was not measured');
    expect(feature.share).toBeGreaterThan(0.03);
    expect(Math.abs(feature.x - 0.5)).toBeLessThan(0.06);
  });
});

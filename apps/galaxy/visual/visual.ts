// pnpm --filter @omni/galaxy-app visual — the PRD page's screenshot test (PRD omni-loop-10, s4).
//
// It starts the demo world (no database, no network: `next dev` with OMNI_LOOP_DEMO=1), shoots the
// PRD page of the demo's PRD at 1440x900 and 393x700 in Omni, Light and Dark, and compares each shot
// with its baseline committed in apps/galaxy/visual/baselines/. A shot whose differing pixels pass
// THRESHOLD fails the run; the diff images land in apps/galaxy/visual/diff/ (git ignores them, CI
// attaches them to the run as an artifact), never in the repository.
//
//   pnpm --filter @omni/galaxy-app visual                 compares; exit 1 on a difference
//   pnpm --filter @omni/galaxy-app visual --update        writes the baselines: the explicit command
//   GALAXY_URL=http://localhost:3000/ pnpm … visual       uses a dev server already running
//
// Only golden screens have baselines (ADR-0108); review screenshots are never committed. It is no
// vitest test: nothing here runs in `pnpm test`. Needs Playwright's Chromium, installed once:
//   pnpm --filter @omni/galaxy-app exec playwright install chromium
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import type { Browser, Page } from 'playwright';

/** The demo world's PRD (src/dossier/page/demo.ts, PRD 71) and the heading its page must show. */
const ROUTE = 'prd/71';
const HEADING = 'Ask mode';
/** The key the ask pages keep the theme under (src/ask/theme.ts, THEME_KEY). */
const THEME_KEY = 'omni-ask-theme';

const SIZES = [
  { name: '1440', width: 1440, height: 900 },
  { name: '393', width: 393, height: 700 },
];
const THEMES = ['omni', 'light', 'dark'];

/** A channel moves by more than this (of 255) before a pixel counts as different: anti-aliasing. */
const CHANNEL = 24;
/** The share of pixels that may differ before a shot fails. */
const THRESHOLD = 0.01;

const BASELINES = fileURLToPath(new URL('./baselines/', import.meta.url));
const DIFFS = fileURLToPath(new URL('./diff/', import.meta.url));
const APP = fileURLToPath(new URL('../', import.meta.url));

const update = process.argv.includes('--update');
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Finite animations are shown finished and the dev server's badge is left out. */
const STILL = `nextjs-portal { display: none !important; } *, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }`;

/** Starts `next dev` for the demo on a port of its own and waits until the PRD page answers. */
async function startServer(): Promise<{ base: string; stop: () => void }> {
  const given = process.env['GALAXY_URL'];
  if (given) return { base: given, stop: () => undefined };
  const port = 3217;
  const base = `http://localhost:${port}/`;
  const child = spawn('pnpm', ['exec', 'next', 'dev', '--port', String(port)], {
    cwd: APP, detached: true, stdio: 'ignore', env: { ...process.env, OMNI_LOOP_DEMO: '1' },
  });
  const stop = (): void => {
    try { process.kill(-(child.pid ?? 0)); } catch { /* already gone */ }
  };
  if (await answers(base)) return { base, stop };
  stop();
  throw new Error('the demo world never answered on ' + base);
}

/** Waits, up to three minutes, until the PRD page answers. */
async function answers(base: string): Promise<boolean> {
  for (let waited = 0; waited < 180_000; waited += 1000) {
    const ok = await fetch(new URL(ROUTE, base)).then((r) => r.ok, () => false);
    if (ok) return true;
    await sleep(1000);
  }
  return false;
}

/** Opens the PRD page and checks it is the demo PRD, not an error page. */
async function open(page: Page, base: string): Promise<void> {
  await page.goto(new URL(ROUTE, base).href, { waitUntil: 'load', timeout: 120_000 });
  await page.addStyleTag({ content: STILL });
  await page.evaluate(() => document.fonts.ready.then(() => true));
  const text = await page.evaluate(() => document.body.innerText);
  if (!text.includes(HEADING)) throw new Error(`/${ROUTE} should show the demo PRD ("${HEADING}")`);
  await sleep(500);
}

/** The pixels of two PNGs compared in the browser, which decodes them: no image library needed. */
type Verdict = { width: number; height: number; differing: number; total: number; diff: string };
function compareInPage(args: { a: string; b: string; channel: number }): Promise<Verdict> {
  const decode = async (b64: string): Promise<ImageData> => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('no canvas');
    ctx.drawImage(bitmap, 0, 0);
    return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  };
  const has = (img: ImageData, x: number, y: number): boolean => x < img.width && y < img.height;
  const at = (img: ImageData, x: number, y: number, c: number): number => img.data[(y * img.width + x) * 4 + c] ?? 0;
  const moved = (a: ImageData, b: ImageData, x: number, y: number): boolean => {
    if (!has(a, x, y) || !has(b, x, y)) return true;
    return [0, 1, 2, 3].some((c) => Math.abs(at(a, x, y, c) - at(b, x, y, c)) > args.channel);
  };
  // red where it moved, the baseline faded elsewhere
  const paint = (diff: ImageData, a: ImageData, x: number, y: number, hit: boolean): void => {
    const o = (y * diff.width + x) * 4;
    const grey = has(a, x, y) ? Math.round((at(a, x, y, 0) + 510) / 3) : 255;
    diff.data.set(hit ? [255, 0, 0, 255] : [grey, grey, grey, 255], o);
  };
  const scan = (a: ImageData, b: ImageData, diff: ImageData): number => {
    let differing = 0;
    for (let y = 0; y < diff.height; y++) {
      for (let x = 0; x < diff.width; x++) {
        const hit = moved(a, b, x, y);
        differing += Number(hit);
        paint(diff, a, x, y, hit);
      }
    }
    return differing;
  };
  const compare = (a: ImageData, b: ImageData): Verdict => {
    const out = document.createElement('canvas');
    out.width = Math.max(a.width, b.width);
    out.height = Math.max(a.height, b.height);
    const ctx = out.getContext('2d');
    if (!ctx) throw new Error('no canvas');
    const diff = ctx.createImageData(out.width, out.height);
    const differing = scan(a, b, diff);
    ctx.putImageData(diff, 0, 0);
    return { width: out.width, height: out.height, differing, total: out.width * out.height, diff: out.toDataURL('image/png').split(',')[1] ?? '' };
  };
  return Promise.all([decode(args.a), decode(args.b)]).then(([a, b]) => compare(a, b));
}

/** Shoots the PRD page in one theme at one size. */
async function shoot(browser: Browser, base: string, size: { width: number; height: number }, theme: string): Promise<Buffer> {
  const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  try {
    await context.addInitScript(({ key, value }) => { try { localStorage.setItem(key, value); } catch { /* none */ } }, { key: THEME_KEY, value: theme });
    const page = await context.newPage();
    await open(page, base);
    return await page.screenshot({ type: 'png' });
  } finally {
    await context.close();
  }
}

/** Compares a shot with its baseline; the failure line when it differs, or null. */
async function judge(browser: Browser, name: string, png: Buffer): Promise<string | null> {
  const file = BASELINES + name;
  if (!existsSync(file)) return `${name}: no baseline (run the visual script with --update)`;
  const page = await browser.newPage();
  const v = await page.evaluate(compareInPage, { a: readFileSync(file).toString('base64'), b: png.toString('base64'), channel: CHANNEL });
  await page.close();
  const share = v.differing / v.total;
  if (share <= THRESHOLD) {
    console.log(`ok ${name} (${(share * 100).toFixed(3)}% differ)`);
    return null;
  }
  mkdirSync(DIFFS, { recursive: true });
  writeFileSync(DIFFS + name, Buffer.from(v.diff, 'base64'));
  writeFileSync(DIFFS + name.replace('.png', '.actual.png'), png);
  return `${name}: ${(share * 100).toFixed(2)}% of pixels differ (limit ${(THRESHOLD * 100).toFixed(2)}%), diff in visual/diff/`;
}

/** One shot: written as a baseline under --update, else judged; the failure line or null. */
async function check(browser: Browser, name: string, png: Buffer): Promise<string | null> {
  if (!update) return judge(browser, name, png);
  writeFileSync(BASELINES + name, png);
  console.log(`baseline written: ${name}`);
  return null;
}

/** Every size in every theme; the failure lines. */
async function runAll(browser: Browser, base: string): Promise<string[]> {
  const failures: string[] = [];
  for (const size of SIZES) {
    for (const theme of THEMES) {
      const name = `prd-${theme}-${size.name}.png`;
      failures.push(await check(browser, name, await shoot(browser, base, size, theme)) ?? '');
    }
  }
  return failures.filter((f) => f !== '');
}

async function main(): Promise<void> {
  const server = await startServer();
  const browser = await chromium.launch();
  mkdirSync(BASELINES, { recursive: true });
  rmSync(DIFFS, { recursive: true, force: true });
  const failures = await runAll(browser, server.base).finally(async () => {
    await browser.close();
    server.stop();
  });
  for (const f of failures) console.error(`FAIL ${f}`);
  process.exitCode = Math.min(failures.length, 1);
}

await main();

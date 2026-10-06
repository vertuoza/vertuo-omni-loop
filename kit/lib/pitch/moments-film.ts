// `omni pitch film <dir>` (PRD 1108 s7): the run's `walk.json` played in Chromium at 1920×1080, filmed,
// signed in with the run's `storage-state.json` when it holds one, and written as `walk.mp4` and
// `moments.json` (./moments.ts).
//
// - A visible cursor glides to each element before it acts, and each step pauses so the clip is easy to
//   follow; each moment's time is when the cursor reaches its element.
// - A click on an element whose words save, send, delete or change something, or on a submit button, is
//   refused: the film stops there, nothing is written, and the one line says which step.
// - The browser films WebM, which often carries no length and seeks poorly; ffmpeg remuxes it into an MP4
//   with a keyframe every half second, so the engine's page can seek any frame of it.
//
// The browser is the repository's own Playwright, as for the render: the kit ships none.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { messageOf, propertyOf } from '../narrow.ts';
import { FILM_SIZE, MOMENTS_FILE, WALK_CLIP, WALK_FILE, boxOf, cameraOn, changingClick, parseWalk } from './moments.ts';
import type { Moment, Moments, Walk, WalkStep } from './moments.ts';
import type { Exec } from './providers/types.ts';

/** The signed-in session the walk-through loads when the run holds one (`omni proof session`). */
export const STORAGE_STATE = 'storage-state.json';
const FILM_DIR = 'film';
/** How long a step waits for its element, and pauses after it when it names no pause. */
const WAIT_MS = 10_000;
const PAUSE_S = 1;
/** A keyframe every half second at 30 fps: the page seeks any frame quickly. */
const KEYFRAMES = 15;

type Rect = { x: number; y: number; width: number; height: number };
/** The few calls on an element a walk-through makes; Playwright's locator meets them. */
export type FilmLocator = {
  first(): FilmLocator;
  waitFor(options: { state: 'visible'; timeout: number }): Promise<void>;
  scrollIntoViewIfNeeded(): Promise<void>;
  boundingBox(): Promise<Rect | null>;
};
/** The few calls on a page a walk-through makes; Playwright's page meets them. */
export type FilmPage = {
  goto(url: string): Promise<unknown>;
  evaluate(expression: string): Promise<unknown>;
  locator(selector: string): FilmLocator;
  mouse: { move(x: number, y: number, options: { steps: number }): Promise<void>; down(): Promise<void>; up(): Promise<void> };
  keyboard: { type(text: string, options: { delay: number }): Promise<void> };
  waitForTimeout(ms: number): Promise<void>;
  video(): { path(): Promise<string> } | null;
};
type FilmContextOptions = { viewport: { width: number; height: number }; recordVideo: { dir: string; size: { width: number; height: number } }; storageState?: string };
/** A browser that opens a filmed context; Playwright's browser meets it. */
export type FilmBrowser = {
  newContext(options: FilmContextOptions): Promise<{ newPage(): Promise<FilmPage>; addInitScript(script: string): Promise<void>; close(): Promise<void> }>;
  close(): Promise<void>;
};
/** Opens the browser a walk-through is filmed in: the repository's Chromium, or a test's. */
export type FilmLaunch = () => Promise<FilmBrowser>;

/** What stops a film: each line names what is wrong, and nothing is written. */
export class FilmRefused extends Error {
  lines: string[];

  constructor(lines: string[]) {
    super(lines.join('\n'));
    this.name = 'FilmRefused';
    this.lines = lines;
  }
}

/** A dot that follows the mouse and ripples on a press, drawn above the page: the clip's cursor. */
const CURSOR = `(() => {
  const draw = () => {
    const dot = document.createElement('div');
    dot.setAttribute('aria-hidden', 'true');
    dot.style.cssText = 'position:fixed;left:0;top:0;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:rgba(20,20,30,.55);border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);pointer-events:none;z-index:2147483647;transition:transform .12s;transform:translate(-100px,-100px)';
    document.documentElement.appendChild(dot);
    let at = [-100, -100];
    document.addEventListener('mousemove', (event) => { at = [event.clientX, event.clientY]; dot.style.transform = 'translate(' + at[0] + 'px,' + at[1] + 'px)'; }, true);
    document.addEventListener('mousedown', () => { dot.style.transform = 'translate(' + at[0] + 'px,' + at[1] + 'px) scale(.7)'; }, true);
    document.addEventListener('mouseup', () => { dot.style.transform = 'translate(' + at[0] + 'px,' + at[1] + 'px)'; }, true);
  };
  if (document.documentElement) draw(); else document.addEventListener('DOMContentLoaded', draw);
})()`;

/** What the guard reads of the element a click at (`x`, `y`) hits: the words of the control it is in, and whether it submits a form. */
const factsAt = (x: number, y: number): string => `(() => {
  const element = document.elementFromPoint(${String(x)}, ${String(y)});
  if (!element) return { words: '', submits: false };
  const control = element.closest('button, a, input, [role=button], [role=menuitem]') || element;
  const words = [control.innerText, control.getAttribute('aria-label'), control.getAttribute('title'), control.getAttribute('value')].filter(Boolean).join(' ');
  return { words, submits: control.type === 'submit' && Boolean(control.form) };
})()`;

const FactsSchema = z.object({ words: z.string(), submits: z.boolean() });

/** One step's place in its one line. */
const stepName = (index: number, step: WalkStep): string => `step ${String(index + 1)} (${step.do}${'target' in step ? ` ${step.target}` : ''})`;

/** A walk-through being filmed: its page, when its clip started, and the moments so far. */
type Filming = { page: FilmPage; started: number; now: () => number; moments: Moment[] };

/** Refuses a click at (`x`, `y`) that would change production. */
async function guardClick(page: FilmPage, { x, y }: { x: number; y: number }, label: string): Promise<void> {
  const why = changingClick(FactsSchema.parse(await page.evaluate(factsAt(x, y))));
  if (why !== null) throw new FilmRefused([`${label}: refused: the walk-through only looks, and this click would change production (${why})`]);
}

/** The box on the page of the element a step acts on, waited for and scrolled into view. */
async function reach(page: FilmPage, target: string, label: string): Promise<Rect> {
  const element = page.locator(target).first();
  try {
    await element.waitFor({ state: 'visible', timeout: WAIT_MS });
  } catch {
    throw new FilmRefused([`${label}: no visible element matches ${target}`]);
  }
  await element.scrollIntoViewIfNeeded();
  const rect = await element.boundingBox();
  if (rect === null) throw new FilmRefused([`${label}: ${target} is not on the page`]);
  return rect;
}

/** Plays one step that acts on an element, and records its moment. */
async function actOn(filming: Filming, step: Extract<WalkStep, { target: string }>, label: string): Promise<void> {
  const { page } = filming;
  const rect = await reach(page, step.target, label);
  const centre = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  if (step.do === 'click') await guardClick(page, centre, label);
  await page.mouse.move(centre.x, centre.y, { steps: 25 });
  const at = Math.round((filming.now() - filming.started) / 10) / 100;
  if (step.do === 'click' || step.do === 'type') {
    await page.mouse.down();
    await page.mouse.up();
  }
  if (step.do === 'type') await page.keyboard.type(step.text, { delay: 80 });
  const box = boxOf(rect, FILM_SIZE);
  filming.moments.push({ name: step.moment, do: step.do, at, box, ...cameraOn(box) });
  await page.waitForTimeout((step.pause ?? PAUSE_S) * 1000);
}

/** Plays step `index` of the walk-through. */
async function play(filming: Filming, step: WalkStep, index: number): Promise<void> {
  const label = stepName(index, step);
  if (step.do === 'wait') return filming.page.waitForTimeout(step.seconds * 1000);
  if (step.do === 'goto') {
    await filming.page.goto(step.url);
    return filming.page.waitForTimeout((step.pause ?? PAUSE_S) * 1000);
  }
  return actOn(filming, step, label);
}

/** Films the walk-through into `film/` of the run; the WebM the browser wrote, and the moments. */
async function filmWalk(dir: string, walk: Walk, { launch, now }: { launch: FilmLaunch; now: () => number }): Promise<{ webm: string; moments: Moment[] }> {
  const storage = join(dir, STORAGE_STATE);
  const browser = await launch();
  try {
    const context = await browser.newContext({
      viewport: { ...FILM_SIZE },
      recordVideo: { dir: join(dir, FILM_DIR), size: { ...FILM_SIZE } },
      ...(existsSync(storage) ? { storageState: storage } : {}),
    });
    await context.addInitScript(CURSOR);
    const page = await context.newPage();
    const filming: Filming = { page, started: now(), now, moments: [] };
    try {
      await page.goto(walk.url);
      await page.waitForTimeout(PAUSE_S * 1000);
      for (const [index, step] of walk.steps.entries()) await play(filming, step, index);
      await page.waitForTimeout(PAUSE_S * 1000);
    } finally {
      await context.close();
    }
    const video = page.video();
    if (video === null) throw new FilmRefused(['the browser filmed nothing']);
    return { webm: await video.path(), moments: filming.moments };
  } finally {
    await browser.close();
  }
}

/** The ffmpeg arguments that remux a WebM into an MP4 the page seeks well: H.264, a keyframe every half second, no sound. */
export const remuxArgs = (webm: string, mp4: string): string[] => [
  '-hide_banner', '-loglevel', 'error', '-y', '-i', webm,
  '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '30',
  '-g', String(KEYFRAMES), '-keyint_min', String(KEYFRAMES), '-sc_threshold', '0',
  '-movflags', '+faststart', '-an', mp4,
];

/** The length of a clip in seconds, as ffprobe reads it. */
function clipSeconds(exec: Exec, file: string): number {
  const out = String(exec('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', file], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  const seconds = Number(out.trim());
  if (!Number.isFinite(seconds) || seconds <= 0) throw new FilmRefused([`ffprobe reads no length in ${WALK_CLIP}`]);
  return Math.round(seconds * 100) / 100;
}

/** The run's walk-through, read and checked. */
function readWalk(dir: string): Walk {
  const file = join(dir, WALK_FILE);
  if (!existsSync(file)) throw new FilmRefused([`the run holds no ${WALK_FILE} yet`]);
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new FilmRefused([`${WALK_FILE} does not read as JSON: ${messageOf(error)}`]);
  }
  const parsed = parseWalk(value);
  if (parsed.walk === undefined) throw new FilmRefused(parsed.errors.map((line) => (line.startsWith(WALK_FILE) ? line : `${WALK_FILE}: ${line}`)));
  return parsed.walk;
}

const isLauncher = (value: unknown): value is { launch(): Promise<FilmBrowser> } => typeof propertyOf(value, 'launch') === 'function';

/** Chromium from the Playwright the repository at `cwd` installed, else the one beside the kit. */
export function repositoryBrowser(cwd: string): FilmLaunch {
  return async () => {
    for (const from of [join(cwd, 'package.json'), import.meta.url]) {
      for (const name of ['playwright', '@playwright/test']) {
        let resolved: string;
        try {
          resolved = createRequire(from).resolve(name);
        } catch {
          continue;
        }
        const loaded: unknown = await import(pathToFileURL(resolved).href);
        const chromium = propertyOf(loaded, 'chromium') ?? propertyOf(propertyOf(loaded, 'default'), 'chromium');
        if (isLauncher(chromium)) return chromium.launch();
      }
    }
    throw new FilmRefused(['Playwright is needed to film the walk-through: install playwright in the repository']);
  };
}

/** What filming reaches the world through: a child process, a browser and a clock. */
export type FilmTools = { exec: Exec; launch: FilmLaunch; now?: () => number };

/** Films the run in `dir`: writes `walk.mp4` and `moments.json`, and answers the moments. Throws `FilmRefused`, writing nothing. */
export async function filmRun(dir: string, { exec, launch, now = Date.now }: FilmTools): Promise<Moments> {
  const walk = readWalk(dir);
  const work = join(dir, FILM_DIR);
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });
  try {
    const { webm, moments } = await filmWalk(dir, walk, { launch, now });
    const clip = join(dir, WALK_CLIP);
    exec('ffmpeg', remuxArgs(webm, clip), { stdio: ['ignore', 'ignore', 'pipe'] });
    const result: Moments = { moments: 1, clip: WALK_CLIP, width: FILM_SIZE.width, height: FILM_SIZE.height, seconds: clipSeconds(exec, clip), steps: moments };
    writeFileSync(join(dir, MOMENTS_FILE), `${JSON.stringify(result, null, 2)}\n`);
    return result;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

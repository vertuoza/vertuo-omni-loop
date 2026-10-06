// `omni pitch film`'s core (PRD 1108 s7, the spec's test seam 7): a walk-through of a local test page writes
// moments.json whose boxes match its elements, and walk.webm, encoded again so it carries its length and a
// keyframe every half second. A click that would change something is refused, and nothing is written.
// Runs in Playwright's Chromium with the computer's ffmpeg, where both are installed.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FilmRefused, filmRun, remuxArgs } from './moments-film.ts';
import { parseMoments } from './moments.ts';
import type { Moment, Moments } from './moments.ts';

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

/** The test page: a magenta Filter button, a search field, a Save button, and totals far below. */
const PAGE = `<!doctype html><html><body style="margin:0;background:#fff;height:3000px;font:20px sans-serif">
<button id="filter" style="position:absolute;left:1000px;top:400px;width:240px;height:80px;background:#ff00ff;border:0">Filter</button>
<input id="search" name="q" style="position:absolute;left:200px;top:160px;width:400px;height:40px;box-sizing:border-box">
<form><button id="go" style="position:absolute;left:200px;top:700px;width:120px;height:40px">Go</button></form>
<button id="save" style="position:absolute;left:600px;top:700px;width:120px;height:40px">Save</button>
<div id="totals" style="position:absolute;left:300px;top:2400px;width:600px;height:60px;background:#00c000">Totals</div>
</body></html>`;

let server: Server | undefined;
let origin = '';

beforeAll(async () => {
  server = createServer((_, response) => { response.writeHead(200, { 'content-type': 'text/html' }).end(PAGE); });
  await new Promise<void>((done) => server?.listen(0, '127.0.0.1', done));
  const address = server.address();
  origin = `http://127.0.0.1:${typeof address === 'object' && address !== null ? address.port : 0}`;
});

afterAll(async () => {
  await new Promise((done) => server?.close(done));
});

const exec = (file: string, args: readonly string[], options: object) => execFileSync(file, args, options);
const tools = () => ({ exec, launch: () => chromium.launch() });

/** A run folder holding `walk`. */
function runWith(walk: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), 'pitch-film-'));
  writeFileSync(join(dir, 'walk.json'), JSON.stringify(walk));
  return dir;
}

/** The colour of the clip's pixel at (`x`, `y`) at `seconds`. */
function pixelAt(clip: string, seconds: number, x: number, y: number): number[] {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-ss', String(seconds), '-i', clip, '-frames:v', '1', '-vf', `crop=2:2:${x}:${y}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
  return [raw[0] ?? 0, raw[1] ?? 0, raw[2] ?? 0];
}

describe('remuxArgs', () => {
  it('encodes a VP8 WebM, which the Chromium the render draws in plays, with a keyframe every 15 frames and no sound', () => {
    const args = remuxArgs('film/raw.webm', 'walk.webm');
    expect(args.join(' ')).toContain('-i film/raw.webm -c:v libvpx');
    expect(args.join(' ')).toContain('-g 15 -keyint_min 15');
    expect(args).toContain('-an');
    expect(args.at(-1)).toBe('walk.webm');
  });
});

describe('filmRun: what stops it, before a browser opens', () => {
  it('refuses a run with no walk.json', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pitch-film-'));
    await expect(filmRun(dir, tools())).rejects.toThrow('the run holds no walk.json yet');
  });

  it('refuses a walk.json out of shape, naming each field', async () => {
    const dir = runWith({ walk: 1, url: 'ftp://x', steps: [] });
    const error: unknown = await filmRun(dir, tools()).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(FilmRefused);
    expect(error instanceof FilmRefused ? error.lines : []).toEqual(['walk.json: url: an http or https address', 'walk.json: steps: Too small: expected array to have >=1 items']);
  });
});

/** A moment the film wrote, by name. */
function momentOf(moments: Moments, name: string): Moment {
  const found = moments.steps.find((step) => step.name === name);
  if (found === undefined) throw new Error(`no moment ${name}`);
  return found;
}

/** Each corner of `box` within two hundredths of `expected`'s. */
function expectNear(box: Moment['box'], expected: Moment['box']): void {
  for (const key of ['x', 'y', 'w', 'h'] as const) expect(box[key], key).toBeCloseTo(expected[key], 2);
}

describe.skipIf(!toolsHere)('filmRun on a local test page', () => {
  let dir = '';
  let moments: Moments = { moments: 1, clip: 'walk.webm', width: 1920, height: 1080, seconds: 1, steps: [] };

  beforeAll(async () => {
    dir = runWith({
      walk: 1,
      url: `${origin}/`,
      steps: [
        { do: 'hover', moment: 'filter', target: '#filter', pause: 0.8 },
        { do: 'type', moment: 'search', target: '#search', text: 'kitchen', pause: 0.5 },
        { do: 'scroll', moment: 'totals', target: '#totals', pause: 0.5 },
      ],
    });
    moments = await filmRun(dir, tools());
  });

  it('writes moments.json, one moment per step that acts on an element, in order', () => {
    expect(parseMoments(JSON.parse(readFileSync(join(dir, 'moments.json'), 'utf8')))).toEqual(moments);
    expect(moments.steps.map((step) => [step.name, step.do])).toEqual([['filter', 'hover'], ['search', 'type'], ['totals', 'scroll']]);
    const times = moments.steps.map((step) => step.at);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(moments.seconds).toBeGreaterThan(momentOf(moments, 'totals').at);
    expect(existsSync(join(dir, 'film'))).toBe(false);
  });

  it("gives each moment its element's box, and the camera on its centre", () => {
    expectNear(momentOf(moments, 'filter').box, { x: 1000 / 1920, y: 400 / 1080, w: 240 / 1920, h: 80 / 1080 });
    expectNear(momentOf(moments, 'search').box, { x: 200 / 1920, y: 160 / 1080, w: 400 / 1920, h: 40 / 1080 });
    const { focus } = momentOf(moments, 'filter');
    expect(focus.x).toBeCloseTo(1120 / 1920, 2);
    expect(focus.y).toBeCloseTo(440 / 1080, 2);
  });

  it('boxes an element it scrolled to where the clip shows it, within the frame', () => {
    const { box } = momentOf(moments, 'totals');
    expect(box.w).toBeCloseTo(600 / 1920, 2);
    expect(box.y).toBeGreaterThan(0);
    expect(box.y + box.h).toBeLessThan(1);
  });

  it('writes walk.webm with a keyframe every half second, showing the element where its box says', () => {
    const clip = join(dir, 'walk.webm');
    const keyframes = execFileSync('ffprobe', ['-v', 'error', '-skip_frame', 'nokey', '-select_streams', 'v', '-show_entries', 'frame=pts_time', '-of', 'csv=p=0', clip], { encoding: 'utf8' }).trim().split('\n');
    expect(keyframes.length).toBeGreaterThanOrEqual(Math.floor(moments.seconds * 2) - 1);
    const [r = 0, g = 255, b = 0] = pixelAt(clip, momentOf(moments, 'filter').at + 0.4, 1030, 420);
    expect(r).toBeGreaterThan(200);
    expect(g).toBeLessThan(60);
    expect(b).toBeGreaterThan(200);
  });

  it.each([
    ['#save', 'its words say "save"'],
    ['#go', 'it submits a form'],
  ])('refuses a click on %s, which would change production, and writes nothing', async (target, why) => {
    const dir = runWith({ walk: 1, url: `${origin}/`, steps: [{ do: 'hover', moment: 'filter', target: '#filter', pause: 0.2 }, { do: 'click', moment: 'change', target }] });
    const error: unknown = await filmRun(dir, tools()).catch((caught: unknown) => caught);
    expect(error instanceof FilmRefused ? error.lines : error).toEqual([`step 2 (click ${target}): refused: the walk-through only looks, and this click would change production (${why})`]);
    expect(existsSync(join(dir, 'moments.json'))).toBe(false);
    expect(existsSync(join(dir, 'walk.webm'))).toBe(false);
    expect(existsSync(join(dir, 'film'))).toBe(false);
  });

  it('names a step whose element is not on the page', async () => {
    const dir = runWith({ walk: 1, url: `${origin}/`, steps: [{ do: 'hover', moment: 'gone', target: '#nowhere' }] });
    const error: unknown = await filmRun(dir, { ...tools(), now: Date.now }).catch((caught: unknown) => caught);
    expect(error instanceof FilmRefused ? error.lines : error).toEqual(['step 1 (hover #nowhere): no visible element matches #nowhere']);
  });
});

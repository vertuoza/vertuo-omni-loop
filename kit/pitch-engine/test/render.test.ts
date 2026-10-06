// The engine rendered in a browser (PRD 1108 s4): the built page, `kit/dist/pitch-engine/`, draws the
// fixture storyboard at fixed frames — the intro at 0.5 s, the feature's camera at its zoom's peak, the
// outro settled — and each matches its reference image within a small tolerance. The same frame drawn in
// two looks holds each look's colours. Runs in Playwright's Chromium, where that browser is installed.
//
// A reference image missing is written, and the test fails asking for it to be looked at and committed:
// to renew one, delete it and run the test again.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { presetLook } from '../../lib/pitch/settings.ts';
import type { PitchLook } from '../../lib/pitch/settings.ts';
import { fixtureStoryboard } from '../../lib/pitch/storyboard.fixture.ts';
import { buildTimeline, stillFrame } from '../timeline.ts';
import { REFERENCE, TEST_CLIP, TEST_FONTS, colourCounts, difference, imagePage, pageUrl, scaled, serve } from './harness.ts';
import type { Served } from './harness.ts';

/** What the page reads of its intro title: its font, whether that font loaded, and each word with its opacity. */
const TitleSchema = z.object({ font: z.string(), loaded: z.boolean(), words: z.array(z.tuple([z.string(), z.number()])) });

const REFERENCES = fileURLToPath(new URL('references/', import.meta.url));

/** The tolerance: the mean channel difference, and the share of pixels far off, at the reference size. */
const TOLERANCE = Object.freeze({ mean: 4, off: 0.02 });

const browserHere = ((): boolean => {
  try {
    return existsSync(chromium.executablePath());
  } catch {
    return false;
  }
})();

const timeline = buildTimeline(fixtureStoryboard());
const sceneAt = (index: number) => {
  const scene = timeline.scenes[index];
  if (scene === undefined) throw new Error(`the fixture has no scene ${index}`);
  return scene;
};

/** The frames compared with references: the intro at 0.5 s, the feature at its camera's peak, the outro settled. */
const FIXED = Object.freeze([
  { name: 'intro-0.5s', frame: 15 },
  { name: 'feature-zoom-peak', frame: sceneAt(2).from + 2 * 30 },
  { name: 'outro', frame: stillFrame(sceneAt(5), 30) },
]);

const inputOf = (look: PitchLook, logo: boolean) => ({
  storyboard: fixtureStoryboard(),
  look,
  fonts: TEST_FONTS,
  logo: logo ? 'assets/logo.svg' : null,
  credits: ['Music: none'],
  clips: { 'clips/walk.webm': TEST_CLIP },
});

describe.skipIf(!browserHere)('the engine page in a browser', () => {
  let browser: Browser | undefined;
  let served: Served | undefined;
  let tools: Page | undefined;

  beforeAll(async () => {
    const keynote = { ...presetLook('keynote'), heading: { provider: 'file', family: 'Anton', weight: 400 } };
    served = await serve(
      new Map<string, unknown>([
        ['keynote', inputOf(keynote, true)],
        ['keynote-bare', inputOf(keynote, false)],
        ['arcade-bare', inputOf(presetLook('arcade'), false)],
        ['broken', { ...inputOf(keynote, false), storyboard: { storyboard: 1 } }],
      ]),
    );
    browser = await chromium.launch();
    tools = await imagePage(await browser.newPage());
  });

  afterAll(async () => {
    await browser?.close();
    await served?.close();
  });

  /** A page of the run `name`, at the video's size. */
  async function open(name: string): Promise<Page> {
    if (browser === undefined || served === undefined) throw new Error('the browser did not start');
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.goto(pageUrl(served, name));
    return page;
  }

  /** Frame `frame` of an open page, settled, as a PNG. */
  async function shoot(page: Page, frame: number): Promise<Buffer> {
    await page.evaluate(`window.__pitchSeek(${frame})`);
    return page.screenshot();
  }

  const helpers = (): Page => {
    if (tools === undefined) throw new Error('the browser did not start');
    return tools;
  };

  it('answers the video it draws: its size, its frames and its scenes, each with a settled still', async () => {
    const page = await open('keynote');
    const info = await page.evaluate('window.__pitchInfo()');
    expect(info).toEqual({
      fps: 30,
      width: 1920,
      height: 1080,
      frames: timeline.frames,
      scenes: timeline.scenes.map((scene) => ({ type: scene.scene.type, from: scene.from, frames: scene.frames, still: stillFrame(scene, 30) })),
    });
    await page.close();
  });

  for (const { name, frame } of FIXED) {
    it(`draws ${name} (frame ${frame}) as its reference image, within the tolerance`, async () => {
      const page = await open('keynote');
      const shot = await scaled(helpers(), await shoot(page, frame));
      await page.close();
      const file = join(REFERENCES, `${name}.png`);
      if (!existsSync(file)) {
        mkdirSync(REFERENCES, { recursive: true });
        writeFileSync(file, shot);
        throw new Error(`wrote the missing reference ${file} (${REFERENCE.width}×${REFERENCE.height}): look at it, then commit it`);
      }
      const seen = await difference(helpers(), shot, readFileSync(file));
      expect(seen.mean).toBeLessThan(TOLERANCE.mean);
      expect(seen.off).toBeLessThan(TOLERANCE.off);
    });
  }

  it('tells two different frames apart: the tolerance is no blank cheque', async () => {
    const page = await open('keynote');
    const intro = await scaled(helpers(), await shoot(page, FIXED[0]?.frame ?? 0));
    const outro = await scaled(helpers(), await shoot(page, FIXED[2]?.frame ?? 0));
    await page.close();
    const seen = await difference(helpers(), intro, outro);
    expect(seen.mean > TOLERANCE.mean || seen.off > TOLERANCE.off).toBe(true);
  });

  it('draws the same pixels for a frame however it is reached', async () => {
    const page = await open('keynote');
    const first = await shoot(page, FIXED[1]?.frame ?? 0);
    await shoot(page, 15);
    await shoot(page, 600);
    const again = await shoot(page, FIXED[1]?.frame ?? 0);
    await page.close();
    expect(again.equals(first)).toBe(true);
  });

  it('builds the intro title word by word in the Heading font', async () => {
    const page = await open('keynote');
    await page.evaluate('window.__pitchSeek(15)');
    const title = TitleSchema.parse(await page.evaluate(`(() => {
      const h1 = document.querySelector('h1');
      const words = [...h1.querySelectorAll('span > span')].map((word) => [word.textContent, Number(getComputedStyle(word).opacity)]);
      return { font: getComputedStyle(h1).fontFamily, loaded: document.fonts.check('400 64px "Anton"'), words };
    })()`));
    await page.evaluate('window.__pitchSeek(80)');
    const settled = await page.evaluate("[...document.querySelector('h1').querySelectorAll('span > span')].map((word) => Number(getComputedStyle(word).opacity))");
    await page.close();
    expect(title.font).toMatch(/^"?Anton"?,/);
    expect(title.loaded).toBe(true);
    const words = title.words;
    expect(words.map(([word]) => word)).toEqual(['Quotes', 'that', 'send', 'themselves']);
    expect(words[0]?.[1]).toBeGreaterThan(0.5);
    expect(words[3]?.[1]).toBe(0);
    expect(settled).toEqual([1, 1, 1, 1]);
  });

  it("zooms the feature's camera on its focus at the zoom's peak", async () => {
    const page = await open('keynote');
    await page.evaluate(`window.__pitchSeek(${FIXED[1]?.frame ?? 0})`);
    const transforms = await page.evaluate("[...document.querySelectorAll('div')].map((div) => div.style.transform).filter((t) => t.startsWith('translate(') && t.includes(') scale('))");
    await page.close();
    expect(transforms).toEqual(expect.arrayContaining([expect.stringMatching(/scale\(2\.2\)$/)]));
  });

  it('paints the same frame in each look’s own colours', async () => {
    const statement = stillFrame(sceneAt(1), 30);
    const counts = async (name: string) => {
      const page = await open(name);
      const shot = await shoot(page, statement);
      await page.close();
      return colourCounts(helpers(), shot);
    };
    const near = (counted: Record<string, number>, hex: string, within: number): number => {
      const channels = (colour: string) => [1, 3, 5].map((at) => Number.parseInt(colour.slice(at, at + 2), 16));
      const target = channels(hex);
      return Object.entries(counted).reduce((sum, [colour, count]) => (channels(colour).every((c, i) => Math.abs(c - (target[i] ?? 0)) <= within) ? sum + count : sum), 0);
    };
    const total = REFERENCE.width * REFERENCE.height;
    const keynote = presetLook('keynote').colors;
    const arcade = presetLook('arcade').colors;
    const [inKeynote, inArcade] = [await counts('keynote-bare'), await counts('arcade-bare')];
    expect(near(inKeynote, keynote.paper, 24) / total).toBeGreaterThan(0.4);
    expect(near(inKeynote, keynote.ink, 40)).toBeGreaterThan(200);
    expect(near(inKeynote, arcade.paper, 24) / total).toBeLessThan(0.1);
    expect(near(inArcade, arcade.paper, 24) / total).toBeGreaterThan(0.4);
    expect(near(inArcade, arcade.ink, 40)).toBeGreaterThan(200);
    expect(near(inArcade, keynote.paper, 24) / total).toBeLessThan(0.1);
  });

  it('refuses to seek a page whose input is wrong, naming the problem, and shows it', async () => {
    const page = await open('broken');
    await expect(page.evaluate('window.__pitchSeek(0)')).rejects.toThrow(/storyboard\.meta/);
    expect(await page.textContent('pre')).toMatch(/storyboard\.meta/);
    await page.close();
  });
});

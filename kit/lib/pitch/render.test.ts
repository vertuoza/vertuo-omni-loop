// The render's steps (PRD 1108 s6), on a faked browser and a faked ffmpeg: the page is asked what the
// video is, the stills take each scene's still frame and a contact sheet, the videos take every frame,
// the intro's still becomes the two slides, the music starts on the sync point, pitch.json records it all,
// and the work folder is gone after, whether the render ends well or not. A real render of the fixture
// run is kit/bin/commands/pitch-make-render.test.ts. The outro's credits (PRD 2030 s6): `Built by <team>`
// then the music's credit, each only when present, and none when the settings hide credits.
import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contractNetwork, fakeExec, scratch } from './providers/fakes.ts';
import type { CaptureBrowser, Launch } from './providers/types.ts';
import { RenderRefused, creditsOf, renderRun, syncSecondsOf } from './render.ts';
import type { PageInfo } from './render.ts';
import { defaultPitchSettings } from './settings.ts';
import { fixtureStoryboard } from './storyboard.fixture.ts';
import type { Storyboard } from './storyboard.ts';

const FIXTURE = fileURLToPath(new URL('../../test/fixtures/pitch/run/', import.meta.url));

/** What the fixture's page says: four scenes, 270 frames at 30 fps. */
const INFO: PageInfo = {
  fps: 30,
  width: 1920,
  height: 1080,
  frames: 270,
  scenes: [
    { type: 'intro', from: 0, frames: 75, still: 60 },
    { type: 'feature', from: 60, frames: 90, still: 140 },
    { type: 'beforeAfter', from: 135, frames: 75, still: 200 },
    { type: 'outro', from: 195, frames: 75, still: 260 },
  ],
};

/** A browser whose page reports `report` when opened with `report`, and writes an empty PNG per screenshot; what it was asked. */
function reportingBrowser(report: unknown = INFO): { launch: Launch; pages: string[]; seeks: string[] } {
  const pages: string[] = [];
  const seeks: string[] = [];
  const browser: CaptureBrowser = {
    newPage: ({ viewport }) =>
      Promise.resolve({
        goto: async (url: string) => {
          pages.push(`${String(viewport.width)}x${String(viewport.height)} ${url.replace(/^http:\/\/127\.0\.0\.1:\d+/, '')}`);
          if (url.includes('report')) await fetch(new URL('/info', url), { method: 'POST', body: JSON.stringify(report) });
        },
        evaluate: (expression: string) => Promise.resolve(seeks.push(expression)),
        screenshot: ({ path }: { path: string }) => {
          writeFileSync(path, '');
          return Promise.resolve();
        },
      }),
    close: () => Promise.resolve(),
  };
  return { launch: () => Promise.resolve(browser), pages, seeks };
}

function fixtureRun(): string {
  const dir = join(scratch('render'), 'run');
  cpSync(FIXTURE, dir, { recursive: true });
  return dir;
}

const tools = (dir: string, launch: Launch, lines: string[] = []) => {
  const { exec, calls } = fakeExec();
  return { tools: { cwd: dir, exec, fetch: contractNetwork().fetch, launch, warn: (line: string) => lines.push(line) }, calls, lines };
};

describe('renderRun --stills', () => {
  it("takes each scene's still frame, then a contact sheet of them, and records them in pitch.json", async () => {
    const dir = fixtureRun();
    const browser = reportingBrowser();
    const { tools: given, lines } = tools(dir, browser.launch);
    const rendered = await renderRun(dir, { stills: true }, given);
    expect(rendered.files).toEqual(['stills/01-intro.png', 'stills/02-feature.png', 'stills/03-beforeAfter.png', 'stills/04-outro.png', 'stills/contact-sheet.png']);
    for (const file of rendered.files) expect(existsSync(join(dir, file)), file).toBe(true);
    expect(browser.pages[0]).toBe('640x360 /engine/index.html?report=&input=%2Frun%2Finput.json');
    expect(browser.pages).toContain('1920x1080 /engine/index.html?frames=60%2C140%2C200%2C260&input=%2Frun%2Finput.json');
    expect(browser.pages.at(-1)).toMatch(/^1920x720 \/contact\.html\?files=stills%2F01-intro\.png,/);
    expect(rendered.seconds).toBe(9);
    expect(lines).toEqual(["length: the video lasts 9 s, outside the settings' 15 to 40 s"]);
    const pitch = JSON.parse(readFileSync(join(dir, 'pitch.json'), 'utf8')) as Record<string, unknown>;
    expect(pitch).toMatchObject({ prd: 7, stills: rendered.files, music: { provider: 'none', licence: null, credit: null } });
    expect(existsSync(join(dir, 'render'))).toBe(false);
    expect(JSON.parse(readFileSync(join(dir, 'input.json'), 'utf8'))).toMatchObject({ logo: 'assets/logo.svg', credits: [] });
  });
});

const TEAM = 'the Invoicing team';
const MUSIC = '"Advertime" from FreePD.com (public domain), archived at archive.org/details/freepd';

/** `storyboard` (the fixture's by default), its outro naming `team`. */
function withTeam(team: string, storyboard: Storyboard = fixtureStoryboard()): Storyboard {
  return { ...storyboard, scenes: storyboard.scenes.map((scene) => (scene.type === 'outro' ? { ...scene, team } : scene)) };
}

/** The default settings, with credits shown or hidden. */
function creditsShown(shown: boolean): ReturnType<typeof defaultPitchSettings> {
  const settings = defaultPitchSettings();
  return { ...settings, outro: { ...settings.outro, credits: shown } };
}

describe('creditsOf', () => {
  it('lists `Built by <team>` then the music’s credit, when the storyboard names a team and the music owes one', () => {
    expect(creditsOf(withTeam(TEAM), creditsShown(true), MUSIC)).toEqual([`Built by ${TEAM}`, MUSIC]);
  });

  it('lists each only when present: the team with no music, the music with no team, nothing with neither', () => {
    expect(creditsOf(withTeam(TEAM), creditsShown(true), null)).toEqual([`Built by ${TEAM}`]);
    expect(creditsOf(fixtureStoryboard(), creditsShown(true), MUSIC)).toEqual([MUSIC]);
    expect(creditsOf(fixtureStoryboard(), creditsShown(true), null)).toEqual([]);
  });

  it('lists neither when the settings hide credits', () => {
    expect(creditsOf(withTeam(TEAM), creditsShown(false), MUSIC)).toEqual([]);
  });
});

describe('renderRun', () => {
  it("gives the page the outro's team above the music's credit, and neither when the settings hide credits", async () => {
    const dir = fixtureRun();
    const settings = JSON.parse(readFileSync(join(dir, 'settings.json'), 'utf8')) as Record<string, unknown>;
    const storyboard = JSON.parse(readFileSync(join(dir, 'storyboard.json'), 'utf8')) as Storyboard;
    writeFileSync(join(dir, 'storyboard.json'), JSON.stringify(withTeam(TEAM, storyboard)));
    writeFileSync(join(dir, 'settings.json'), JSON.stringify({ ...settings, music: { provider: 'freepd', mood: 'upbeat' } }));
    const shown = await renderRun(dir, { stills: true }, tools(dir, reportingBrowser().launch).tools);
    expect(JSON.parse(readFileSync(join(dir, 'input.json'), 'utf8'))).toMatchObject({ credits: [`Built by ${TEAM}`, shown.music.credit] });
    writeFileSync(join(dir, 'settings.json'), JSON.stringify({ ...settings, outro: { cta: 'Available now', credits: false }, music: { provider: 'freepd', mood: 'upbeat' } }));
    await renderRun(dir, { stills: true }, tools(dir, reportingBrowser().launch).tools);
    expect(JSON.parse(readFileSync(join(dir, 'input.json'), 'utf8'))).toMatchObject({ credits: [] });
  });

  it('captures every frame, encodes the three files with the music on the sync point, and the intro as the two slides', async () => {
    const dir = fixtureRun();
    writeFileSync(join(dir, 'settings.json'), JSON.stringify({ look: { preset: 'keynote', heading: { provider: 'system', family: 'System', weight: 700 }, text: { provider: 'system', family: 'System', weight: 400 } }, music: { provider: 'freepd', mood: 'upbeat' } }));
    const browser = reportingBrowser();
    const { tools: given, calls } = tools(dir, browser.launch);
    const rendered = await renderRun(dir, { stills: false }, given);
    expect(rendered.files).toEqual(['slide.png', 'slide-square.png', 'pitch.mp4', 'pitch-square.mp4', 'pitch.gif']);
    expect(browser.pages).toContain('1920x1080 /engine/index.html?frames=60&input=%2Frun%2Finput.json');
    expect(browser.pages).toContain('1080x1080 /engine/index.html?frames=60&input=%2Frun%2Finput.json');
    expect(browser.pages.filter((page) => page === '1920x1080 /engine/index.html?input=%2Frun%2Finput.json').length).toBeGreaterThan(0);
    expect(browser.seeks.filter((seek) => /__pitchSeek\(269\)/.test(seek))).toHaveLength(1);
    expect(calls.map((call) => call.args.at(-1))).toEqual(['pitch.mp4', 'pitch-square.mp4', 'pitch.gif']);
    // The sync point is scene 1 (from frame 60) at 1 s: 3 s into the video, so the track starts 5 s in.
    expect(calls[0]?.args).toEqual(expect.arrayContaining(['-ss', '5', '-i', join(dir, 'music.mp3')]));
    expect(rendered.music).toMatchObject({ provider: 'freepd', licence: 'CC0 1.0 Universal (public domain)' });
    const pitch = JSON.parse(readFileSync(join(dir, 'pitch.json'), 'utf8')) as Record<string, unknown>;
    expect(pitch).toMatchObject({ files: rendered.files, seconds: 9, music: rendered.music });
    expect(JSON.parse(readFileSync(join(dir, 'input.json'), 'utf8'))).toMatchObject({ credits: [rendered.music.credit] });
    expect(existsSync(join(dir, 'render'))).toBe(false);
  });

  it('refuses a page that cannot draw the storyboard, naming why, and leaves no work folder', async () => {
    const dir = fixtureRun();
    const browser = reportingBrowser({ error: "the page's input is not right" });
    await expect(renderRun(dir, { stills: true }, tools(dir, browser.launch).tools)).rejects.toThrow(RenderRefused);
    await expect(renderRun(dir, { stills: true }, tools(dir, browser.launch).tools)).rejects.toThrow("the page could not draw the storyboard: the page's input is not right");
    expect(existsSync(join(dir, 'render'))).toBe(false);
  });

  it('lets a browser that fails fail the render, and leaves no work folder', async () => {
    const dir = fixtureRun();
    const launch: Launch = () => Promise.reject(new Error('Playwright is needed to capture frames'));
    await expect(renderRun(dir, { stills: false }, tools(dir, launch).tools)).rejects.toThrow('Playwright is needed');
    expect(existsSync(join(dir, 'render'))).toBe(false);
  });
});

describe('syncSecondsOf', () => {
  it("is the sync scene's start plus its at, or null without a sync point or with one past the scenes", () => {
    const storyboard = fixtureStoryboard();
    expect(syncSecondsOf(storyboard, INFO)).toBe(135 / 30 + 1.5);
    expect(syncSecondsOf({ ...storyboard, meta: { ...storyboard.meta, music: { sync: { scene: 9, at: 0 } } } }, INFO)).toBeNull();
    expect(syncSecondsOf({ ...storyboard, meta: { ...storyboard.meta, music: undefined } }, INFO)).toBeNull();
  });
});

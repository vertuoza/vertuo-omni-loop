// The `playwright` capture provider (PRD 1108 s5): every frame settled through the page's seek hook and
// screenshotted, shared between pages side by side, against a faked browser.
import { describe, expect, it } from 'vitest';
import { fakeBrowser, scratch } from '../fakes.ts';
import { frameFile } from '../types.ts';
import { playwrightCapture } from './playwright.ts';

describe('playwrightCapture.frames', () => {
  it('opens the pages at the frame size, seeks each frame before its screenshot, and shares the frames between pages', async () => {
    const dir = scratch('capture');
    const browser = fakeBrowser();
    const frames = await playwrightCapture.frames({ url: 'http://127.0.0.1:4173/', count: 5, width: 1920, height: 1080, pages: 2 }, { dir, cwd: dir, launch: browser.launch });
    expect(frames).toEqual([0, 1, 2, 3, 4].map((n) => `${dir}/${frameFile(n)}`));
    expect(browser.log.filter((line) => line.startsWith('page '))).toEqual(['page 1920x1080', 'page 1920x1080']);
    expect(browser.log.filter((line) => line.startsWith('goto '))).toEqual(['goto http://127.0.0.1:4173/', 'goto http://127.0.0.1:4173/']);
    const seeks = browser.log.filter((line) => line.startsWith('evaluate ')).sort();
    expect(seeks).toEqual([0, 1, 2, 3, 4].map((n) => `evaluate window.__pitchSeek(${String(n)})`));
    expect(browser.log.at(-1)).toBe('close');
  });

  it('opens no more pages than there are frames', async () => {
    const dir = scratch('capture');
    const browser = fakeBrowser();
    await playwrightCapture.frames({ url: 'http://127.0.0.1:4173/', count: 1, width: 640, height: 360 }, { dir, cwd: dir, launch: browser.launch });
    expect(browser.log.filter((line) => line.startsWith('page '))).toEqual(['page 640x360']);
  });

  it('closes the browser when a frame fails', async () => {
    const dir = scratch('capture');
    const browser = fakeBrowser();
    const launch = async () => {
      const opened = await browser.launch();
      return { ...opened, newPage: async (options: { viewport: { width: number; height: number } }) => ({ ...(await opened.newPage(options)), goto: () => Promise.reject(new Error('net::ERR_CONNECTION_REFUSED')) }) };
    };
    await expect(playwrightCapture.frames({ url: 'http://127.0.0.1:4173/', count: 2, width: 640, height: 360 }, { dir, cwd: dir, launch })).rejects.toThrow('ERR_CONNECTION_REFUSED');
    expect(browser.log.at(-1)).toBe('close');
  });
});

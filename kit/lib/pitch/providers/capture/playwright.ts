// The `playwright` capture provider: the engine's page opened in Chromium, each frame settled through
// the page's seek hook and screenshotted as a PNG. The frames are shared between a few pages that run
// side by side. Playwright is the repository's own, as for PRD 859's walk-through: the kit ships none.
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { propertyOf } from '../../../narrow.ts';
import { PAGE_SEEK, frameFile } from '../types.ts';
import type { CaptureBrowser, CapturePage, CaptureProvider, Launch } from '../types.ts';

const PAGES = 4;
const PACKAGES = ['playwright', '@playwright/test'];

const isLauncher = (value: unknown): value is { launch(): Promise<CaptureBrowser> } => typeof propertyOf(value, 'launch') === 'function';

/** Chromium from the Playwright the repository at `cwd` installed. */
function repositoryChromium(cwd: string): Launch {
  return async () => {
    const require = createRequire(join(cwd, 'package.json'));
    for (const name of PACKAGES) {
      let resolved: string;
      try {
        resolved = require.resolve(name);
      } catch {
        continue;
      }
      const chromium = propertyOf(await import(pathToFileURL(resolved).href), 'chromium');
      if (isLauncher(chromium)) return chromium.launch();
    }
    throw new Error('Playwright is needed to capture frames: install playwright in the repository');
  };
}

/** The frame numbers of page `page` of `pages`: every `pages`th frame from `page`. */
const share = (count: number, page: number, pages: number): number[] => Array.from({ length: count }, (_, n) => n).filter((n) => n % pages === page);

async function capture(page: CapturePage, url: string, frames: number[], dir: string): Promise<void> {
  await page.goto(url);
  for (const n of frames) {
    await page.evaluate(`window.${PAGE_SEEK}(${String(n)})`);
    await page.screenshot({ path: join(dir, frameFile(n)) });
  }
}

export const playwrightCapture: CaptureProvider = Object.freeze({
  kind: 'capture',
  id: 'playwright',
  frames: async ({ url, count, width, height, pages = PAGES }, { dir, cwd, launch }) => {
    const browser = await (launch ?? repositoryChromium(cwd))();
    try {
      const lanes = Math.max(1, Math.min(pages, count));
      const opened = await Promise.all(Array.from({ length: lanes }, () => browser.newPage({ viewport: { width, height } })));
      await Promise.all(opened.map((page, lane) => capture(page, url, share(count, lane, lanes), dir)));
    } finally {
      await browser.close();
    }
    return Array.from({ length: count }, (_, n) => join(dir, frameFile(n)));
  },
});

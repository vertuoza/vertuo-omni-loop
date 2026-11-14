// PRD 2850, s1: the version 3 template in a browser — the Pixel perfect tab lays each marked screen
// out at its declared width, scaled to fit its column, opens it at 100 % when its reference is
// pressed, isolates its styles from the page's and the page's from it, and opens with an index of
// every reference. Runs in Playwright's Chromium, where that browser is installed, as the pitch
// engine's page does (`kit/pitch-engine/test/render.test.ts`); elsewhere it is skipped.
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { parsePrd } from '../ids.ts';
import { kitTemplate } from '../playbook/templates.ts';
import { beforeAfterSkeleton } from './skeleton.ts';

const browserHere = ((): boolean => {
  try {
    return existsSync(chromium.executablePath());
  } catch {
    return false;
  }
})();

/** One marked screen, its markup in a `<template>`, as the agent writes it. */
const screen = (name: string, ref: string, when: string, width: number, body: string): string =>
  `<div data-screen="${name}" data-ref="${ref}" data-when="${when}" data-viewport="${String(width)}"><template><div class="root">${body}</div></template></div>`;

/** A filled Pixel perfect section: 1.A today and after (written after first), 1.B after only, 2.A a phone screen. */
const SECTION = [
  '<div data-section="pixel-perfect" data-state="filled">',
  '<h4>Pixel perfect</h4>',
  '<p>screens: quote-list · quote-editor</p>',
  screen('quote-list', '1.A', 'after', 1280, '<p class="probe">Quotes</p><span class="bare">Leuven</span>'),
  screen('quote-list', '1.A', 'today', 1280, '<p class="probe">Quotes</p>'),
  screen('quote-list', '1.B', 'after', 1280, '<p class="probe">The quote was not sent.</p>'),
  screen('quote-editor', '2.A', 'today', 390, '<p class="probe">Edit</p>'),
  screen('quote-editor', '2.A', 'after', 390, '<p class="probe">Edit, saved</p>'),
  '</div>',
].join('\n');

/** The page `omni before-after new` writes, its Pixel perfect section filled, a page rule and a screen rule each aimed at the other side. */
function filledPage(): string {
  const html = beforeAfterSkeleton({ template: kitTemplate('before-after/page.html'), prd: parsePrd(2850), services: ['kit'] });
  return html
    .replace(/<div data-section="pixel-perfect" data-state="gap">[\s\S]*?<\/div>/, () => SECTION)
    .replace('</style>\n</head>', () => 'body { letter-spacing: 9px; } p { color: rgb(255, 0, 0); }\n</style>\n</head>')
    .replace('<section data-tab="functional">', () => '<section data-tab="functional"><p id="outside">Outside</p>')
    .replace('</style></template>', () => '.root { height: 600px; } p { color: rgb(0, 0, 255); }\n</style></template>');
}

const Box = z.object({ left: z.number(), top: z.number(), width: z.number(), bottom: z.number() });

/** The box of the frame of screen `ref` on side `when`, its laid-out width, and the width of the column it fits. */
const FrameSchema = z.object({ box: Box, layout: z.number(), column: z.number(), pressed: z.string().nullable() });
const frame = (ref: string, when: string): string => `(() => {
  const screen = document.querySelector('[data-tab="pixel-perfect"] [data-screen][data-ref="${ref}"][data-when="${when}"]');
  const r = screen.getBoundingClientRect();
  const button = screen.closest('figure').querySelector('figcaption .ref');
  return { box: { left: r.left, top: r.top, width: r.width, bottom: r.bottom }, layout: screen.offsetWidth, column: screen.closest('.fit').clientWidth, pressed: button.getAttribute('aria-pressed') };
})()`;

describe.skipIf(!browserHere)('the version 3 template in a browser (PRD 2850)', () => {
  let browser: Browser | undefined;
  let dir = '';
  let url = '';

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'before-after-v3-'));
    const file = join(dir, 'before-after.html');
    writeFileSync(file, filledPage());
    url = pathToFileURL(file).href;
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser?.close();
    rmSync(dir, { recursive: true, force: true });
  });

  /** The page opened at `hash`, in a window `width` wide. */
  async function open(hash: string, width = 1000): Promise<Page> {
    if (browser === undefined) throw new Error('the browser did not start');
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(`${url}${hash}`);
    return page;
  }

  const checked = (page: Page): Promise<unknown> => page.evaluate("[...document.querySelectorAll('.tab-input')].filter((input) => input.checked).map((input) => input.id)");

  it('opens Functional with no hash, Technical on #technical, Pixel perfect on #pixel-perfect and on a reference', async () => {
    for (const [hash, tab] of [['', 'tab-functional'], ['#technical', 'tab-technical'], ['#pixel-perfect', 'tab-pixel-perfect'], ['#s-2-A', 'tab-pixel-perfect']] as const) {
      const page = await open(hash);
      expect(await checked(page), hash).toEqual([tab]);
      await page.close();
    }
  });

  it('lays a screen declaring 1280 out 1280 pixels wide, scaled to fit its column, and shows it at 100 % when its reference is pressed', async () => {
    const page = await open('#pixel-perfect');
    const fitted = FrameSchema.parse(await page.evaluate(frame('1.A', 'after')));
    expect(fitted.layout).toBe(1280);
    expect(fitted.column).toBeLessThan(1000);
    expect(fitted.box.width).toBeCloseTo(fitted.column, 0);
    expect(fitted.pressed).toBe('false');
    await page.click('[data-tab="pixel-perfect"] figure:has([data-ref="1.A"][data-when="after"]) figcaption .ref');
    const full = FrameSchema.parse(await page.evaluate(frame('1.A', 'after')));
    expect(full.box.width).toBe(1280);
    expect(full.pressed).toBe('true');
    await page.click('[data-tab="pixel-perfect"] figure:has([data-ref="1.A"][data-when="after"]) figcaption .zoom');
    expect(FrameSchema.parse(await page.evaluate(frame('1.A', 'after'))).box.width).toBeCloseTo(fitted.column, 0);
    await page.close();
  });

  it('sets today beside after when the window shows both at half their size, above it otherwise, today first whatever the order written', async () => {
    const wide = await open('#pixel-perfect', 1440);
    const [today, after] = [FrameSchema.parse(await wide.evaluate(frame('1.A', 'today'))), FrameSchema.parse(await wide.evaluate(frame('1.A', 'after')))];
    expect(today.box.top).toBeCloseTo(after.box.top, 0);
    expect(today.box.left).toBeLessThan(after.box.left);
    expect(today.box.width).toBeGreaterThanOrEqual(640);
    await wide.close();
    const narrow = await open('#pixel-perfect', 1000);
    const [above, below] = [FrameSchema.parse(await narrow.evaluate(frame('1.A', 'today'))), FrameSchema.parse(await narrow.evaluate(frame('1.A', 'after')))];
    expect(below.box.top).toBeGreaterThanOrEqual(above.box.bottom);
    await narrow.close();
  });

  it('keeps the page’s rules out of a screen, and a screen’s rules inside it', async () => {
    const page = await open('#pixel-perfect');
    const styles = z
      .object({ probe: z.string(), bare: z.string(), spacing: z.string(), outside: z.string() })
      .parse(
        await page.evaluate(`(() => {
          const root = document.querySelector('[data-ref="1.A"][data-when="after"]').shadowRoot;
          const probe = getComputedStyle(root.querySelector('.probe'));
          return { probe: probe.color, bare: getComputedStyle(root.querySelector('.bare')).color, spacing: probe.letterSpacing, outside: getComputedStyle(document.getElementById('outside')).color };
        })()`),
      );
    expect(styles.probe).toBe('rgb(0, 0, 255)');
    expect(styles.bare).not.toBe('rgb(255, 0, 0)');
    expect(styles.spacing).toBe('normal');
    expect(styles.outside).toBe('rgb(255, 0, 0)');
    await page.close();
  });

  it('opens the tab with an index of every reference once, each linking to its frame, and counts the screens on its label', async () => {
    const page = await open('#pixel-perfect');
    const index = z
      .object({ links: z.array(z.tuple([z.string(), z.string(), z.number()])), count: z.string(), absent: z.string(), caption: z.string() })
      .parse(
        await page.evaluate(`(() => {
          const links = [...document.querySelectorAll('[data-index] a')].map((a) => {
            const target = document.getElementById(a.getAttribute('href').slice(1));
            return [a.textContent, a.getAttribute('href'), target ? target.querySelectorAll('[data-ref="' + a.textContent + '"]').length : 0];
          });
          const after = document.querySelector('[data-ref="1.A"][data-when="after"]').closest('figure').querySelector('figcaption');
          return { links, count: document.querySelector('[data-count]').textContent, absent: document.getElementById('s-1-B').textContent, caption: after.textContent };
        })()`),
      );
    expect(index.links).toEqual([
      ['1.A', '#s-1-A', 2],
      ['1.B', '#s-1-B', 1],
      ['2.A', '#s-2-A', 2],
    ]);
    expect(index.count).toBe(' · 2');
    expect(index.absent).toContain('This state does not exist today.');
    expect(index.caption).toContain('1.A · quote-list · After · 1280');
    await page.close();
  });
});

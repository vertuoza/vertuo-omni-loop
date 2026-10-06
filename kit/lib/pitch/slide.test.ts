// A pitch's cards (PRD 859 s4): each look in each shape draws the kicker, the hook, the benefit and the
// frame at 1920×1080 or 1080×1080, with no text box overflowing. Rendered in Playwright's Chromium on a
// fixture frame, where that browser is installed; the page's own checks run everywhere.
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import type { Browser } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FRAME_FILE, LOOKS, SHAPES, SLIDE_FILES, slideHtml } from './slide.ts';

/** Words at the spec's longest: a 10-word hook, a 25-word benefit. */
const WORDS = {
  kicker: 'NEW IN VERTUOZA CONSTRUCTION',
  hook: 'Answer every waiting question from your phone, between two site visits',
  benefit:
    'Every question Claude asks waits on one page, a tab per terminal, so the people who decide answer it wherever they are and the work goes on without them at a desk.',
  closing: 'Vertuoza · https://vertuoza.example/a-rather-long-home-link-for-the-product',
};

describe('slideHtml', () => {
  it('draws each word, escaped, and the frame on the wedge, the closing line on the close, and nothing on the backdrop', () => {
    const wedge = slideHtml({ look: 'arcade', card: 'wedge', shape: 'wide', words: { ...WORDS, hook: 'Fast <b>&</b> fun' } });
    expect(wedge).toContain('Fast &lt;b&gt;&amp;&lt;/b&gt; fun');
    expect(wedge).toContain(WORDS.kicker);
    expect(wedge).toContain(`src="${FRAME_FILE}"`);
    expect(wedge).not.toContain(WORDS.closing);
    const close = slideHtml({ look: 'keynote', card: 'close', shape: 'square', words: WORDS });
    expect(close).toContain(WORDS.closing.replace('·', '·'));
    expect(close).not.toContain(FRAME_FILE);
    const backdrop = slideHtml({ look: 'arcade', card: 'backdrop', shape: 'square', words: WORDS });
    expect(backdrop).not.toContain(WORDS.kicker);
    expect(backdrop).toContain('width: 1080px; height: 1080px');
  });

  it('refuses a look, a card or a shape it does not know', () => {
    expect(() => slideHtml({ look: 'custom', card: 'wedge', shape: 'wide', words: WORDS })).toThrow(/arcade or keynote/);
    expect(() => slideHtml({ look: 'arcade', card: 'poster', shape: 'wide', words: WORDS })).toThrow(/wedge, close or backdrop/);
    expect(() => slideHtml({ look: 'arcade', card: 'wedge', shape: 'tall', words: WORDS })).toThrow(/wide or square/);
  });

  it('names the five PNGs of a run', () => {
    expect(SLIDE_FILES.map(({ file }) => file)).toEqual(['slide.png', 'slide-square.png', 'close.png', 'close-square.png', 'backdrop-square.png']);
  });
});

const browserHere = (() => {
  try {
    return existsSync(chromium.executablePath());
  } catch {
    return false;
  }
})();

/** What a rendered card shows, as the page reads it. */
type Seen = { size: [number, number]; boxes: { name: string; text: string; fits: boolean }[]; frame: boolean | null };

/**
 * Read in the page (the kit's TypeScript has no DOM): its size, its words, the frame, and whether each
 * box's text fits inside it and inside the page.
 */
const SEEN = `(() => {
  const inside = (rect) => rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth + 0.5 && rect.bottom <= innerHeight + 0.5;
  const boxes = [...document.querySelectorAll('[data-box]')].map((box) => {
    const text = box.firstElementChild;
    const fits = text.scrollWidth <= box.clientWidth && text.offsetHeight <= box.clientHeight && inside(box.getBoundingClientRect());
    return { name: text.className, text: text.textContent, fits };
  });
  const image = document.querySelector('.frame img');
  return {
    size: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
    boxes,
    frame: image ? image.naturalWidth > 0 && inside(image.getBoundingClientRect()) : null,
  };
})()`;

describe.skipIf(!browserHere)('the cards in a browser', () => {
  let browser: Browser | undefined;
  let dir = '';

  beforeAll(async () => {
    const launched = await chromium.launch();
    browser = launched;
    dir = mkdtempSync(join(tmpdir(), 'pitch-slide-'));
    const page = await launched.newPage({ viewport: { width: 1600, height: 900 } });
    await page.setContent('<body style="margin:0;background:linear-gradient(90deg,#246,#8ac)"><h1 style="color:#fff;font:64px sans-serif">A real frame</h1></body>');
    writeFileSync(join(dir, FRAME_FILE), await page.screenshot());
    await page.close();
  });

  afterAll(async () => {
    await browser?.close();
  });

  /** What a rendered card shows: its size, its words, the frame, and every box that overflows. */
  async function render(look: (typeof LOOKS)[number], card: 'wedge' | 'close', shape: keyof typeof SHAPES) {
    const { width, height } = SHAPES[shape];
    const file = join(dir, `${look}-${card}-${shape}.html`);
    writeFileSync(file, slideHtml({ look, card, shape, words: WORDS }));
    if (!browser) throw new Error('no browser');
    const page = await browser.newPage({ viewport: { width, height } });
    // The fonts come from the network; the fit is checked on the fallbacks, offline.
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
    await page.goto(`file://${file}`);
    await page.waitForSelector('body[data-fit="done"]', { timeout: 20_000 });
    const seen = await page.evaluate<Seen>(SEEN);
    await page.close();
    return { width, height, ...seen };
  }

  for (const look of LOOKS) {
    for (const shape of ['wide', 'square'] as const) {
      it(`${look}, ${shape}: the slide draws the kicker, hook, benefit and frame, and nothing overflows`, async () => {
        const seen = await render(look, 'wedge', shape);
        expect(seen.size).toEqual([seen.width, seen.height]);
        expect(seen.boxes.map(({ name, text }) => [name, text])).toEqual([
          ['kicker', WORDS.kicker],
          ['hook', WORDS.hook],
          ['benefit', WORDS.benefit],
        ]);
        expect(seen.boxes.filter(({ fits }) => !fits)).toEqual([]);
        expect(seen.frame).toBe(true);
      });

      it(`${look}, ${shape}: the closing card draws the kicker and the closing line, and nothing overflows`, async () => {
        const seen = await render(look, 'close', shape);
        expect(seen.size).toEqual([seen.width, seen.height]);
        expect(seen.boxes.map(({ name }) => name)).toEqual(['kicker', 'closing']);
        expect(seen.boxes.filter(({ fits }) => !fits)).toEqual([]);
      });
    }
  }
});

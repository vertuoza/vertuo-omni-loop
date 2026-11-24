// What the screenshot test (scripts/visual.ts) waits for once a screen shows what it must, before it
// shoots it: the page's fonts, then every iframe's own page loaded with its fonts, then a beat. Plain
// TypeScript with type imports only: `node scripts/visual.ts` runs it as it is, and
// src/design/visual-settle.test.ts tests it on a fake page.
//
// The PRD page's Specifications tab frames its before/after page on a sandboxed route (#3204). A cold
// dev server compiles that route on its first request, after the page itself is ready: a shot taken
// then showed the frame blank, and the check went red on unchanged code. The Outbox tab's rail frames
// the same page, and a render may replace that iframe while it is waited for: the wait then starts over.

/** A frame as the shot waits on it: Playwright's Frame, narrowed to what is used here. */
export type ShotFrame = {
  url(): string;
  isDetached(): boolean;
  waitForLoadState(state: 'load', options: { timeout: number }): Promise<void>;
  evaluate<R>(fn: () => R | Promise<R>): Promise<R>;
};

/** A page as the shot waits on it: Playwright's Page, narrowed to what is used here. */
export type ShotPage = {
  evaluate<R>(fn: () => R | Promise<R>): Promise<R>;
  locator(selector: 'iframe'): { elementHandles(): Promise<{ contentFrame(): Promise<ShotFrame | null> }[]> };
};

/** How long a shot waits: at most `timeout` ms for the frames, then the beat after everything is ready. */
export type SettleOptions = { beat?: number; timeout?: number };

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Waits until `frame` has left about:blank for its own page. An iframe starts on about:blank, which
 * Playwright already reports as loaded, so its load state alone would let the shot through blank.
 */
async function navigated(frame: ShotFrame, timeout: number): Promise<void> {
  const blank = (): boolean => !frame.isDetached() && (frame.url() === '' || frame.url() === 'about:blank');
  for (let waited = 0; blank(); waited += 25) {
    if (waited >= timeout) throw new Error(`an iframe never left about:blank within ${String(timeout)} ms`);
    await sleep(25);
  }
}

/**
 * The frame of every iframe on `page`. An iframe a render replaced between the query and the read has
 * none: the iframes are asked for again, until each has its frame or `timeout` ms passed.
 */
async function framesOf(page: ShotPage, timeout: number): Promise<ShotFrame[]> {
  for (let waited = 0; ; waited += 25) {
    const frames = await Promise.all((await page.locator('iframe').elementHandles()).map((handle) => handle.contentFrame()));
    const found = frames.filter((frame): frame is ShotFrame => frame !== null);
    if (found.length === frames.length) return found;
    if (waited >= timeout) throw new Error(`an iframe had no frame within ${String(timeout)} ms`);
    await sleep(25);
  }
}

/**
 * Waits until `page` holds still: its fonts are ready; each iframe has navigated to its page, loaded it
 * and readied its fonts, and no iframe came or went meanwhile (else the wait starts over); then a beat
 * for the last paint. A frame that does not load in time fails the shot, rather than letting a blank
 * frame be compared.
 */
export async function settle(page: ShotPage, { beat = 500, timeout = 120_000 }: SettleOptions = {}): Promise<void> {
  await page.evaluate(() => document.fonts.ready.then(() => true));
  const started = Date.now();
  for (;;) {
    const frames = await framesOf(page, timeout);
    const ready = (await Promise.all(frames.map((frame) => loaded(frame, timeout)))).every(Boolean);
    const now = await framesOf(page, timeout);
    if (ready && now.every((frame) => frames.includes(frame))) break;
    if (Date.now() - started >= timeout) throw new Error(`the iframes kept changing for ${String(timeout)} ms`);
  }
  await sleep(beat);
}

/** Waits until `frame` shows its own page, loaded, with its fonts: true, or false when a render removed it meanwhile. */
async function loaded(frame: ShotFrame, timeout: number): Promise<boolean> {
  try {
    await navigated(frame, timeout);
    await frame.waitForLoadState('load', { timeout });
    await frame.evaluate(() => document.fonts.ready.then(() => true));
    return true;
  } catch (error) {
    if (frame.isDetached()) return false;
    throw error;
  }
}

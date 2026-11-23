// What the screenshot test (scripts/visual.ts) waits for once a screen shows what it must, before it
// shoots it: the page's fonts, then a beat. Plain TypeScript with type imports only: `node
// scripts/visual.ts` runs it as it is, and src/design/visual-settle.test.ts tests it on a fake page.

/** A page as the shot waits on it: Playwright's Page, narrowed to what is used here. */
export type ShotPage = {
  evaluate<R>(fn: () => R | Promise<R>): Promise<R>;
};

/** How long a shot waits: the beat after everything is ready. */
export type SettleOptions = { beat: number };

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Waits until `page` holds still: its fonts are ready, then a beat for the last paint. */
export async function settle(page: ShotPage, { beat }: SettleOptions = { beat: 500 }): Promise<void> {
  await page.evaluate(() => document.fonts.ready.then(() => true));
  await sleep(beat);
}

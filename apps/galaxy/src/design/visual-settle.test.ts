import { describe, expect, it } from 'vitest';
import { settle } from '../../scripts/settle';

// The screenshot test's wait (scripts/settle.ts, #3204): the PRD page's Specifications tab holds the
// before/after page in a sandboxed iframe, which a cold dev server compiles on its first request. A shot
// taken before that frame has loaded shows it blank, and the `visual` check went red on unchanged code
// (prd/specifications/omni-1440.png, 23.86% of pixels). The fake page below holds one such frame: it
// starts on about:blank, which Playwright reports as loaded, then navigates to its route and loads.

type Timing = { navigateAt: number; loadAt: number; detachAt?: number };

/** A frame as Playwright shows it: about:blank first, then its route, loaded `loadAt` ms in. */
function fakeFrame(log: string[], { navigateAt, loadAt, detachAt }: Timing) {
  let url = 'about:blank';
  let loaded = false;
  let detached = false;
  let fire = (): void => undefined;
  let fail: (error: Error) => void = () => undefined;
  const load = new Promise<void>((resolve, reject) => { fire = resolve; fail = reject; });
  load.catch(() => undefined);
  setTimeout(() => { url = 'http://localhost:3217/prd/71/sandboxed/before-after/1'; log.push('navigated'); }, navigateAt);
  setTimeout(() => { if (detached) return; loaded = true; log.push('loaded'); fire(); }, loadAt);
  if (detachAt !== undefined) setTimeout(() => { detached = true; log.push('detached'); fail(new Error('frame.waitForLoadState: Frame was detached')); }, detachAt);
  return {
    url: () => url,
    isDetached: () => detached,
    // As Playwright's: the state of the document the frame holds now, and about:blank is loaded.
    waitForLoadState: (): Promise<void> => (detached ? Promise.reject(new Error('Frame was detached')) : url === 'about:blank' || loaded ? Promise.resolve() : load),
    evaluate: <R>(): Promise<R> => {
      if (detached) return Promise.reject(new Error('frame.evaluate: Frame was detached'));
      log.push('frame fonts');
      return Promise.resolve(true as R);
    },
  };
}

/** A page holding `frames`, one iframe each. */
function fakePage(log: string[], frames: ReturnType<typeof fakeFrame>[]) {
  return {
    evaluate: <R>(): Promise<R> => { log.push('page fonts'); return Promise.resolve(true as R); },
    locator: () => ({ elementHandles: () => Promise.resolve(frames.map((frame) => ({ contentFrame: () => Promise.resolve(frame) }))) }),
  };
}

describe('the screenshot test\'s wait before a shot', () => {
  it('waits for the sandboxed before/after frame to load, so the shot never shows it blank', async () => {
    const log: string[] = [];
    await settle(fakePage(log, [fakeFrame(log, { navigateAt: 30, loadAt: 60 })]), { beat: 0 });
    log.push('shot');
    expect(log).toEqual(['page fonts', 'navigated', 'loaded', 'frame fonts', 'shot']);
  });

  it('fails, naming the frame, when a frame never leaves about:blank, rather than shooting it blank', async () => {
    const log: string[] = [];
    const never = fakePage(log, [fakeFrame(log, { navigateAt: 10_000, loadAt: 10_000 })]);
    await expect(settle(never, { beat: 0, timeout: 50 })).rejects.toThrow('an iframe never left about:blank within 50 ms');
    expect(log).toEqual(['page fonts']);
  });

  it('asks again for an iframe a render replaced before its frame could be read', async () => {
    const log: string[] = [];
    const frame = fakeFrame(log, { navigateAt: 10, loadAt: 20 });
    let asked = 0;
    const page = {
      ...fakePage(log, [frame]),
      locator: () => ({ elementHandles: () => Promise.resolve([{ contentFrame: () => Promise.resolve(++asked === 1 ? null : frame) }]) }),
    };
    await settle(page, { beat: 0 });
    log.push('shot');
    expect(log).toEqual(['page fonts', 'navigated', 'loaded', 'frame fonts', 'shot']);
  });

  it('starts over when a render replaces a frame while it is waited for, and waits for the new one', async () => {
    const log: string[] = [];
    const replaced = fakeFrame(log, { navigateAt: 10, loadAt: 1000, detachAt: 30 });
    const fresh = fakeFrame(log, { navigateAt: 60, loadAt: 90 });
    const page = {
      ...fakePage(log, []),
      locator: () => ({ elementHandles: () => Promise.resolve([{ contentFrame: () => Promise.resolve(replaced.isDetached() ? fresh : replaced) }]) }),
    };
    await settle(page, { beat: 0 });
    log.push('shot');
    expect(log).toEqual(['page fonts', 'navigated', 'detached', 'navigated', 'loaded', 'frame fonts', 'shot']);
  });

  it('waits again when a new iframe showed up while the others loaded', async () => {
    const log: string[] = [];
    const first = fakeFrame(log, { navigateAt: 10, loadAt: 20 });
    const late = fakeFrame(log, { navigateAt: 40, loadAt: 70 });
    let asked = 0;
    const page = {
      ...fakePage(log, []),
      locator: () => ({ elementHandles: () => Promise.resolve((++asked === 1 ? [first] : [first, late]).map((frame) => ({ contentFrame: () => Promise.resolve(frame) }))) }),
    };
    await settle(page, { beat: 0 });
    log.push('shot');
    expect(log.filter((step) => step === 'loaded')).toHaveLength(2);
    expect(log.slice(-2)).toEqual(['frame fonts', 'shot']);
  });

  it('fails when an iframe never gets a frame', async () => {
    const page = { ...fakePage([], []), locator: () => ({ elementHandles: () => Promise.resolve([{ contentFrame: () => Promise.resolve(null) }]) }) };
    await expect(settle(page, { beat: 0, timeout: 50 })).rejects.toThrow('an iframe had no frame within 50 ms');
  });

  it('waits for every frame on the page', async () => {
    const log: string[] = [];
    await settle(fakePage(log, [fakeFrame(log, { navigateAt: 10, loadAt: 20 }), fakeFrame(log, { navigateAt: 40, loadAt: 70 })]), { beat: 0 });
    log.push('shot');
    expect(log.at(-1)).toBe('shot');
    expect(log.filter((step) => step === 'loaded')).toHaveLength(2);
    expect(log.filter((step) => step === 'frame fonts')).toHaveLength(2);
    expect(log.lastIndexOf('loaded')).toBeLessThan(log.lastIndexOf('frame fonts'));
  });

  it('shoots a page with no frame once its fonts are ready', async () => {
    const log: string[] = [];
    await settle(fakePage(log, []), { beat: 0 });
    log.push('shot');
    expect(log).toEqual(['page fonts', 'shot']);
  });
});

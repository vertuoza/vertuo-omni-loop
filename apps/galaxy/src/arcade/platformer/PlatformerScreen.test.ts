import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TALL, WIDE } from '../grid';
import { failedPress, NOT_LOADED, ScreenNotice, startPlatformer, worldScenes, type ScreenDeps, type ScreenStatus } from './PlatformerScreen';
import type { SceneOptions } from './scene';
import { sure } from '../sure';

// The one way into Super Omni World (PRD 817), with Phaser replaced by a stub module: nothing here
// loads Phaser. The controller is what the component runs on mount (start), on its props (pause,
// resume, retry) and on unmount (destroy); the React wiring itself is checked in the browser.

class StubGame {
  static made: StubGame[] = [];
  calls: string[] = [];
  readonly config: Record<string, unknown>;
  constructor(config: Record<string, unknown>) {
    this.config = config;
    StubGame.made.push(this);
  }
  pause() { this.calls.push('pause'); }
  resume() { this.calls.push('resume'); }
  destroy(removeCanvas: boolean) { this.calls.push(`destroy:${removeCanvas}`); }
}
const STUB = { Game: StubGame, AUTO: 0, Scale: { NONE: 'none' } };
const SCENE = { key: 'stub scene' };

const host = { nodeName: 'DIV' } as unknown as HTMLElement;
const hero = { v: 1, body: 'boy', skin: 0, hair: 0, suit: 0, cape: 1 } as const;
const opts = (grid = TALL) => ({ grid, hero, team: null, held: () => new Set<never>(), onEvent: () => {} });
const deps = (load: ScreenDeps['load'], onStatus = vi.fn()): ScreenDeps => ({ load, scene: () => SCENE, onStatus });
const settle = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => { StubGame.made = []; vi.restoreAllMocks(); });

describe('startPlatformer', () => {
  it('imports Phaser, then starts one game on the grid it is given, in pixel-art mode, in its own box', async () => {
    const onStatus = vi.fn<(status: ScreenStatus) => void>();
    const p = startPlatformer(host, opts(WIDE), deps(() => Promise.resolve(STUB), onStatus));
    expect(p.status()).toBe('loading');
    await p.ready;
    expect(StubGame.made).toHaveLength(1);
    expect(sure(StubGame.made[0], 'StubGame.made[0]').config).toMatchObject({ parent: host, width: 640, height: 360, pixelArt: true, scene: SCENE });
    expect(p.status()).toBe('ready');
    expect(onStatus.mock.calls.map(([s]) => s)).toEqual(['loading', 'ready']);
  });

  it('lays the game out on the tall grid too, and never lets Phaser read the keyboard or play sound', async () => {
    const p = startPlatformer(host, opts(TALL), deps(() => Promise.resolve(STUB)));
    await p.ready;
    expect(sure(StubGame.made[0], 'StubGame.made[0]').config).toMatchObject({ width: 320, height: 288, audio: { noAudio: true } });
    expect(sure(StubGame.made[0], 'StubGame.made[0]').config.input).toMatchObject({ keyboard: false, mouse: false, touch: false, gamepad: false });
  });

  it('passes pause and resume through to the game', async () => {
    const p = startPlatformer(host, opts(), deps(() => Promise.resolve(STUB)));
    await p.ready;
    p.pause();
    p.resume();
    expect(sure(StubGame.made[0], 'StubGame.made[0]').calls).toEqual(['pause', 'resume']);
  });

  it('starts paused when told to pause before Phaser arrived', async () => {
    const p = startPlatformer(host, opts(), deps(() => Promise.resolve(STUB)));
    p.pause();
    await p.ready;
    expect(sure(StubGame.made[0], 'StubGame.made[0]').calls).toEqual(['pause']);
  });

  it('destroys the game and its canvas on unmount', async () => {
    const p = startPlatformer(host, opts(), deps(() => Promise.resolve(STUB)));
    await p.ready;
    p.destroy();
    expect(sure(StubGame.made[0], 'StubGame.made[0]').calls).toEqual(['destroy:true']);
    p.pause();
    expect(sure(StubGame.made[0], 'StubGame.made[0]').calls).toEqual(['destroy:true']);
  });

  it('starts no game when unmounted before Phaser arrived', async () => {
    let arrive!: (m: typeof STUB) => void;
    const p = startPlatformer(host, opts(), deps(() => new Promise((r) => { arrive = r; })));
    p.destroy();
    arrive(STUB);
    await settle();
    expect(StubGame.made).toEqual([]);
  });

  it('shows the retry line when the import fails, logs why, and retries the import on A', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const load = vi.fn<ScreenDeps['load']>().mockRejectedValueOnce(new Error('chunk missing')).mockResolvedValue(STUB);
    const onStatus = vi.fn<(status: ScreenStatus) => void>();
    const p = startPlatformer(host, opts(), deps(load, onStatus));
    await p.ready;
    expect(p.status()).toBe('failed');
    expect(error).toHaveBeenCalled();
    expect(StubGame.made).toEqual([]);
    expect(failedPress('a')).toBe('retry');
    await p.retry();
    expect(load).toHaveBeenCalledTimes(2);
    expect(p.status()).toBe('ready');
    expect(StubGame.made).toHaveLength(1);
    expect(onStatus.mock.calls.map(([s]) => s)).toEqual(['loading', 'failed', 'loading', 'ready']);
  });

  it('retries nothing once the game is running', async () => {
    const load = vi.fn<ScreenDeps['load']>().mockResolvedValue(STUB);
    const p = startPlatformer(host, opts(), deps(load));
    await p.ready;
    await p.retry();
    expect(load).toHaveBeenCalledTimes(1);
  });
});

describe('the screen while Phaser is away', () => {
  it('says the game did not load and that A retries', () => {
    expect(NOT_LOADED).toBe('GAME DID NOT LOAD · A TO RETRY');
    const html = renderToStaticMarkup(createElement(ScreenNotice, { status: 'failed' }));
    expect(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()).toBe('GAME DID NOT LOAD · A TO RETRY');
  });

  it('says it is loading until Phaser arrives, and nothing once the game runs', () => {
    expect(renderToStaticMarkup(createElement(ScreenNotice, { status: 'loading' }))).toContain('LOADING');
    expect(renderToStaticMarkup(createElement(ScreenNotice, { status: 'ready' }))).toBe('');
  });

  it('reads A as retry and B as back on the failed screen, and nothing else', () => {
    expect(failedPress('a')).toBe('retry');
    expect(failedPress('b')).toBe('back');
    expect(failedPress('start')).toBeNull();
    expect(failedPress('left')).toBeNull();
  });
});

describe('worldScenes', () => {
  it('makes a scene per stage in the order they are played, each in its palette and told the next one', () => {
    const o = { held: () => new Set<never>(), onEvent: () => {} };
    const made = worldScenes((so: SceneOptions) => so, o, (palette) => ({ palette }) as unknown as SceneOptions['art']);
    expect(made.map((s) => [s.stage.id, (s.art as unknown as { palette: string }).palette, s.next])).toEqual([
      ['1-1', 'grass', 'stage-1-2'],
      ['1-2', 'underground', 'stage-1-3'],
      ['1-3', 'castle', null],
    ]);
    expect(made.every((s) => s.held === o.held && s.onEvent === o.onEvent)).toBe(true);
  });
});

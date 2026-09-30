import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { RULEBOOK } from 'vertuo-omni-plan/game/rulebook.mjs';
import type { DockView } from './dock';

// Which of the game's modules a render has evaluated: the dock's page must pull in none of them
// until the dock is opened.
const loaded = vi.hoisted(() => [] as string[]);
vi.mock('./DockGame', () => { loaded.push('DockGame'); return { default: () => null }; });
vi.mock('../arcade/games/invaders', async (original) => { loaded.push('games/invaders'); return original(); });
vi.mock('../arcade/scenes/invaders.ts', async (original) => { loaded.push('scenes/invaders'); return original(); });

const { DockFrame, loadGame, PlayDock } = await import('./PlayDock');

const frame = (view: DockView) =>
  renderToStaticMarkup(createElement(DockFrame, { view, answerHref: '/prd/abc?tab=questions', onOpen: () => {}, onFold: () => {} }, createElement('canvas')));
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

describe('PlayDock on a page', () => {
  it('renders nothing on the server, and imports none of the game\'s code until opened', () => {
    const html = renderToStaticMarkup(createElement(PlayDock, {
      state: 'working', player: { linked: true, xp: { xp: 180, level: 3, unlocked: ['invaders'] } }, answerHref: '/prd/abc',
    }));
    expect(html).toBe('');
    expect(loaded).toEqual([]);
  });

  it('fetches the game\'s code on demand, the first time the dock opens', async () => {
    await loadGame();
    expect(loaded).toContain('DockGame');
  });
});

describe('DockFrame: what the corner draws', () => {
  it('draws nothing when hidden', () => {
    expect(frame({ kind: 'hidden' })).toBe('');
  });

  it('draws the pill, folded: "● ▶ Play while Claude works", and no device', () => {
    const html = frame({ kind: 'folded' });
    expect(text(html)).toBe('● ▶ Play while Claude works');
    expect(html).toMatch(/^<button type="button" class="pd-pill"/);
    expect(html).not.toContain('<canvas');
  });

  it('draws the device around the game while playing, with a way to fold it', () => {
    const html = frame({ kind: 'playing' });
    expect(html).toContain('<canvas');
    expect(html).toContain('aria-label="Fold (Esc)"');
    expect(text(html)).not.toContain('CLAUDE');
  });

  it('points at the question when one is asked, over the paused game', () => {
    const html = frame({ kind: 'asking' });
    expect(html).toContain('<a class="pd-banner pd-ask" href="/prd/abc?tab=questions">⏸ CLAUDE ASKED · ANSWER</a>');
    expect(html).toContain('<canvas');
  });

  it('says Claude is done over a game still on', () => {
    const html = frame({ kind: 'done' });
    expect(text(html)).toContain('CLAUDE IS DONE');
    expect(html).toContain('<canvas');
  });

  it('shows a refused player the arcade\'s own line and a link to /play, never the game', () => {
    const html = frame({ kind: 'refused', line: 'REACH LV 1 TO PLAY' });
    expect(text(html)).toContain('REACH LV 1 TO PLAY');
    expect(html).toContain('href="/play"');
    expect(html).not.toContain('<canvas');
  });
});

describe('the arcade\'s overlay in the dock', () => {
  it('names B as folding the dock, and keeps GAME ROOM for the arcade', async () => {
    const { InvadersOverlay } = await import('../arcade/scenes/invaders.tsx');
    const { ScreenContext } = await import('../arcade/Screen');
    const { TALL } = await import('../arcade/grid');
    const hud = { layout: 'tall' as const, phase: 'paused' as const, score: 40, lives: 3, wave: 1 };
    const hero = { v: 1 as const, body: 'girl' as const, skin: 1, hair: 0, suit: 0, cape: 1 };
    const render = (back?: string) => text(renderToStaticMarkup(createElement(ScreenContext.Provider, { value: { form: 'full', grid: TALL, page: 0, pages: 1 } },
      createElement(InvadersOverlay, { hud, values: RULEBOOK.woundClose, hero, team: null, ...(back ? { back } : {}) }))));
    expect(render('FOLD')).toContain('FOLD');
    expect(render('FOLD')).not.toContain('GAME ROOM');
    expect(render()).toContain('GAME ROOM');
  });
});

describe('SUPER OMNI WORLD in the dock', () => {
  it('pauses at once on a question, and nothing but START resumes it, once the question is gone', async () => {
    const { askPf, newDockPf, pfPaused, pressPf } = await import('./platformer');
    const ready = { ...newDockPf(), status: 'ready' as const };
    // The ready screen (1-1 · PRESS START) stands still until START.
    expect(pfPaused(ready, false)).toBe(true);
    const playing = pressPf(ready, 'start', false).pf;
    expect(pfPaused(playing, false)).toBe(false);
    const asked = askPf(playing);
    expect(asked.session.phase).toBe('paused');
    expect(pfPaused(asked, true)).toBe(true);
    // While the question is open, START and the rest wait.
    for (const a of ['start', 'a', 'left', 'select'] as const) expect(pressPf(asked, a, true)).toEqual({ pf: asked });
    // Answered: still paused, until START.
    expect(pfPaused(asked, false)).toBe(true);
    for (const a of ['a', 'left', 'up'] as const) expect(pfPaused(pressPf(asked, a, false).pf, false)).toBe(true);
    const resumed = pressPf(asked, 'start', false).pf;
    expect(pfPaused(resumed, false)).toBe(false);
  });

  it('goes on to its end when Claude is done: the device stays, and the game is not paused', async () => {
    const { dockView } = await import('./dock');
    const { newDockPf, pfPaused, pressPf } = await import('./platformer');
    const view = dockView({ state: 'idle', door: { play: true, games: ['invaders', 'platformer'] }, open: true, game: true, width: 1280 });
    expect(view).toEqual({ kind: 'done' });
    const playing = pressPf({ ...newDockPf(), status: 'ready' }, 'start', false).pf;
    expect(pfPaused(playing, view.kind === 'asking')).toBe(false);
  });

  it('goes back to the picker on B from the pause, folds on SELECT, and retries a failed import on A', async () => {
    const { askPf, newDockPf, pressPf } = await import('./platformer');
    const paused = askPf(pressPf({ ...newDockPf(), status: 'ready' }, 'start', false).pf);
    expect(pressPf(paused, 'b', false).out).toBe('back');
    expect(pressPf(paused, 'b', true).out).toBe('back');
    expect(pressPf(paused, 'select', false).out).toBe('fold');
    const failed = { ...newDockPf(), status: 'failed' as const };
    expect(pressPf(failed, 'a', false)).toEqual({ pf: { ...failed, retry: 1 } });
    expect(pressPf(failed, 'b', false).out).toBe('back');
  });
});

describe('the picker on the device', () => {
  it('lists both games, the chosen one marked, with A to play and B to fold', async () => {
    const { DockPicker } = await import('./DockPicker');
    const html = renderToStaticMarkup(createElement(DockPicker, { games: ['invaders', 'platformer'], sel: 1, onPick: () => {} }));
    expect(text(html)).toContain('ENTROPY INVADERS');
    expect(text(html)).toContain('SUPER OMNI WORLD');
    expect(html).toMatch(/aria-current="true"[^>]*>[^<]*SUPER OMNI WORLD/);
    expect(text(html)).toMatch(/A\s+PLAY/);
    expect(text(html)).toMatch(/B\s+FOLD/);
  });
});

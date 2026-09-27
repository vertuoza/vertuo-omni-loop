import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { WoundKind } from '@omni/galaxy';
import type { Form } from './form';
import { TALL, WIDE, type Grid } from './grid';
import { Press } from './hint';
import type { Action } from './keys';
import { ScreenContext } from './Screen';
import { hudOf, newGame, press, step, type Game } from './games/invaders';
import { LEAVE, leaveKey, leaveMove, openOver, pauseFirst } from './leave.ts';
import { LeaveOverlay } from './leave.tsx';

// The confirm before the arcade is left for the app (PRD 238): OPEN THE APP?, over whatever scene is
// showing. While it is open, A and START go, B stays, and nothing else is read; a game in play is
// paused before it shows, so B comes back to the pause.

const VALUES: Record<WoundKind, number> = {
  beacon: 31, 'fault-line': 23, 'unconfirmed-ground': 17, 'under-fire': 11, transmission: 7, aftershock: 99,
};
const ACTIONS: Action[] = ['up', 'down', 'left', 'right', 'a', 'b', 'start', 'select'];

/** A game on its ready screen, one in play, one paused, and one over. */
const ready = () => newGame({ layout: 'wide', values: VALUES, seed: 7 });
const playing = () => ({ ...press(ready(), 'a').game, bombIn: 999 });
const paused = () => press(playing(), 'start').game;
const over = (): Game => ({ ...playing(), over: true, overAt: 10, t: 10.5 });

describe('the confirm\'s words', () => {
  it('ask OPEN THE APP?, say what the app holds, and answer YES or NO', () => {
    expect(LEAVE).toEqual({ title: 'OPEN THE APP?', line: 'QUESTIONS AND KNOWLEDGE, AS PAGES', yes: 'YES', no: 'NO' });
  });
});

describe('a press while the confirm is open', () => {
  it('goes on A and START, stays on B, and does nothing on every other action', () => {
    const moves = Object.fromEntries(ACTIONS.map((a) => [a, leaveMove(a)]));
    expect(moves).toEqual({ up: null, down: null, left: null, right: null, a: 'go', b: 'stay', start: 'go', select: null });
  });

  it('takes the keys on every screen, the name screen\'s letters included: A, Z, Space, K and Enter say yes', () => {
    for (const key of ['a', 'A', 'z', 'Z', ' ', 'k', 'K', 'Enter']) expect(leaveKey(key), key).toBe('go');
  });

  it('says no on B, X, Esc, J and Backspace', () => {
    for (const key of ['b', 'B', 'x', 'X', 'Escape', 'j', 'J', 'Backspace']) expect(leaveKey(key), key).toBe('stay');
  });

  it('reads no other key: a letter never types under it, and the arrows and Tab move nothing', () => {
    for (const key of ['m', 'Q', 'e', '7', '-', 'ArrowUp', 'ArrowLeft', 'Tab', 'Shift', 'F1']) expect(leaveKey(key), key).toBeNull();
  });
});

describe('the confirm over Entropy Invaders', () => {
  it('pauses a game in play before it shows, its score and its field as they were', () => {
    const g = step(playing(), new Set(['right']), 1 / 60);
    expect(pauseFirst(g)).toBe(true);
    const under = openOver(g)!;
    expect(hudOf(under).phase).toBe('paused');
    expect({ ...under, paused: false, events: [] }).toEqual({ ...g, events: [] });
  });

  it('pauses the ready screen too, which B comes back to as the pause', () => {
    expect(pauseFirst(ready())).toBe(true);
    expect(hudOf(openOver(ready())!).phase).toBe('paused');
  });

  it('comes back to the pause on B, never to play, and never leaves the game', () => {
    const under = openOver(playing())!;
    expect(leaveMove('b')).toBe('stay');
    // B is the confirm's: the game under it hears nothing, so it is still paused, and START resumes it.
    expect(hudOf(under).phase).toBe('paused');
    expect(step(under, new Set(['right', 'a']), 1).t).toBe(under.t);
    const resumed = press(under, 'start');
    expect(resumed.leave).toBe(false);
    expect(hudOf(resumed.game).phase).toBe('play');
  });

  it('opens as it is over a paused game, or a game over', () => {
    for (const g of [paused(), over()]) {
      expect(pauseFirst(g)).toBe(false);
      expect(openOver(g)).toBe(g);
    }
  });

  it('pauses nothing where no game is running', () => {
    expect(pauseFirst(null)).toBe(false);
    expect(openOver(null)).toBeNull();
  });
});

describe('the confirm on the screen', () => {
  /** The confirm as the server renders it on `grid`, in `form`, with a pad to press its hints with. */
  const html = (grid: Grid, form: Form) => renderToStaticMarkup(
    createElement(ScreenContext.Provider, { value: { form, grid, page: 0, pages: 1 } },
      createElement(Press.Provider, { value: () => {} }, createElement(LeaveOverlay))),
  );
  const text = (markup: string) => markup.replace(/<!-- -->/g, '').replace(/<[^>]+>/g, '\n').split('\n').map((s) => s.trim()).filter(Boolean);

  it.each([
    ['the wide grid, on a computer', WIDE, 'full'],
    ['the wide grid, on the sideways body', WIDE, 'advance'],
    ['the tall grid, on the upright body', TALL, 'handheld'],
  ] as const)('asks OPEN THE APP?, says what the app holds, and offers [A] YES and [B] NO on %s', (_, grid, form) => {
    expect(text(html(grid, form))).toEqual(['OPEN THE APP?', 'QUESTIONS AND KNOWLEDGE, AS PAGES', 'A', 'YES', 'B', 'NO']);
  });

  it('is a dialog named by its question', () => {
    const markup = html(WIDE, 'full');
    const labelled = /^<div class="leave"[^>]*role="dialog"[^>]*aria-labelledby="([^"]+)"/.exec(markup)?.[1];
    expect(labelled).toBeTruthy();
    expect(markup).toContain(`id="${labelled}">OPEN THE APP?</p>`);
  });

  it('makes its hints buttons a tap presses, as every key hint is', () => {
    const buttons = [...html(TALL, 'handheld').matchAll(/<button type="button" class="j-hit">(.*?)<\/button>/g)].map(([, b]) => text(b));
    expect(buttons).toEqual([['A', 'YES'], ['B', 'NO']]);
  });
});

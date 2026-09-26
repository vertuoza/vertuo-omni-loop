// Fullscreen, asked on the first press of each page load and never forced back, so the arcade runs
// like a console game with no tabs or address bar. The first key press, click or touch press of a
// page load asks for it; once the player has left, the next press does not ask again, until F (but
// on the name screen, where F types an F) or a new page load. Browsers keep Esc for leaving
// fullscreen, so the Esc that leaves it is never also B: while fullscreen, B and X are the back
// keys, and outside it Esc still means B. A refused request (no Fullscreen API, as on iPhone
// Safari, or a frame without the permission, as the single-file artifact's) is ignored silently.
import { useCallback, useEffect } from 'react';
import type { SceneName } from './scenes/common.ts';

/**
 * An Esc this soon after fullscreen was left is the one that left it, arriving after the browser
 * said so, and is not B either. A later one is.
 */
export const ESC_AFTER_LEAVING_MS = 500;

/** A press the arcade hears: a key (on the scene it was pressed on), or a click or a touch press. */
export type FullscreenPress =
  | { kind: 'key'; key: string; scene: SceneName; /** Ctrl, Cmd or Alt held: the browser's, not the game's. */ modified: boolean; repeat: boolean }
  | { kind: 'pointer' };

/** What the rule remembers, for one page load. */
export interface FullscreenState {
  /** This page load has asked already: on its first press, or on F. */
  asked: boolean;
  /** When the player last left fullscreen, in ms; null while they never have. */
  leftAt: number | null;
}

/** A new page load: nothing asked yet. */
export const FRESH: FullscreenState = { asked: false, leftAt: null };

/** The page at the moment of the press: whether it may go fullscreen, whether it is, and the time. */
export interface FullscreenNow { allowed: boolean; on: boolean; at: number }

export interface FullscreenVerdict {
  state: FullscreenState;
  /** What to ask the browser, if anything. */
  request: 'enter' | 'exit' | null;
  /** The key is fullscreen's alone, and the game must not also read it: the Esc that leaves, and F. */
  spent: boolean;
}

const isF = (key: string) => key === 'f' || key === 'F';

/** The fullscreen rule: what a press asks of the browser, and whether the game still reads it. */
export function fullscreenPress(state: FullscreenState, press: FullscreenPress, now: FullscreenNow): FullscreenVerdict {
  const pass = (request: FullscreenVerdict['request'] = null, next = state): FullscreenVerdict => ({ state: next, request, spent: false });
  const spend = (request: FullscreenVerdict['request'] = null, next = state): FullscreenVerdict => ({ state: next, request, spent: true });
  if (!now.allowed) return pass();
  if (press.kind === 'key') {
    if (press.modified) return pass(); // Ctrl+R, Cmd+F: the browser's own
    if (press.key === 'Escape') {
      if (now.on) return spend('exit');
      if (state.leftAt !== null && now.at - state.leftAt < ESC_AFTER_LEAVING_MS) return spend();
      return pass(); // B, and no user gesture for a request: it asks nothing
    }
    if (isF(press.key) && press.scene !== 'name') {
      if (press.repeat) return spend(); // a held F toggles once
      return spend(now.on ? 'exit' : 'enter', { ...state, asked: true });
    }
  }
  if (state.asked || now.on) return pass(null, { ...state, asked: true });
  return pass('enter', { ...state, asked: true });
}

/** Fullscreen was entered or left, whoever did it: the player, the browser or the rule. */
export function fullscreenChanged(state: FullscreenState, on: boolean, at: number): FullscreenState {
  return on ? state : { ...state, leftAt: at };
}

/** The part of `document` fullscreen reads and asks: a port, so the rule runs without a browser. */
export interface FullscreenPage {
  fullscreenEnabled?: boolean;
  fullscreenElement?: unknown;
  documentElement: { requestFullscreen?: (options?: FullscreenOptions) => Promise<void> | void };
  exitFullscreen?: () => Promise<void> | void;
}

/** One page load's fullscreen: `press` on every press (true when the key is spent), `changed` on each change. */
export function fullscreenFor(page: FullscreenPage, clock: () => number) {
  let state = FRESH;
  const ask = (request: 'enter' | 'exit') => {
    try {
      const asked = request === 'enter'
        ? page.documentElement.requestFullscreen?.({ navigationUI: 'hide' })
        : page.exitFullscreen?.();
      Promise.resolve(asked).catch(() => { /* refused: ignored silently, with no error and no toast */ });
    } catch { /* refused at once: ignored the same way */ }
  };
  return {
    press(press: FullscreenPress): boolean {
      const allowed = Boolean(page.fullscreenEnabled && page.documentElement.requestFullscreen);
      const verdict = fullscreenPress(state, press, { allowed, on: Boolean(page.fullscreenElement), at: clock() });
      state = verdict.state;
      if (verdict.request) ask(verdict.request);
      return verdict.spent;
    },
    changed() {
      state = fullscreenChanged(state, Boolean(page.fullscreenElement), clock());
    },
  };
}

type Fullscreen = ReturnType<typeof fullscreenFor>;

// One per page load: the module is loaded once per page, so a new page load starts fresh.
let pageFullscreen: Fullscreen | null = null;
const forThisPage = () => (pageFullscreen ??= fullscreenFor(document, () => performance.now()));

/**
 * Fullscreen for the arcade: listens to every click and touch press itself, and returns what the
 * keyboard handler calls first with each key, which says whether the game must leave that key alone.
 */
export function useFullscreen(): (press: FullscreenPress) => boolean {
  useEffect(() => {
    const fs = forThisPage();
    // A browser lets a page go fullscreen on a mouse press on the way down, and on a touch or a pen
    // on the way up (a touch still down may yet be a scroll).
    const onPointer = (e: PointerEvent) => {
      if ((e.type === 'pointerdown') === (e.pointerType === 'mouse')) fs.press({ kind: 'pointer' });
    };
    const onChange = () => fs.changed();
    window.addEventListener('pointerdown', onPointer, true);
    window.addEventListener('pointerup', onPointer, true);
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      window.removeEventListener('pointerdown', onPointer, true);
      window.removeEventListener('pointerup', onPointer, true);
      document.removeEventListener('fullscreenchange', onChange);
    };
  }, []);
  return useCallback((press: FullscreenPress) => forThisPage().press(press), []);
}

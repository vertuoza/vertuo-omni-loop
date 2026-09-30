'use client';
// The keyboard in the play dock (PRD 757), for each screen the device shows (the picker and both
// games, PRD 817): Esc folds it, the pad's keys play, and keys typed into a field of the page stay
// the page's. Tab and Shift (SELECT) stay the page's too: Tab moves focus. Leaving the window or the
// tab counts as lost: the game pauses.
import { useEffect } from 'react';
import type { Held } from '../arcade/held';
import { keyAction, type Action } from '../arcade/keys';
import type { ScreenInfo } from '../arcade/Screen';
import { TALL } from '../arcade/grid';

/** The screen every game of the dock is drawn on: the tall grid, one page. */
export const DOCK_INFO: ScreenInfo = { form: 'full', grid: TALL, page: 0, pages: 1 };

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');

export function useDockKeys(act: (action: Action) => void, held: Held | null, fold: () => void, lost: () => void) {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') { e.preventDefault(); return fold(); }
      const action = keyAction(e.key);
      if (!action || action === 'select') return;
      e.preventDefault();
      held?.keyDown(e.key);
      if (!e.repeat) act(action);
    };
    const up = (e: KeyboardEvent) => held?.keyUp(e.key);
    const hidden = () => { if (document.hidden) lost(); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', lost);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', lost);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [act, held, fold, lost]);
}

'use client';
import { useEffect, type RefObject } from 'react';
import { drawerMove } from './need-human';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled])';

/** The keys of a drawer over the Runners page: Escape closes it, Tab stays inside `panel` (./need-human.ts `drawerMove`). */
export function useDrawerKeys(panel: RefObject<HTMLElement | null>, onClose: () => void): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const root = panel.current;
      if (root === null) return;
      const move = drawerMove(event.key, event.shiftKey, [...root.querySelectorAll<HTMLElement>(FOCUSABLE)], document.activeElement);
      if (move.kind === 'none') return;
      event.preventDefault();
      if (move.kind === 'close') onClose();
      else move.item.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); };
  }, [panel, onClose]);
}

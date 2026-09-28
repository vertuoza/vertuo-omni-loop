'use client';
// The full-screen button (PRD 451): on desktop (`full`), a dim ⛶ in the page's bottom-right corner,
// outside the screen, the one visible way into fullscreen besides F, which its name and tooltip
// give. It sends the fullscreen rule a `toggle` press (fullscreen.ts). It hides while the page is
// fullscreen (Esc or F leave it, and it comes back), and is never drawn on the Game Boy bodies, whose
// first press already asks, nor where the browser refuses fullscreen (a frame without the permission).
import { useSyncExternalStore } from 'react';
import type { Form } from './form';
import type { FullscreenPress } from './fullscreen';

export const FULLSCREEN_NAME = 'Full screen (F)';

export interface FullscreenButtonProps {
  form: Form;
  /** The browser lets this page go fullscreen (`document.fullscreenEnabled`). */
  allowed: boolean;
  /** The page is fullscreen now. */
  on: boolean;
  /** The arcade's fullscreen rule (useFullscreen): the button's press goes through it. */
  fullscreen: (press: FullscreenPress) => boolean;
}

export function FullscreenButton({ form, allowed, on, fullscreen }: FullscreenButtonProps) {
  if (form !== 'full' || !allowed || on) return null;
  return (
    // No focus on a mouse press, as the key hints: Enter and Space keep meaning START and A.
    <button type="button" className="fs-button" aria-label={FULLSCREEN_NAME} title={FULLSCREEN_NAME}
      onMouseDown={(e) => e.preventDefault()} onClick={() => { fullscreen({ kind: 'toggle' }); }}>
      ⛶
    </button>
  );
}

const onChange = (notify: () => void) => {
  document.addEventListener('fullscreenchange', notify);
  return () => document.removeEventListener('fullscreenchange', notify);
};
const never = () => () => {};

/**
 * Whether this page may go fullscreen, and whether it is, following each change. The server cannot
 * know either: it renders neither allowed nor on, so no button until the page starts.
 */
export function useFullscreenState(): { allowed: boolean; on: boolean } {
  const allowed = useSyncExternalStore(never, () => Boolean(document.fullscreenEnabled), () => false);
  const on = useSyncExternalStore(onChange, () => Boolean(document.fullscreenElement), () => false);
  return { allowed, on };
}

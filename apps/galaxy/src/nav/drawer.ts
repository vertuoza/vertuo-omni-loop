// The phone drawer's pure state (PRD 438). Below DRAWER_BELOW px the sidebar hides and the top bar's
// ☰ opens it as a drawer over the page, the focus moved inside it. Escape, a tap on the scrim or
// choosing an item closes it and gives the focus back to ☰. While it is open, Tab wraps inside it.

/** The width, in px, below which the sidebar is a drawer. The stylesheets switch at the same width. */
export const DRAWER_BELOW = 900;

/** Where the focus goes once the drawer has changed: into it, back to ☰, or nowhere. */
export type DrawerFocus = 'drawer' | 'menu-button' | 'none';

export interface DrawerState {
  open: boolean;
  focus: DrawerFocus;
}

/** ☰ pressed; Escape; a tap on the scrim; an item chosen. */
export type DrawerEvent = 'toggle' | 'escape' | 'scrim' | 'choose';

export const CLOSED: DrawerState = { open: false, focus: 'none' };

export function drawer(state: DrawerState, event: DrawerEvent): DrawerState {
  if (!state.open) return event === 'toggle' ? { open: true, focus: 'drawer' } : state;
  return { open: false, focus: 'menu-button' };
}

/** What a key inside the open drawer does: close it, move the focus, or nothing (the browser's own). */
export type DrawerMove = { kind: 'close' } | { kind: 'focus'; index: number } | { kind: 'none' };

/** `index` is the focused item among the drawer's `count` focusable ones, -1 when none of them is. */
export function drawerKey(key: string, shift: boolean, index: number, count: number): DrawerMove {
  if (key === 'Escape') return { kind: 'close' };
  if (key !== 'Tab' || count === 0) return { kind: 'none' };
  if (index < 0) return { kind: 'focus', index: shift ? count - 1 : 0 };
  if (!shift && index === count - 1) return { kind: 'focus', index: 0 };
  if (shift && index === 0) return { kind: 'focus', index: count - 1 };
  return { kind: 'none' };
}

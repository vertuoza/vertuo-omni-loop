'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { CLOSED, drawer, drawerKey, type DrawerEvent } from './drawer';

// The phone drawer, shared by the top bar's ☰ and the sidebar it opens (PRD 438). It holds the state
// of src/nav/drawer.ts and carries out its focus moves: into the drawer when it opens, back to ☰
// when it closes. While it is open, Escape closes it and Tab wraps inside it. Outside the shell (a
// render test of one part alone) the drawer is closed and every event does nothing.

export interface Drawer {
  open: boolean;
  send: (event: DrawerEvent) => void;
  /** ☰. */
  button: RefObject<HTMLButtonElement | null>;
  /** The sidebar, which is the drawer. */
  panel: RefObject<HTMLElement | null>;
}

const NOWHERE: Drawer = { open: false, send: () => {}, button: { current: null }, panel: { current: null } };

const DrawerContext = createContext<Drawer>(NOWHERE);

export const useDrawer = () => useContext(DrawerContext);

const focusable = (panel: HTMLElement | null) => [...(panel?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? [])];

export function DrawerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(CLOSED);
  const button = useRef<HTMLButtonElement | null>(null);
  const panel = useRef<HTMLElement | null>(null);
  const send = useCallback((event: DrawerEvent) => setState((now) => drawer(now, event)), []);

  useEffect(() => {
    if (state.focus === 'drawer') focusable(panel.current)[0]?.focus();
    if (state.focus === 'menu-button') button.current?.focus();
  }, [state]);

  useEffect(() => {
    if (!state.open) return;
    const onKey = (event: KeyboardEvent) => {
      const items = focusable(panel.current);
      const move = drawerKey(event.key, event.shiftKey, items.indexOf(document.activeElement as HTMLElement), items.length);
      if (move.kind === 'none') return;
      event.preventDefault();
      if (move.kind === 'close') send('escape');
      else items[move.index]?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [state.open, send]);

  const value = useMemo(() => ({ open: state.open, send, button, panel }), [state.open, send]);
  return <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>;
}

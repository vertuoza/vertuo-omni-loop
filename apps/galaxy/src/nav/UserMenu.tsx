'use client';
import { positionOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '../../../../supabase/database.types.ts';
import { buttonKey, initialOf, menuKey, profileHref, publicSupabase, signInFromBar, signOutAndLeave } from './user-menu';
import type { ViewerView } from './viewer-view';
import './user-menu.css';

// You, at the end of the app's top bar (PRD 438). Signed in: your hero when you have one (PRD 652),
// else the avatar, else your initial, on a button that opens the
// user menu, which follows the WAI-ARIA menu-button pattern: the arrow keys move between items,
// Escape closes it and gives the focus back to the avatar, Tab closes it and moves on, a click
// outside closes it. It holds the name and login, a heading nobody chooses, then My profile (PRD 698)
// when the viewer has a GitHub login, then Sign out. Signed
// out: Sign in with GitHub in its place.

export function UserMenu({ viewer }: { viewer: ViewerView }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const menuId = `${id}-menu`;
  const who = viewer.name ?? viewer.login ?? 'you';
  const profile = profileHref(viewer.login);

  const items = () => [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
  const focusItem = (index: number) => items()[index]?.focus();
  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  };
  const openAt = (index: number) => {
    setOpen(true);
    // The menu shows on the next paint; its item takes the focus then.
    requestAnimationFrame(() => focusItem(index));
  };

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false); // ts-allow: a pointer event's target is a DOM node
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  const onButtonKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const move = buttonKey(event.key, items().length);
    if (move.kind !== 'open') return;
    event.preventDefault();
    openAt(move.index);
  };

  const onMenuKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const list = items();
    const move = menuKey(event.key, Math.max(0, positionOf(list, document.activeElement)), list.length);
    if (move.kind === 'none') return;
    if (move.kind === 'focus') {
      event.preventDefault();
      focusItem(move.index);
      return;
    }
    if (move.refocus) event.preventDefault();
    close(move.refocus);
  };

  async function signOut() {
    setBusy(true);
    const supabase = publicSupabase();
    await signOutAndLeave(supabase && createBrowserClient<Database>(supabase.url, supabase.key), (to) => window.location.assign(to));
  }

  return (
    <div className="user-menu" ref={root}>
      <button
        ref={button}
        type="button"
        className="user-menu-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Your account, ${who}`}
        onClick={() => (open ? close(false) : openAt(0))}
        onKeyDown={onButtonKey}
      >
        {viewer.heroSvg
          ? <span className="user-menu-hero" aria-hidden="true" dangerouslySetInnerHTML={{ __html: viewer.heroSvg }} />
          : viewer.avatarUrl
          ? <img className="user-menu-avatar" src={viewer.avatarUrl} alt="" width={28} height={28} />
          : <span className="user-menu-initial" aria-hidden="true">{initialOf(viewer)}</span>}
      </button>
      <div ref={menu} id={menuId} className="user-menu-list" role="menu" aria-label="Your account" hidden={!open} onKeyDown={onMenuKey}>
        <div className="user-menu-who" role="presentation">
          <p className="user-menu-name">{who}</p>
          {viewer.login && <p className="user-menu-login">@{viewer.login}</p>}
        </div>
        {profile && (
          <a href={profile} role="menuitem" tabIndex={-1} className="user-menu-item" onClick={() => setOpen(false)}>
            My profile
          </a>
        )}
        <button type="button" role="menuitem" tabIndex={-1} className="user-menu-item" onClick={signOut} disabled={busy}>
          {busy ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </div>
  );
}

/** Signed out: the GitHub sign-in /app's card starts, back through /app/callback to /app. */
export function SignInButton() {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function signIn() {
    setBusy(true);
    setProblem(null);
    const failed = await signInFromBar(publicSupabase(), window.location.origin);
    if (failed) {
      setProblem(failed);
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="ask-button app-bar-sign-in" onClick={signIn} disabled={busy}>
        {busy ? 'Opening GitHub…' : 'Sign in with GitHub'}
      </button>
      {problem && <span className="app-bar-problem" role="alert">{problem}</span>}
    </>
  );
}

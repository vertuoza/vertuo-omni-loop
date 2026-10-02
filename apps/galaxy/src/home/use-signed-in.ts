'use client';
// Who is signed in on HOME (PRD 1006), read once the page is in the browser: the server never draws
// the pill. Settles the page's pending mark (session-mark.ts) and keeps the hero once it is drawn:
// the photo never replaces the hero.
import { useEffect, useState } from 'react';
import { SESSION_ATTR, settleSession } from './session-mark';
import { browserSessionPort, readSignedIn } from './session-read';
import type { SignedInView } from './signed-in';

const isHero = (view: SignedInView | null): boolean => view?.face.kind === 'hero';

export function useSignedIn(env: { url: string; key: string } | null): SignedInView | null {
  const [signedIn, setSignedIn] = useState<SignedInView | null>(null);
  useEffect(() => {
    const page = document.querySelector('main.home');
    let live = true;
    const hero = (view: SignedInView | null) => { if (live && isHero(view)) setSignedIn(view); };
    const cancel = settleSession({
      read: () => readSignedIn(env && browserSessionPort(env), hero),
      mark: (state) => { if (state) page?.setAttribute(SESSION_ATTR, state); else page?.removeAttribute(SESSION_ATTR); },
      draw: (view) => { setSignedIn((now) => (isHero(now) ? now : view)); },
    });
    return () => { live = false; cancel(); };
  }, [env]);
  return signedIn;
}

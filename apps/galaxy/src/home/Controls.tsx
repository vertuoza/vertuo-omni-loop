'use client';
// One of HOME's two client components (PRD 261): every interaction on the page. The other,
// PosterPlanet, only turns the poster's planet (PRD 394); nothing else ships JavaScript. It listens on the whole page for Enter and the Konami code, makes a click on any
// PRESS START (an element carrying `data-press-start`) start the game, flips a trading card on a
// click (spreads/flip.ts), flashes CHEAT ACTIVATED!, and makes a click on SIGN UP WITH GITHUB (an
// element carrying `data-sign-up`) start the GitHub sign-in (sign-up.ts, PRD 359).
// SELECT YOUR APP (PRD 932): that click first opens the character select (selector/Selector.tsx),
// drawn here in the browser only, and its pick starts the sign-in, saved first when REMEMBER MY
// CHOICE is on. While it is open it owns the keyboard: Enter picks, and never starts the game.
// Without JavaScript, PRESS START is still a plain link to /play.
import { useEffect, useRef, useState } from 'react';
import { play } from '../arcade/sound';
import { startGithubSignIn } from '../data/sign-in-github';
import { konami } from './konami';
import { saveChoice } from './selector/choice';
import { Selector } from './selector/Selector';
import { SIGN_UP_ATTR, signUp, type AppPick } from './sign-up';
import { flipCard } from './spreads/flip';
import { PRESS_START_ATTR, pressStart, startsOnKey } from './start';

/** How long CHEAT ACTIVATED! shows before the sound and the game. */
export const CHEAT_MS = 900;

/** What answers Enter by itself when focused: Enter there is never PRESS START's. */
const CONTROL = 'a[href], button, input, textarea, select, summary, [contenteditable], [role="button"]';

/** The galaxy's Supabase, inlined into the browser bundle when the page is built; null on the demo. */
function supabase(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}

function storage(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

export function Controls() {
  const [cheat, setCheat] = useState(false);
  const [signUpError, setSignUpError] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const started = useRef(false);
  const signingUp = useRef(false);
  /** The SIGN UP WITH GITHUB button that opened the overlay: it takes the focus back on close. */
  const opener = useRef<Element | null>(null);
  const open = useRef(false);

  const closeSelector = () => {
    open.current = false;
    setSelecting(false);
    if (opener.current instanceof HTMLElement) opener.current.focus();
  };

  const go = (pick: AppPick, save: boolean) => {
    const button = opener.current;
    if (signingUp.current || !button) return;
    if (save) saveChoice(storage(), pick);
    signingUp.current = true;
    button.setAttribute('aria-busy', 'true');
    setSignUpError(null);
    void signUp({
      supabase: supabase(),
      origin: window.location.origin,
      start: startGithubSignIn,
      go: (href) => window.location.assign(href),
    }, pick).then((failure) => {
      if (!failure) return;
      signingUp.current = false;
      button.removeAttribute('aria-busy');
      closeSelector();
      setSignUpError(failure);
    });
  };

  useEffect(() => {
    const start = (holdMs = 0) => {
      if (started.current) return;
      started.current = true;
      void pressStart({
        storage: storage(),
        playStart: () => play('start', false),
        wait: (ms) => new Promise((done) => setTimeout(done, ms)),
        go: (href) => window.location.assign(href),
      }, { holdMs });
    };
    const code = konami();

    const onKey = (e: KeyboardEvent) => {
      if (open.current) return;
      if (code(e.key)) {
        setCheat(true);
        start(CHEAT_MS);
        return;
      }
      const target = e.target instanceof Element ? e.target : null;
      const { key, repeat, altKey, ctrlKey, metaKey, shiftKey } = e;
      if (startsOnKey({ key, repeat, altKey, ctrlKey, metaKey, shiftKey, inControl: Boolean(target?.closest(CONTROL)) })) {
        e.preventDefault();
        start();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const target = e.target instanceof Element ? e.target : null;
      if (flipCard(target)) return;
      const button = target?.closest(`[${SIGN_UP_ATTR}]`);
      if (button) {
        e.preventDefault();
        if (signingUp.current || open.current) return;
        opener.current = button;
        open.current = true;
        setSignUpError(null);
        setSelecting(true);
        return;
      }
      if (open.current) return;
      if (!target?.closest(`[${PRESS_START_ATTR}]`)) return;
      e.preventDefault();
      start();
    };

    window.addEventListener('keydown', onKey);
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onClick);
    };
  }, []);

  return (
    <>
      <div className="home-cheat" role="status" aria-live="assertive" hidden={!cheat}>
        {cheat ? 'CHEAT ACTIVATED!' : null}
      </div>
      {selecting ? <Selector onGo={go} onClose={closeSelector} /> : null}
      {signUpError ? <p className="home-signup-error" role="alert">{signUpError}</p> : null}
    </>
  );
}

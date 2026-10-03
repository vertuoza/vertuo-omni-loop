'use client';
// One of HOME's two client components (PRD 261): every interaction on the page. The other,
// PosterPlanet, only turns the poster's planet (PRD 394); nothing else ships JavaScript. It listens on the whole page for Enter and the Konami code, makes a click on any
// PRESS START (an element carrying `data-press-start`) start the game, flips a trading card on a
// click (spreads/flip.ts), flashes CHEAT ACTIVATED!, and makes a click on SIGN UP WITH GITHUB (an
// element carrying `data-sign-up`) start the GitHub sign-in (sign-up.ts, PRD 359).
// SELECT YOUR APP (PRD 932): that click first opens the character select (selector/Selector.tsx),
// drawn here in the browser only, and its pick starts the sign-in, saved first when REMEMBER MY
// CHOICE is on. While it is open it owns the keyboard: Enter picks, and never starts the game.
// A remembered pick skips the overlay: the click goes straight to GitHub with it, and the line under
// each button, drawn here in its wrapper, says where it opens; its **change** forgets the pick and
// opens the overlay (selector/choice.ts).
// PRESS START (#955) opens the same overlay, by a click or by Enter, and a remembered pick skips it:
// the Arcade starts the game, the Omni app opens /app (start.ts). The Konami code is the game's cheat,
// and starts the game whatever was picked.
// Without JavaScript, PRESS START is still a plain link to /play.
// Signed in (PRD 1006): once the page is there, it reads the visitor's session (session-read.ts) and,
// when there is one, draws the signed-in pill (SignedIn.tsx) into every sign-up slot, where it takes
// the place of SIGN UP WITH GITHUB. No session, a failed read or the demo leaves the page as it is.
// It also settles the pending mark the page set before it painted (session-mark.ts): `in` on a session,
// removed on none, a failed read, the demo or 3 seconds without an answer; a later session still draws.
// The photo or initial is drawn first; a player's hero replaces it once it is read (s3).
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { play } from '../arcade/sound';
import { startGithubSignIn } from '../data/sign-in-github';
import { clientEnv } from '../env.client';
import { konami } from './konami';
import { answerSignUp, CHANGE_ATTR, changeChoice, HINT_SLOT_ATTR, hintLine, readChoice, saveChoice, type SignUpClickPorts } from './selector/choice';
import { Selector } from './selector/Selector';
import { SignedIn } from './SignedIn';
import type { SignedInView } from './signed-in';
import { SIGN_UP_ATTR, signUp, type AppPick } from './sign-up';
import { flipCard } from './spreads/flip';
import { PRESS_START_ATTR, pressStart, startsOnKey, type StartPorts } from './start';
import { useSignedIn } from './use-signed-in';

/** How long CHEAT ACTIVATED! shows before the sound and the game. */
export const CHEAT_MS = 900;

/** What answers Enter by itself when focused: Enter there is never PRESS START's. */
const CONTROL = 'a[href], button, input, textarea, select, summary, [contenteditable], [role="button"]';

/** The galaxy's Supabase, inlined into the browser bundle when the page is built; null on the demo. */
function supabase(): { url: string; key: string } | null {
  return clientEnv().supabase;
}

/** The same Supabase for the page's life, so the signed-in read runs once. */
const SUPABASE = supabase();

/** A plain left click: one with a modifier, or one something already answered, is the browser's. */
function plainClick(e: MouseEvent): boolean {
  return !e.defaultPrevented && e.button === 0 && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey;
}

/** The SIGN UP WITH GITHUB button a **change** sits under: it takes the focus back on close. */
function signUpButtonOf(change: Element): Element | null {
  return change.closest(`[${HINT_SLOT_ATTR}]`)?.querySelector(`[${SIGN_UP_ATTR}]`) ?? null;
}

function storage(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

/** What a click on each of HOME's controls does, given the element clicked. */
interface ClickAnswers {
  change: (change: Element) => void;
  signUp: (button: Element) => void;
  pressStart: (pressed: Element) => void;
}

/** What a click on the page answers, or null when it is not HOME's to answer. */
function clickAnswer(target: Element | null, answers: ClickAnswers): (() => void) | null {
  const change = target?.closest(`[${CHANGE_ATTR}]`);
  if (change) return () => { answers.change(change); };
  const button = target?.closest(`[${SIGN_UP_ATTR}]`);
  if (button) return () => { answers.signUp(button); };
  const pressed = target?.closest(`[${PRESS_START_ATTR}]`);
  return pressed ? () => { answers.pressStart(pressed); } : null;
}

/** The element an event happened on, or null when it was not one. */
const elementOf = (target: EventTarget | null): Element | null => (target instanceof Element ? target : null);

/** Whether a key pressed on the page presses START: not while typing in a control. */
function pressesStart(e: KeyboardEvent): boolean {
  const { key, repeat, altKey, ctrlKey, metaKey, shiftKey } = e;
  return startsOnKey({ key, repeat, altKey, ctrlKey, metaKey, shiftKey, inControl: Boolean(elementOf(e.target)?.closest(CONTROL)) });
}

/** What HOME's page listeners read and write: its refs, kept across renders, its answers and the cheat's switch. */
interface PageRefs {
  open: { readonly current: boolean };
  opener: { current: Element | null };
  answers: ClickAnswers;
  start: (options?: { holdMs?: number; pick?: AppPick }) => void;
  cheat: () => void;
}

/** A key on the page, while the overlay is closed: the cheat code starts the arcade, START's keys press START. */
function onPageKey(e: KeyboardEvent, code: (key: string) => boolean, page: PageRefs): void {
  if (page.open.current) return;
  if (code(e.key)) {
    page.cheat();
    page.start({ holdMs: CHEAT_MS, pick: 'arcade' });
    return;
  }
  if (!pressesStart(e)) return;
  e.preventDefault();
  page.opener.current = document.querySelector(`[${PRESS_START_ATTR}]`);
  page.start();
}

/** A plain click on the page: a fleet card flips, and HOME's controls answer. */
function onPageClick(e: MouseEvent, page: PageRefs): void {
  if (!plainClick(e)) return;
  const target = elementOf(e.target);
  if (flipCard(target)) return;
  const answer = clickAnswer(target, page.answers);
  if (!answer) return;
  e.preventDefault();
  answer();
}

/**
 * HOME's keyboard and click listeners, added once on mount and removed on unmount. They read `page`
 * through a ref refreshed on each render: its answers only ever touch refs and state setters, so the
 * first render's and the latest act alike, and the listeners never need adding again.
 */
function usePageListeners(page: PageRefs) {
  const latest = useRef(page);
  latest.current = page;
  useEffect(() => {
    const code = konami();
    const onKey = (e: KeyboardEvent) => { onPageKey(e, code, latest.current); };
    const onClick = (e: MouseEvent) => { onPageClick(e, latest.current); };
    window.addEventListener('keydown', onKey);
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onClick);
    };
  }, []);
}

/** PRESS START in the browser: the arcade's start sound, a real wait, a real page change. */
function startPorts(open: () => void): StartPorts {
  return {
    storage: storage(),
    playStart: () => { play('start', false); },
    wait: (ms) => new Promise((done) => setTimeout(done, ms)),
    go: (href) => { window.location.assign(href); },
    open,
  };
}

/**
 * What each sign-up slot shows besides its button: the signed-in pill when someone is signed in,
 * otherwise the line saying where a remembered pick opens, with its **change**.
 */
function SlotLines({ slots, signedIn, hint }: { slots: Element[]; signedIn: SignedInView | null; hint: ReturnType<typeof hintLine> }) {
  if (signedIn) return <>{slots.map((slot, i) => createPortal(<SignedIn view={signedIn} />, slot, `signed-in-${i}`))}</>;
  if (!hint) return null;
  return (
    <>
      {slots.map((slot, i) => createPortal(
        <span className="home-signup-hint">
          {hint.opens} · <button type="button" className="home-signup-change" {...{ [CHANGE_ATTR]: '' }}>{hint.change}</button>
        </span>,
        slot,
        `hint-${i}`,
      ))}
    </>
  );
}

export function Controls() {
  const [cheat, setCheat] = useState(false);
  const [signUpError, setSignUpError] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  /** The remembered pick, read once the page is in the browser: the server never draws its line. */
  const [saved, setSaved] = useState<AppPick | null>(null);
  /** The wrappers of the SIGN UP WITH GITHUB buttons, where the hint line is drawn. */
  const [slots, setSlots] = useState<Element[]>([]);
  /** Who is signed in, read once the page is in the browser: the server never draws the pill. */
  const signedIn = useSignedIn(SUPABASE);
  const started = useRef(false);
  const signingUp = useRef(false);
  /**
   * The SIGN UP WITH GITHUB button or the PRESS START that opened the overlay: it takes the focus back
   * on close, and says what the pick does, sign up or press START.
   */
  const opener = useRef<Element | null>(null);
  const open = useRef(false);

  const closeSelector = () => {
    open.current = false;
    setSelecting(false);
    if (opener.current instanceof HTMLElement) opener.current.focus();
  };

  const openSelector = () => {
    open.current = true;
    setSignUpError(null);
    setSelecting(true);
  };

  const start = (options: { holdMs?: number; pick?: AppPick } = {}) => {
    if (started.current) return;
    started.current = true;
    void pressStart(startPorts(() => {
      started.current = false;
      openSelector();
    }), options);
  };

  const go = (pick: AppPick, save: boolean) => {
    if (save) {
      saveChoice(storage(), pick);
      setSaved(readChoice(storage()));
    }
    if (opener.current?.matches(`[${PRESS_START_ATTR}]`)) {
      start({ pick });
      return;
    }
    const button = opener.current;
    if (signingUp.current || !button) return;
    signingUp.current = true;
    button.setAttribute('aria-busy', 'true');
    setSignUpError(null);
    void signUp({
      supabase: supabase(),
      origin: window.location.origin,
      start: startGithubSignIn,
      go: (href) => { window.location.assign(href); },
    }, pick).then((failure) => {
      if (!failure) return;
      signingUp.current = false;
      button.removeAttribute('aria-busy');
      closeSelector();
      setSignUpError(failure);
    });
  };

  /**
   * A sign-up control clicked (the button, or **change** under it): ignored while a sign-up is under
   * way or the overlay is open. Says whether it answered.
   */
  const signUpClicked = (button: Element | null, answer: (ports: SignUpClickPorts) => void): boolean => {
    if (signingUp.current || open.current) return false;
    opener.current = button;
    answer({ storage: storage(), open: openSelector, go: (pick) => { go(pick, false); } });
    return true;
  };

  const answers: ClickAnswers = {
    change: (change) => { if (signUpClicked(signUpButtonOf(change), changeChoice)) setSaved(null); },
    signUp: (button) => { signUpClicked(button, answerSignUp); },
    pressStart: (pressed) => {
      if (open.current) return;
      opener.current = pressed;
      start();
    },
  };

  useEffect(() => {
    setSaved(readChoice(storage()));
    setSlots([...document.querySelectorAll(`[${HINT_SLOT_ATTR}]`)]);
  }, []);

  usePageListeners({ open, opener, answers, start, cheat: () => { setCheat(true); } });

  const hint = hintLine(saved);

  return (
    <>
      <div className="home-cheat" role="status" aria-live="assertive" hidden={!cheat}>
        {cheat ? 'CHEAT ACTIVATED!' : null}
      </div>
      {selecting ? <Selector onGo={go} onClose={closeSelector} /> : null}
      {signUpError ? <p className="home-signup-error" role="alert">{signUpError}</p> : null}
      <SlotLines slots={slots} signedIn={signedIn} hint={hint} />
    </>
  );
}

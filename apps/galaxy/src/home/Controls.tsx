'use client';
// HOME's one client component (PRD 261): every interaction on the page, and nothing else ships
// JavaScript. It listens on the whole page for Enter and the Konami code, makes a click on any
// PRESS START (an element carrying `data-press-start`) start the game, flips a trading card on a
// click (spreads/flip.ts), and flashes CHEAT ACTIVATED!
// Without JavaScript, PRESS START is still a plain link to /play.
import { useEffect, useRef, useState } from 'react';
import { play } from '../arcade/sound';
import { konami } from './konami';
import { flipCard } from './spreads/flip';
import { PRESS_START_ATTR, pressStart, startsOnKey } from './start';

/** How long CHEAT ACTIVATED! shows before the sound and the game. */
export const CHEAT_MS = 900;

/** What answers Enter by itself when focused: Enter there is never PRESS START's. */
const CONTROL = 'a[href], button, input, textarea, select, summary, [contenteditable], [role="button"]';

function storage(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

export function Controls() {
  const [cheat, setCheat] = useState(false);
  const started = useRef(false);

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
    <div className="home-cheat" role="status" aria-live="assertive" hidden={!cheat}>
      {cheat ? 'CHEAT ACTIVATED!' : null}
    </div>
  );
}

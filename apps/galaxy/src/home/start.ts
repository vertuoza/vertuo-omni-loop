// PRESS START on HOME (PRD 261): the arcade's `start` sound, unless the player muted the game, then
// the game at /play. The browser is reached through small ports, so the order is tested on its own.
// SELECT YOUR APP (PRD 932, #955): PRESS START first opens the character select, as SIGN UP WITH
// GITHUB does, and a remembered pick skips it (selector/choice.ts). The Arcade is the game as before;
// the Omni app opens /app, without the jingle.
import { readChoice } from './selector/choice';
import type { AppPick } from './sign-up';

/** Where PRESS START goes: the arcade. */
export const PLAY_HREF = '/play';

/** Where the Omni app's pick goes: its own address. */
export const APP_HREF = '/app';

/** The arcade's own mute, kept per viewer (ArcadeApp.tsx writes it). */
export const MUTED_KEY = 'omni-loop:muted';

/** Marks an element PRESS START: `Controls` makes a click on it start the game. */
export const PRESS_START_ATTR = 'data-press-start';

/** How long the start jingle rings before the page leaves (it lasts about half a second). */
export const SOUND_MS = 550;

export interface StartPorts {
  /** Where the mute and the remembered pick are read; null when the browser gives no storage. */
  storage: Pick<Storage, 'getItem'> | null;
  /** Plays the arcade's `start` sound. */
  playStart: () => void;
  wait: (ms: number) => Promise<void>;
  go: (href: string) => void;
  /** Opens SELECT YOUR APP. */
  open: () => void;
}

/** Whether the player muted the game; storage that is missing or refuses reads as not muted. */
export function isMuted(storage: Pick<Storage, 'getItem'> | null): boolean {
  try { return storage?.getItem(MUTED_KEY) === '1'; } catch { return false; }
}

/**
 * PRESS START with the app picked, or with the remembered pick when none is given; with neither, it
 * opens SELECT YOUR APP and goes nowhere yet. Holds a flash first when asked (the Konami code's
 * CHEAT ACTIVATED!). The Omni app opens /app; the Arcade plays the start sound and lets it ring
 * unless muted, then opens /play.
 */
export async function pressStart(ports: StartPorts, { holdMs = 0, pick }: { holdMs?: number; pick?: AppPick } = {}) {
  const app = pick ?? readChoice(ports.storage);
  if (!app) {
    ports.open();
    return;
  }
  if (holdMs > 0) await ports.wait(holdMs);
  if (app === 'app') {
    ports.go(APP_HREF);
    return;
  }
  if (!isMuted(ports.storage)) {
    ports.playStart();
    await ports.wait(SOUND_MS);
  }
  ports.go(PLAY_HREF);
}

export interface KeyPress {
  key: string;
  repeat: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  /** The key went to a focused control (a link, a button, a field), which answers Enter itself. */
  inControl: boolean;
}

/** Whether a key press starts the game: a plain Enter, not held, not aimed at a focused control. */
export function startsOnKey(k: KeyPress): boolean {
  return k.key === 'Enter' && !k.repeat && !k.altKey && !k.ctrlKey && !k.metaKey && !k.shiftKey && !k.inControl;
}

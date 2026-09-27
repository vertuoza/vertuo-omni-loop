// PRESS START on HOME (PRD 261): the arcade's `start` sound, unless the player muted the game, then
// the game at /play. The browser is reached through small ports, so the order is tested on its own.

/** Where PRESS START goes: the arcade. */
export const PLAY_HREF = '/play';

/** The arcade's own mute, kept per viewer (ArcadeApp.tsx writes it). */
export const MUTED_KEY = 'omni-loop:muted';

/** Marks an element PRESS START: `Controls` makes a click on it start the game. */
export const PRESS_START_ATTR = 'data-press-start';

/** How long the start jingle rings before the page leaves (it lasts about half a second). */
export const SOUND_MS = 550;

export interface StartPorts {
  /** Where the mute is read; null when the browser gives no storage. */
  storage: Pick<Storage, 'getItem'> | null;
  /** Plays the arcade's `start` sound. */
  playStart: () => void;
  wait: (ms: number) => Promise<void>;
  go: (href: string) => void;
}

/** Whether the player muted the game; storage that is missing or refuses reads as not muted. */
export function isMuted(storage: Pick<Storage, 'getItem'> | null): boolean {
  try { return storage?.getItem(MUTED_KEY) === '1'; } catch { return false; }
}

/**
 * Starts the game: holds a flash first when asked (the Konami code's CHEAT ACTIVATED!), plays the
 * start sound and lets it ring unless muted, then opens /play.
 */
export async function pressStart(ports: StartPorts, { holdMs = 0 }: { holdMs?: number } = {}) {
  if (holdMs > 0) await ports.wait(holdMs);
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

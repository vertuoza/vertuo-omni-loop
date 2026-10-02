// Arcade name entry, as a pure reducer: up to 10 characters from A–Z, 0–9 and `-`, typed on a
// keyboard or spun on a letter wheel (the on-screen pad). `cursor` is the slot being edited;
// 10 means every slot is full.

export const WHEEL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-';
export const NAME_MAX = 10;
export const NAME_RULE = /^[A-Z0-9-]{1,10}$/;

export interface NameState { chars: string[]; cursor: number }
export type NameAction =
  | { type: 'type'; char: string }
  | { type: 'erase' }
  | { type: 'spin'; dir: 1 | -1 }
  | { type: 'move'; dir: 1 | -1 }
  | { type: 'advance' };
export type NameSound = 'type' | 'erase' | 'tick' | 'move' | 'buzz';

/** One key as a name character: accents dropped, letters in capitals; anything else is null. */
export function foldChar(key: string): string | null {
  const c = key.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  return c.length === 1 && WHEEL.includes(c) ? c : null;
}

/** A whole name (a Google first name, say) folded to what the arcade accepts: `Élodie` → `ELODIE`. */
export function foldName(text: string): string {
  return [...text.normalize('NFC')].map((c) => (c === ' ' ? '-' : foldChar(c))).filter(Boolean).join('')
    .replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, NAME_MAX);
}

export function nameInit(name: string): NameState {
  const chars = [...foldName(name)];
  return { chars, cursor: Math.min(chars.length, NAME_MAX) };
}

export const nameValue = (s: NameState) => s.chars.join('');

export function nameReduce(s: NameState, a: NameAction): { state: NameState; sound: NameSound } {
  const chars = [...s.chars];
  const slot = Math.min(s.cursor, NAME_MAX - 1);
  switch (a.type) {
    case 'type': {
      if (s.cursor >= NAME_MAX) return { state: s, sound: 'buzz' };
      chars[s.cursor] = a.char;
      return { state: { chars, cursor: s.cursor + 1 }, sound: 'type' };
    }
    case 'erase': {
      if (!chars.length) return { state: s, sound: 'buzz' };
      if (s.cursor >= chars.length) { chars.pop(); return { state: { chars, cursor: chars.length }, sound: 'erase' }; }
      if (s.cursor === 0) { chars.splice(0, 1); return { state: { chars, cursor: 0 }, sound: 'erase' }; }
      chars.splice(s.cursor - 1, 1);
      return { state: { chars, cursor: s.cursor - 1 }, sound: 'erase' };
    }
    case 'spin': {
      const at = chars[slot] ? WHEEL.indexOf(chars[slot]) : a.dir > 0 ? -1 : 0;
      chars[slot] = WHEEL[(at + a.dir + WHEEL.length) % WHEEL.length]!;
      return { state: { chars, cursor: slot }, sound: 'tick' };
    }
    case 'move': {
      const cursor = Math.max(0, Math.min(chars.length, NAME_MAX - 1, s.cursor + a.dir));
      return { state: { chars, cursor }, sound: 'move' };
    }
    case 'advance': {
      // The pad's A: an empty slot starts at A, a filled one moves on.
      if (!chars[slot]) return nameReduce(s, { type: 'spin', dir: 1 });
      return nameReduce(s, { type: 'move', dir: 1 });
    }
  }
}

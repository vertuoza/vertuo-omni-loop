// The Konami code on HOME (PRD 261): ↑ ↑ ↓ ↓ ← → ← → B A. A pure matcher, fed one key name at a
// time (a KeyboardEvent's `key`), so the client component only has to listen and ask.

/** The code, as KeyboardEvent key names; B and A in lower case (typed capitals match too). */
export const KONAMI: readonly string[] = [
  'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a',
];

const norm = (key: string) => (key.length === 1 ? key.toLowerCase() : key);

/**
 * A fresh matcher: call it with each key pressed, and it answers true on the key that completes the
 * code. Only the last keys count, so a wrong key resets the code, and a key between two of its keys
 * breaks it; a stray key before it does not.
 */
export function konami(): (key: string) => boolean {
  let recent: string[] = [];
  return (key) => {
    recent = [...recent, norm(key)].slice(-KONAMI.length);
    const hit = recent.length === KONAMI.length && recent.every((k, i) => k === KONAMI[i]);
    if (hit) recent = [];
    return hit;
  };
}

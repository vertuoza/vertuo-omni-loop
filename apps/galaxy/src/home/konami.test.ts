import { describe, expect, it } from 'vitest';
import { KONAMI, konami } from './konami';

// The Konami code on HOME (PRD 261, s3): ↑ ↑ ↓ ↓ ← → ← → B A, in that order and nothing between.

/** Feeds `keys` to a fresh matcher and says whether the last one completed the code. */
function typed(keys: readonly string[]) {
  const press = konami();
  return keys.map((key) => press(key)).at(-1) ?? false;
}

describe('the Konami code', () => {
  it('is up, up, down, down, left, right, left, right, B, A', () => {
    expect(KONAMI).toEqual(['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']);
  });

  it('matches the exact sequence, on its last key only', () => {
    const press = konami();
    const results = KONAMI.map((key) => press(key));
    expect(results).toEqual([false, false, false, false, false, false, false, false, false, true]);
  });

  it('matches B and A typed in capitals too', () => {
    expect(typed([...KONAMI.slice(0, 8), 'B', 'A'])).toBe(true);
  });

  it('resets on a wrong key: what came before it no longer counts', () => {
    const press = konami();
    for (const key of KONAMI.slice(0, 4)) press(key);
    expect(press('x')).toBe(false);
    for (const key of KONAMI.slice(4)) expect(press(key)).toBe(false);
    expect(KONAMI.map((key) => press(key)).at(-1)).toBe(true);
  });

  it('does not match with an extra key in the middle', () => {
    expect(typed([...KONAMI.slice(0, 5), 'ArrowUp', ...KONAMI.slice(5)])).toBe(false);
    expect(typed([...KONAMI.slice(0, 8), 'Enter', 'b', 'a'])).toBe(false);
  });

  it('matches after a stray up before it, and again after a match', () => {
    expect(typed(['ArrowUp', ...KONAMI])).toBe(true);
    expect(typed([...KONAMI, ...KONAMI])).toBe(true);
  });
});

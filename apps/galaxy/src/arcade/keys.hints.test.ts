import { describe, it, expect } from 'vitest';
import { hintAction, hintKey } from './keys';

// The hints name the buttons you have: the keyboard's on a computer, the Game Boy's on the two bodies.
describe('the hint wording', () => {
  const TODAY = ['A', 'B', 'START', 'ENTER', 'TAB', 'ESC', '⌫', 'TYPE', '▲▼', '◀▶', '◀ ▶'];

  it('reads as today on full, every hint', () => {
    for (const k of TODAY) expect(hintKey(k, 'full'), k).toBe(k);
  });

  for (const form of ['handheld', 'advance'] as const) {
    describe(`on ${form}`, () => {
      it('reads START for ENTER, SELECT for TAB and B for ⌫', () => {
        expect(hintKey('ENTER', form)).toBe('START');
        expect(hintKey('TAB', form)).toBe('SELECT');
        expect(hintKey('⌫', form)).toBe('B');
      });

      it('names no Esc either: B is the back button', () => {
        expect(hintKey('ESC', form)).toBe('B');
      });

      it('drops TYPE: there is no keyboard to type on', () => {
        expect(hintKey('TYPE', form)).toBeNull();
      });

      it('leaves A, B, START and the arrows as they are', () => {
        for (const k of ['A', 'B', 'START', '▲▼', '◀▶', '◀ ▶']) expect(hintKey(k, form), k).toBe(k);
      });

      it('never names ENTER, TAB, ESC, ⌫ or TYPE', () => {
        for (const k of TODAY) expect(['ENTER', 'TAB', 'ESC', '⌫', 'TYPE'], k).not.toContain(hintKey(k, form));
      });
    });
  }

  it('makes SELECT clickable, as TAB is', () => {
    expect(hintAction('SELECT')).toBe('select');
  });
});

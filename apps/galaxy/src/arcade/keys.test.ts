import { describe, it, expect } from 'vitest';
import { hintAction, keyAction } from './keys';

describe('the pad', () => {
  it('presses A and B with the letters the screens show, and with Z and X', () => {
    for (const k of ['a', 'A', 'z', 'Z', ' ']) expect(keyAction(k), k).toBe('a');
    for (const k of ['b', 'B', 'x', 'X', 'Escape']) expect(keyAction(k), k).toBe('b');
    expect(keyAction('Enter')).toBe('start');
    expect(keyAction('Tab')).toBe('select');
  });

  it('moves with the arrows only: A is never left', () => {
    expect(keyAction('ArrowLeft')).toBe('left');
    expect(keyAction('ArrowUp')).toBe('up');
    for (const k of ['w', 's', 'd', 'q']) expect(keyAction(k), k).toBeNull();
  });

  it('makes the A, B, START, ENTER and TAB hints clickable, not the arrows', () => {
    expect(hintAction('A')).toBe('a');
    expect(hintAction('B')).toBe('b');
    expect(hintAction('START')).toBe('start');
    expect(hintAction('ENTER')).toBe('start');
    expect(hintAction('TAB')).toBe('select');
    for (const k of ['▲▼', '◀ ▶', '⌫', 'TYPE']) expect(hintAction(k), k).toBeNull();
  });
});

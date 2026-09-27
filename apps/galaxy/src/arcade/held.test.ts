import { describe, expect, it } from 'vitest';
import { createHeld } from './held';

const shown = (h: ReturnType<typeof createHeld>) => [...h.buttons()].sort();

describe('the held buttons, from the keyboard', () => {
  it('holds a key\'s button from its key down to its key up', () => {
    const h = createHeld();
    h.keyDown('ArrowLeft');
    expect(shown(h)).toEqual(['left']);
    h.keyDown(' ');
    expect(shown(h)).toEqual(['a', 'left']);
    h.keyUp('ArrowLeft');
    expect(shown(h)).toEqual(['a']);
    h.keyUp(' ');
    expect(shown(h)).toEqual([]);
  });

  it('keeps a button held while another key for it is still down', () => {
    const h = createHeld();
    h.keyDown('z');
    h.keyDown('k');
    h.keyUp('z');
    expect(shown(h)).toEqual(['a']);
    h.keyUp('k');
    expect(shown(h)).toEqual([]);
  });

  it('releases a letter whatever its case on the way up (Shift pressed in between)', () => {
    const h = createHeld();
    h.keyDown('a');
    h.keyUp('A');
    expect(shown(h)).toEqual([]);
  });

  it('ignores a key that is no button, and a key up it never saw go down', () => {
    const h = createHeld();
    h.keyDown('q');
    h.keyUp('ArrowRight');
    expect(shown(h)).toEqual([]);
  });
});

describe('the held buttons, from the pad', () => {
  it('holds each finger\'s button, several fingers at once, until it lifts', () => {
    const h = createHeld();
    h.fingerDown(1, 'right');
    h.fingerDown(2, 'a');
    expect(shown(h)).toEqual(['a', 'right']);
    h.fingerUp(1);
    expect(shown(h)).toEqual(['a']);
    h.fingerUp(2);
    expect(shown(h)).toEqual([]);
  });

  it('follows a finger that slides from one arm of the D-pad to the other', () => {
    const h = createHeld();
    h.fingerDown(1, 'left');
    h.fingerDown(1, 'right');
    expect(shown(h)).toEqual(['right']);
  });

  it('releases a cancelled finger (the browser took the touch away)', () => {
    const h = createHeld();
    h.fingerDown(7, 'a');
    h.fingerCancel(7);
    expect(shown(h)).toEqual([]);
  });

  it('keeps a button held by a key when a finger on it lifts, and the other way round', () => {
    const h = createHeld();
    h.keyDown('ArrowLeft');
    h.fingerDown(1, 'left');
    h.fingerUp(1);
    expect(shown(h)).toEqual(['left']);
    h.fingerDown(1, 'left');
    h.keyUp('ArrowLeft');
    expect(shown(h)).toEqual(['left']);
  });
});

describe('losing focus', () => {
  it('clears every key and every finger', () => {
    const h = createHeld();
    h.keyDown('ArrowRight');
    h.keyDown(' ');
    h.fingerDown(3, 'left');
    h.clear();
    expect(shown(h)).toEqual([]);
    h.keyUp('ArrowRight'); // the key up that arrives after the focus came back changes nothing
    h.fingerUp(3);
    expect(shown(h)).toEqual([]);
  });
});

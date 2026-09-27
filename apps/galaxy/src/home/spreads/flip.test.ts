import { describe, expect, it } from 'vitest';
import { FLIP_ATTR, flipCard } from './flip';

// A trading card turns over on a click, which a tap, Enter and Space all make on a button. Hover
// flips it too, in home.css, with no script.
const card = (pressed: string | null) => {
  const attrs = new Map<string, string>([[FLIP_ATTR, '']]);
  if (pressed !== null) attrs.set('aria-pressed', pressed);
  const el = {
    getAttribute: (k: string) => attrs.get(k) ?? null,
    setAttribute: (k: string, v: string) => { attrs.set(k, v); },
    closest: (sel: string) => (sel === `[${FLIP_ATTR}]` ? el : null),
  };
  return el;
};

describe('flipping a trading card', () => {
  it('turns a card face down, then face up again', () => {
    const c = card('false');
    expect(flipCard(c)).toBe(true);
    expect(c.getAttribute('aria-pressed')).toBe('true');
    expect(flipCard(c)).toBe(true);
    expect(c.getAttribute('aria-pressed')).toBe('false');
  });

  it('flips the card a click inside it landed on', () => {
    const c = card('false');
    const inside = { closest: (sel: string) => c.closest(sel) };
    expect(flipCard(inside)).toBe(true);
    expect(c.getAttribute('aria-pressed')).toBe('true');
  });

  it('leaves anything that is not a card alone', () => {
    expect(flipCard({ closest: () => null })).toBe(false);
    expect(flipCard(null)).toBe(false);
  });
});

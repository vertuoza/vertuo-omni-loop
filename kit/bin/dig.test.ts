import { describe, expect, it } from 'vitest';
import { dig, digText } from './dig.ts';

const VALUE: unknown = JSON.parse('{"a":{"b":[{"c":"deep"}],"n":1}}');

describe('dig', () => {
  it('reads the value at a path of keys and indexes', () => {
    expect(dig(VALUE, 'a', 'b', 0, 'c')).toBe('deep');
    expect(dig(VALUE, 'a', 'n')).toBe(1);
    expect(dig(VALUE)).toBe(VALUE);
  });

  it('gives undefined where the path stops, through null and undefined alike', () => {
    expect(dig(VALUE, 'a', 'missing', 'c')).toBeUndefined();
    expect(dig(null, 'a')).toBeUndefined();
  });
});

describe('digText', () => {
  it('gives the text at the path', () => {
    expect(digText(VALUE, 'a', 'b', 0, 'c')).toBe('deep');
  });

  it('throws, naming the path, on anything but text', () => {
    expect(() => digText(VALUE, 'a', 'n')).toThrow('expected text at a.n, got number');
    expect(() => digText(VALUE, 'a', 'gone')).toThrow('expected text at a.gone, got undefined');
  });
});

import { describe, expect, it } from 'vitest';
import { listOf, numberOf, textOf } from './unparsed';

describe('a Supabase answer read as it comes', () => {
  it('lists the rows sent, and none when the answer carried no body', () => {
    expect(listOf([{ id: 'a' }])).toEqual([{ id: 'a' }]);
    expect(listOf(null)).toEqual([]);
    expect(listOf(undefined)).toEqual([]);
  });

  it('reads a column as a number, whether PostgREST sent it as a number or as text', () => {
    expect(numberOf(7)).toBe(7);
    expect(numberOf('7')).toBe(7);
    expect(numberOf(null)).toBe(0);
    expect(numberOf('seven')).toBeNaN();
  });

  it('reads a column as text, whatever it holds', () => {
    expect(textOf('acme/widgets')).toBe('acme/widgets');
    expect(textOf(42)).toBe('42');
    expect(textOf(null)).toBe('null');
  });
});

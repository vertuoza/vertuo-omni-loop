import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { orEmpty, orNull, orThrow, parseRow, parseRows } from './parse-rows';

// A row that holds personal data: a failed parse may name its columns, never its values.
const Person = z.strictObject({ id: z.string(), email: z.email(), age: z.number() });
const ada = { id: 'p1', email: 'ada@example.com', age: 36 };
const WHERE = 'people/store: people';

/** Silences console.error, and answers a reader of every line logged since. */
const logged = (): (() => string[]) => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  return () => log.mock.calls.map((call) => call.map(String).join(' '));
};

afterEach(() => { vi.restoreAllMocks(); });

describe('parseRows', () => {
  it('answers the rows, typed by the schema, and logs nothing', () => {
    const log = vi.spyOn(console, 'error');
    expect(parseRows(Person, [ada], WHERE)).toEqual({ ok: true, value: [ada] });
    expect(log).not.toHaveBeenCalled();
  });

  it('reads an answer with no body as no rows, as the arcade always has', () => {
    expect(parseRows(Person, null, WHERE)).toEqual({ ok: true, value: [] });
    expect(parseRows(Person, undefined, WHERE)).toEqual({ ok: true, value: [] });
  });

  it('fails a row with a missing column, a wrong type, a forbidden null or an unknown column, naming each path', () => {
    const noAge = { id: ada.id, email: ada.email };
    const rows = [noAge, { ...ada, age: '36' }, { ...ada, email: null }, { ...ada, extra: 1 }];
    const parsed = parseRows(Person, rows, WHERE);
    expect(parsed.ok).toBe(false);
    const error = parsed.ok ? '' : parsed.error;
    expect(error).toContain('people/store: people: the answer does not parse');
    expect(error).toContain('[0].age invalid_type (expected number)');
    expect(error).toContain('[1].age invalid_type (expected number)');
    expect(error).toContain('[2].email invalid_type (expected string)');
    expect(error).toContain('[3] unrecognized_keys');
  });

  it('fails an answer that is not a list of rows', () => {
    const parsed = parseRows(Person, ada, WHERE);
    expect(parsed).toEqual({ ok: false, error: 'people/store: people: the answer does not parse: (the answer) invalid_type (expected array)' });
  });

  it("logs a failure once, naming where and the zod path, and never a row's values", () => {
    const lines = logged();
    parseRows(Person, [{ ...ada, age: 'thirty-six' }, { ...ada, id: 7 }], WHERE);
    expect(lines()).toEqual(['people/store: people: the answer does not parse: [0].age invalid_type (expected number); [1].id invalid_type (expected string)']);
    for (const value of ['ada@example.com', 'thirty-six', 'p1', '7)']) expect(lines().join('\n')).not.toContain(value);
  });

  it('names at most five issues, and how many more there are', () => {
    const lines = logged();
    parseRows(Person, Array.from({ length: 7 }, () => ({ ...ada, age: null })), WHERE);
    expect(lines()[0]).toMatch(/\[4\]\.age invalid_type \(expected number\) and 2 more$/);
  });
});

describe('parseRow', () => {
  it('answers one value, typed by the schema', () => {
    expect(parseRow(Person, ada, WHERE)).toEqual({ ok: true, value: ada });
    expect(parseRow(Person.nullable(), null, WHERE)).toEqual({ ok: true, value: null });
  });

  it('fails, and logs once, a value that does not parse, a null the schema forbids included', () => {
    const lines = logged();
    expect(parseRow(Person, null, 'people/store: person()')).toEqual({ ok: false, error: 'people/store: person(): the answer does not parse: (the answer) invalid_type (expected object)' });
    expect(parseRow(z.number(), '3', 'people/store: count()').ok).toBe(false);
    expect(lines()).toHaveLength(2);
  });
});

describe("the failure forms: each module's own failed read", () => {
  beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => undefined); });
  const good = () => parseRows(Person, [ada], WHERE);
  const bad = () => parseRows(Person, [{}], WHERE);

  it('[]: orEmpty answers the rows, or none', () => {
    expect(orEmpty(good())).toEqual([ada]);
    expect(orEmpty(bad())).toEqual([]);
  });

  it('null: orNull answers the value, or null', () => {
    expect(orNull(parseRow(Person, ada, WHERE))).toEqual(ada);
    expect(orNull(parseRow(Person, {}, WHERE))).toBeNull();
  });

  it('{ ok: false }: the parse itself is the result a module returns', () => {
    const parsed = bad();
    expect(parsed.ok ? '' : parsed.error).toContain(WHERE);
  });

  it('a throw: orThrow answers the value, or throws the error, for a step that retries', () => {
    expect(orThrow(good())).toEqual([ada]);
    expect(() => orThrow(bad())).toThrow(/^people\/store: people: the answer does not parse: \[0\]\.id invalid_type/);
  });
});

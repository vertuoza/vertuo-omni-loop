// PRD 1679, s1: the ceilings file — first ceilings at today's size rounded up to the next KiB, and
// never a ceiling raised.
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { ceilingsText, parseCeilings, readCeilings, roundUpToKib, setCeilings, writeCeilings } from './ceilings.ts';

describe('roundUpToKib', () => {
  it.each([
    [0, 1024],
    [1, 1024],
    [1023, 1024],
    [1024, 1024],
    [1025, 2048],
    [136525, 137216],
  ])('rounds %i bytes up to %i', (bytes, ceiling) => {
    expect(roundUpToKib(bytes)).toBe(ceiling);
  });
});

describe('setCeilings', () => {
  it('gives each target with no ceiling its size rounded up to the next KiB', () => {
    const { ceilings, added } = setCeilings({}, [{ target: 'briefing', bytes: 2262 }, { target: 'session', bytes: 4097 }]);
    expect(ceilings).toEqual({ briefing: 3072, session: 5120 });
    expect(added).toEqual([{ target: 'briefing', ceiling: 3072 }, { target: 'session', ceiling: 5120 }]);
  });

  it('never raises a ceiling that exists, even over it, and never lowers one', () => {
    const { ceilings, added } = setCeilings({ briefing: 2048, 'form:ci': 9000 }, [
      { target: 'briefing', bytes: 5000 },
      { target: 'form:ci', bytes: 100 },
      { target: 'form:review', bytes: 900 },
    ]);
    expect(ceilings).toEqual({ briefing: 2048, 'form:ci': 9000, 'form:review': 1024 });
    expect(added).toEqual([{ target: 'form:review', ceiling: 1024 }]);
  });

  it('keeps a ceiling whose target is no longer measured', () => {
    expect(setCeilings({ 'context:OLD.md': 4096 }, [{ target: 'briefing', bytes: 10 }]).ceilings).toEqual({ 'context:OLD.md': 4096, briefing: 1024 });
  });

  it('refuses to set anything when a target could not be measured, naming it', () => {
    expect(() => setCeilings({}, [{ target: 'briefing', bytes: 10 }, { target: 'context:GONE.md', error: 'GONE.md does not exist' }])).toThrow(
      'cannot measure context:GONE.md: GONE.md does not exist',
    );
  });
});

describe('the ceilings file', () => {
  it('reads as no ceiling at all when it does not exist', () => {
    const { root } = makeRepo();
    expect(readCeilings({ root, file: 'budgets/context.json' })).toEqual({});
  });

  it('is written sorted, two-space JSON with one newline, and read back the same', () => {
    const { root, read } = makeRepo();
    writeCeilings({ root, file: 'budgets/context.json' }, { session: 3072, briefing: 2048, 'form:ci': 7168 });
    expect(read('budgets/context.json')).toBe('{\n  "briefing": 2048,\n  "form:ci": 7168,\n  "session": 3072\n}\n');
    expect(readCeilings({ root, file: 'budgets/context.json' })).toEqual({ briefing: 2048, 'form:ci': 7168, session: 3072 });
    expect(ceilingsText({})).toBe('{}\n');
  });

  it.each([
    ['text that is no JSON', '{', /c\.json: not valid JSON/],
    ['a list', '[]', /c\.json: \(top level\)/],
    ['a ceiling in words', '{ "briefing": "2 KB" }', /c\.json: briefing: .*whole number of bytes/],
    ['a fractional ceiling', '{ "briefing": 1.5 }', /c\.json: briefing/],
    ['a negative ceiling', '{ "briefing": -1 }', /c\.json: briefing/],
  ])('refuses %s, naming the file', (_what, text, message) => {
    expect(() => parseCeilings(text, 'c.json')).toThrow(message);
  });
});

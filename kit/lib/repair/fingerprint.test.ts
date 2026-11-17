// One cause, one fingerprint (PRD 2980 s1, AC-2): the class, the place and the signature, normalised, then hashed.
import { describe, expect, it } from 'vitest';
import { fingerprint, normaliseCause } from './fingerprint.ts';

const failure = (line: number, at: string, hash: string, tmp: string) => ({
  class: 'code' as const,
  place: `kit/lib/sum.test.ts:${String(line)}:5 > sums two numbers`,
  signature: `AssertionError: expected 3 to be 4 at kit/lib/sum.test.ts:${String(line)}:5 (${hash}) ${at} reading ${tmp}/out.json`,
});

describe('fingerprint', () => {
  it('gives two failures of one test, at other lines, times, hashes and temporary paths, one fingerprint', () => {
    const first = failure(12, '2026-11-17T02:00:00.123Z', 'a1b2c3d', '/tmp/vitest-x7k2Qa');
    const second = failure(40, '2026-11-18T14:31:07Z', 'f9e8d7c6b5a4f9e8d7c6b5a4f9e8d7c6b5a4f9e8', '/private/var/folders/9z/k3j2h1/T/vitest-Pq81');
    expect(fingerprint(first)).toBe(fingerprint(second));
  });

  it('drops the numbers inside a message', () => {
    const one = { class: 'code' as const, place: 'kit/lib/a.ts', signature: 'expected 3 to be 4 after 120ms' };
    const two = { ...one, signature: 'expected 17 to be 2 after 9ms' };
    expect(fingerprint(one)).toBe(fingerprint(two));
  });

  it('gives another test, another class or another error another fingerprint', () => {
    const base = failure(12, '02:00:00', 'a1b2c3d', '/tmp/x');
    expect(fingerprint({ ...base, place: 'kit/lib/product.test.ts:12:5 > multiplies two numbers' })).not.toBe(fingerprint(base));
    expect(fingerprint({ ...base, class: 'flake' })).not.toBe(fingerprint(base));
    expect(fingerprint({ ...base, signature: 'TypeError: sum is not a function' })).not.toBe(fingerprint(base));
  });

  it('is 64 lowercase hex characters', () => {
    expect(fingerprint(failure(1, '', 'abc1234', '/tmp/a'))).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('normaliseCause', () => {
  it('drops line numbers, hashes, times, temporary paths and numbers, and folds the spaces', () => {
    expect(normaliseCause('a.ts:12:5  failed at 2026-11-17T02:00:00Z in /tmp/run-9Xa/b.ts (deadbee1)')).toBe('a.ts failed at <time> in <tmp> (<hash>)');
    expect(normaliseCause('Error on line 42 of 3 tries')).toBe('Error on line of # tries');
    expect(normaliseCause('C:\\Users\\dev\\AppData\\Local\\Temp\\omni-1\\a.ts broke')).toBe('<tmp> broke');
    expect(normaliseCause('run 0b7c2d4e-1f3a-4b5c-8d9e-0a1b2c3d4e5f ended at 14:31:07')).toBe('run <id> ended at <time>');
  });

  it('keeps a word that only looks like hex', () => {
    expect(normaliseCause('the facade added a decade')).toBe('the facade added a decade');
  });
});

/**
 * **The tests' assertion helper** (PRD 976): where a test wrote `value!`, claiming a value it had not
 * checked, it proves it instead. A missing value fails the test with a message naming what was
 * expected, where `!` let `undefined` through to fail on the next line with a `TypeError`.
 */
import { AssertionError } from 'node:assert';

/** Fails the test unless `value` is neither `undefined` nor `null`; past it, `value` is narrowed. */
export function assertDefined<T>(value: T, what: string): asserts value is NonNullable<T> {
  if (value === undefined || value === null) {
    throw new AssertionError({ message: `expected ${what}, got ${String(value)}`, actual: value, expected: what });
  }
}

// The tests' read of one item of a list (PRD 976): where a test wrote `list[index]!`, claiming an item
// it had not checked, it proves it instead, failing the test with a message naming the item missing.
import { assertDefined } from 'vertuo-omni-plan/kit/test/assert.ts';

/** Item `index` of `list`; fails the test when there is none. */
export function item<T>(list: readonly T[], index: number): T {
  const value = list[index];
  assertDefined(value, `item ${index} of ${list.length}`);
  return value;
}

/** `value`, where a test wrote `value!`; fails the test, naming `what`, when it is undefined or null. */
export function present<T>(value: T, what: string): NonNullable<T> {
  assertDefined(value, what);
  return value;
}

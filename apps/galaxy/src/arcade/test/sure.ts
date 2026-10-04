// The arcade tests' proof of a value a `!` only claimed (PRD 976): kit/test/assert.ts's
// `assertDefined`, as an expression, so a test proves an item where it reads it,
// `sure(layout.suns[0], 'layout.suns[0]').x`, and fails naming it when it is missing.
import { assertDefined } from 'vertuo-omni-plan/kit/test/assert.ts';

/** `value`, proved present: the test fails with a message naming `what` when it is undefined or null. */
export function sure<T>(value: T, what: string): NonNullable<T> {
  assertDefined(value, what);
  return value;
}

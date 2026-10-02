// The game's tests read a value they expect, proved where `!` only claimed it (PRD 976): a missing
// one fails the test through the kit's assertion helper, naming what was expected.
import { assertDefined } from '../../kit/test/assert.ts';

/** `value`, which the test expects: it fails naming `what` when the value is missing. */
export function present<T>(value: T, what: string): NonNullable<T> {
  assertDefined(value, what);
  return value;
}

/** Item `index` of `list`, which the test expects: it fails naming `what` when there is none. */
export function nth<T>(list: readonly T[], index: number, what: string): NonNullable<T> {
  return present(list[index], `${what} (item ${index} of ${list.length})`);
}

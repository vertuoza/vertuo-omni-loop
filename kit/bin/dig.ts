// How kit/bin's tests read the JSON a command printed or a fake received (PRD 976): a path into a
// value of unknown shape, where `JSON.parse(out).a.b` read through `any`.
import { propertyOf } from '../lib/narrow.ts';

/** The value at `path` inside `value`, as `value.a.b` reads it: `undefined` where the path stops. */
export function dig(value: unknown, ...path: readonly (string | number)[]): unknown {
  return path.reduce<unknown>((inner, key) => propertyOf(inner, String(key)), value);
}

/** The text at `path` inside `value`; throws, naming the path, when it is not text. */
export function digText(value: unknown, ...path: readonly (string | number)[]): string {
  const found = dig(value, ...path);
  if (typeof found !== 'string') throw new Error(`expected text at ${path.join('.') || 'the top'}, got ${typeof found}`);
  return found;
}

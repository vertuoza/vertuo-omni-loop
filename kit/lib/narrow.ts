/**
 * **The shared narrowing helpers** (PRD 942, s1): one type guard or parser for each reason that
 * recurs across the repository's `// ts-allow:` comments, so the fact a cast asserted is proven
 * instead. Pure, with no dependency: the kit, the App, the arcade and the packages all import it.
 *
 * Each helper accepts exactly what the cast it replaces asserted, and nothing it did not.
 */

/** `values.includes(value)` for a value of any type: true when `value` is one of `values`, which narrows it. */
export function isOneOf<T>(values: readonly T[], value: unknown): value is T {
  return values.some((member) => member === value);
}

/** `values.indexOf(value)` for a value of any type: its position in `values`, or -1. */
export function positionOf<T>(values: readonly T[], value: unknown): number {
  return values.findIndex((member) => member === value);
}

/** Group `index` of a match that must hold it; throws when the group, or the match, is absent. */
export function group(match: RegExpMatchArray | RegExpExecArray | null | undefined, index: number): string {
  const value = match?.[index];
  if (value === undefined) throw new Error(`group ${index} did not match`);
  return value;
}

/** The text before the first `separator`, or the whole text when it holds none. */
export function firstPart(text: string, separator: string): string {
  const at = text.indexOf(separator);
  return at === -1 ? text : text.slice(0, at);
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A YYYY-MM-DD date's year, month and day, as numbers; throws on any other text. */
export function dateParts(date: string): [number, number, number] {
  const match = DATE.exec(date);
  if (!match) throw new Error(`not a YYYY-MM-DD date: ${date}`);
  return [Number(group(match, 1)), Number(group(match, 2)), Number(group(match, 3))];
}

/** Property `key` of any value, as `value?.[key]` reads it: undefined for null and undefined. */
export function propertyOf(value: unknown, key: string): unknown {
  return value === null || value === undefined ? undefined : Reflect.get(Object(value), key);
}

/** Whatever was thrown, read for its message: its `message` when that is text, else the value as text. */
export function messageOf(error: unknown): string {
  const message = propertyOf(error, 'message');
  return typeof message === 'string' ? message : String(error);
}

/** `Object.keys(record)`, as the record's own keys. */
export function keysOf<K extends string>(record: Readonly<Record<K, unknown>>): K[] {
  return Object.keys(record).filter((key): key is K => Object.hasOwn(record, key));
}

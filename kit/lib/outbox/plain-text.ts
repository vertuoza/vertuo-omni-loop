// How the outbox and its policies read a value handed in from outside as text (PRD 976): where
// `String(value ?? '')` wrote an object out as `[object Object]`, a value that is not text, a number
// or a boolean now reads as no text at all.

/** A string as it is, a number or a boolean written out, and anything else (nothing, an object) as ''. */
export function plainText(value: unknown): string {
  if (typeof value === 'string') return value;
  return typeof value === 'number' || typeof value === 'boolean' ? String(value) : '';
}

/** `Array.isArray`, keeping the list's own item type where the built-in narrows a readonly list to `any[]`. */
export function isList<T>(value: readonly T[] | null | undefined): value is readonly T[] {
  return Array.isArray(value);
}

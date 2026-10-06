// A Supabase answer, read as it comes (PRD 976). The typed client says what PostgREST should send;
// nothing parsed what it did send. Each helper takes the value as unknown (or as possibly absent), so
// the check the arcade has always made on it stays a check instead of being dropped on the type's word.

/** The rows of an answer, or none when it carried no body. */
export function listOf<T>(rows: T[] | null | undefined): T[] {
  return rows ?? [];
}

/** A column read as a number, as `Number()` reads it: PostgREST may send a bigint or a numeric as text. */
export function numberOf(value: unknown): number {
  return Number(value);
}

/** A column read as text, as `String()` reads it. */
export function textOf(value: unknown): string {
  return String(value);
}

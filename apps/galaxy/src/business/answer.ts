// What the Supabase client answers, read as unparsed (PRD 976): the business's stores take the client
// untyped, so a function's data is read as unknown until a schema or a guard reads it, and a select's
// rows are kept as possibly null, whatever the client's type says, so none reads as no row.

/** A function's answer: its data unknown, its refusal the database's code and message. */
export type RpcAnswer = { data: unknown; error: { code: string; message: string } | null };

/** A select's rows, or none when the client answered null. */
export function rowsOr<T>(rows: T[] | null): T[] {
  return rows ?? [];
}

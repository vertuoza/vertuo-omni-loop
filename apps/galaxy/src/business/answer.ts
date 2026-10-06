// What the Supabase client answers, read as unparsed (PRD 976): the business's stores take the client
// untyped, so a function's data is read as unknown until its schema parses it (PRD 1030).

/** A function's answer: its data unknown, its refusal the database's code and message. */
export type RpcAnswer = { data: unknown; error: { code: string; message: string } | null };

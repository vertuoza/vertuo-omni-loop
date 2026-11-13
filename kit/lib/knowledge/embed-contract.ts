// The `embed` Edge Function's contract (PRD 2728; supabase/functions/embed/), shared by its two callers: the App's
// knowledge-embed job and a product MCP's search. One place, so the two never disagree on the model, the vectors'
// length or how many texts a call may carry.

/** The model every vector of a product's knowledge is made with, and the name the vectors are kept under. */
export const EMBED_MODEL = 'gte-small';
/** How many numbers a gte-small vector holds. */
export const EMBED_DIMENSIONS = 384;
/** The most texts one call to `embed` carries: gte-small cannot embed more within an Edge Function's CPU budget
 * (64 a call answered 546 in production, bug 2748). The function's own cap (MAX_TEXTS) is never below it. */
export const EMBED_BATCH = 8;

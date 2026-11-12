// The galaxy's client of the `embed` Edge Function (PRD 2728 s5), which turns texts into vectors with
// Supabase's built-in gte-small (supabase/functions/embed/, s3). The contract, as the spec writes it:
//
//   POST <supabase url>/functions/v1/embed  {texts: string[]}  → {model: "gte-small", vectors: number[][]}
//
// one 384-long vector per text, in order, at most 8 texts a call (bug 2748); only the service role's JWT gets in. The
// client sends what it is given, passes the caller's signal on (the search's 2-second budget), and checks the
// answer's shape: a refusal or an answer out of shape throws, naming the status, never the key or a text.
import { z } from 'zod';

/** The model every vector of a product's knowledge is made with. */
export const EMBED_MODEL = 'gte-small';
/** Its vectors' length. */
export const EMBED_DIMENSIONS = 384;
/** At most this many texts per call. */
export const EMBED_BATCH = 8;

/** Turns texts into vectors, one per text, in order; throws when it cannot, or once `signal` aborts. */
export type Embedder = (texts: readonly string[], signal: AbortSignal) => Promise<number[][]>;

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

const Answer = z.object({
  model: z.literal(EMBED_MODEL),
  vectors: z.array(z.array(z.number()).length(EMBED_DIMENSIONS)),
});

/** The `embed` function of the Supabase project at `url`, called with the service role's key. */
export function embedClient({ url, serviceRoleKey, fetch = globalThis.fetch }: { url: string; serviceRoleKey: string; fetch?: Fetch }): Embedder {
  const endpoint = `${url.replace(/\/+$/, '')}/functions/v1/embed`;
  return async (texts, signal) => {
    if (texts.length === 0) return [];
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { authorization: `Bearer ${serviceRoleKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ texts }),
      signal,
    });
    if (!response.ok) throw new Error(`embed: answered ${String(response.status)}`);
    const parsed = Answer.safeParse(await response.json().catch(() => null));
    if (!parsed.success || parsed.data.vectors.length !== texts.length) throw new Error('embed: answered out of shape');
    return parsed.data.vectors;
  };
}

// The App's client of the `embed` Edge Function (PRD 2728 s4, spec "The model"): the texts in, one gte-small
// vector per text out, in order. It calls `<SUPABASE_URL>/functions/v1/embed` as the service role
// (`SUPABASE_SERVICE_ROLE_KEY`, the approved check's own pair), the only caller the function lets in:
//
//   POST {texts: string[]}   at most 8 texts per call (the function cuts each to 2,000 characters)
//   200  {model, vectors}    `model` "gte-small", one vector of 384 numbers per text, in order
//
// Any other answer (a refusal, a timeout, a model or a length it did not ask for) is thrown, naming the status
// or the field, never the texts: what it sends is a product's knowledge, and nothing of it is logged
// (L-GDPR-2). The job reads a throw as a try to make again.
//
// A batch the function cannot embed within its budget (546, its worker limit, or 503) is split in halves and each
// half sent again, down to one text: a single text that still does not fit is thrown (bug 2748).
import { z } from 'zod';
import { EMBED_BATCH, EMBED_DIMENSIONS, EMBED_MODEL } from 'omni-loop/kit/lib/knowledge/embed-contract.ts';
import type { Connection } from '../approved-check/record.ts';

/** How long one call may take before it is given up: a cold edge runtime loads the model first. */
const EMBED_TIMEOUT_MS = 60_000;

/** Turns texts (at most 8) into their vectors, in order; throws when it cannot. */
export type Embedder = (texts: readonly string[]) => Promise<number[][]>;

const AnswerSchema = z.object({
  model: z.literal(EMBED_MODEL),
  vectors: z.array(z.array(z.number()).length(EMBED_DIMENSIONS)),
});

/** The `embed` function's URL on the project `url` names. */
export const embedUrl = (url: string): string => `${url.replace(/\/+$/, '')}/functions/v1/embed`;

/** The answer to one POST of `texts`, or the throw naming why there is none. */
async function post(fetch: typeof globalThis.fetch, endpoint: string, key: string, texts: readonly string[], timeoutMs: number): Promise<Response> {
  try {
    return await fetch(endpoint, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, apikey: key, 'content-type': 'application/json' },
      body: JSON.stringify({ texts }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const late = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    throw new Error(`embed: ${late ? `no answer within ${String(timeoutMs)} ms` : 'the call failed'}`);
  }
}

/** The vectors of an answer to `count` texts, or the throw naming its status or its first wrong field. */
async function vectorsOf(response: Response, count: number): Promise<number[][]> {
  if (!response.ok) throw new Error(`embed answered ${String(response.status)}`);
  const parsed = AnswerSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) {
    const [issue] = parsed.error.issues;
    throw new Error(`embed answered out of shape: ${issue?.path.join('.') || '(answer)'}: ${issue?.message ?? 'malformed'}`);
  }
  const { vectors } = parsed.data;
  if (vectors.length !== count) throw new Error(`embed answered ${String(vectors.length)} vectors for ${String(count)} texts`);
  return vectors;
}

/** The answers that say the function ran out of its budget for this batch: its worker limit, or unavailable. */
const OVER_BUDGET: ReadonlySet<number> = new Set([503, 546]);

/** The client of `embed`, as the service role on `connection`. */
export function embedClient({ url, key, fetch = globalThis.fetch }: Connection, { timeoutMs = EMBED_TIMEOUT_MS }: { timeoutMs?: number } = {}): Embedder {
  const endpoint = embedUrl(url);
  const embed = async (texts: readonly string[]): Promise<number[][]> => {
    const response = await post(fetch, endpoint, key, texts, timeoutMs);
    if (OVER_BUDGET.has(response.status) && texts.length > 1) {
      const half = Math.ceil(texts.length / 2);
      return [...await embed(texts.slice(0, half)), ...await embed(texts.slice(half))];
    }
    return vectorsOf(response, texts.length);
  };
  return async (texts) => {
    if (texts.length === 0) return [];
    if (texts.length > EMBED_BATCH) throw new Error(`embed takes at most ${String(EMBED_BATCH)} texts a call, not ${String(texts.length)}`);
    return embed(texts);
  };
}

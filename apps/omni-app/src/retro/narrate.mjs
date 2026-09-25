// `narrate`: the fact sheet and the PRD's title and problem in, the model's JSON out (PRD 72, "The
// model, and the guard"). Slice s6 builds the call: one request to OpenRouter from the Vercel
// function, Claude Opus 5.5 unless `OPENROUTER_MODEL` says otherwise, the input capped by
// `LIMITS.modelInputTokens` and masked, the JSON checked and repaired once.
//
// Until then it asks no model, so every retro goes out facts only, saying why.
//
// The contract the function relies on:
//   in:  { sheet, prd: { title, problem }, env, fetch }
//   out: { model: string | null, reply: object | null, reason: string | null }
//        `reply` null means facts only, and `reason` says why ("no model key", "model unavailable (500)").
//        `reply` is the model's JSON: `{ summary, findings: { [id]: { title, whyItMatters, lesson? } },
//        lessons: [{ text, findings: [id] }] }`, which `guard` checks field by field.

export const NO_MODEL_KEY = 'no model key';

/**
 * @param {{ sheet: object, prd: { title: string, problem: string }, env?: Record<string, string | undefined>,
 *   fetch?: typeof fetch }} input
 * @returns {Promise<{ model: string | null, reply: object | null, reason: string | null }>}
 */
export async function narrate({ env = process.env } = {}) {
  if (!env.OPENROUTER_API_KEY) return { model: null, reply: null, reason: NO_MODEL_KEY };
  return { model: null, reply: null, reason: 'the model is not asked yet' };
}

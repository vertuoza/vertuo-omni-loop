// The business laws judge's model (PRD 2632 s4): one call through OpenRouter, as the canon gate sends a spec
// today (L-GDPR-5: no new service sees it), on Sonnet 5.5: a small model read hedges and the spec's own citations of a law as breaks (bug #2900).
// Every token-shaped string is masked before anything is sent (../jev/mask.ts). It never throws: no answer, a
// refusal, a timeout or a reply that is not JSON comes back as `{ ok: false, why }`, which the judge reads as
// neutral. Without OPENROUTER_API_KEY there is no model at all, and the judge says so.
import { propertyOf } from 'omni-loop/kit/lib/narrow.ts';
import type { OpenRouterEnv } from '../env';
import { maskSecrets } from '../jev/mask';
import type { AskLaws } from './judge.service';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
/** The judge's model, for both its readings (bug #2900). */
const JUDGE_MODEL = 'anthropic/claude-sonnet-5.5';
/** One call's time: a batch of 40 laws and a spec, its reply short. */
const JUDGE_TIMEOUT_MS = 40_000;
const MAX_TOKENS = 2048;

function parsed(text: string): unknown {
  try {
    const value: unknown = JSON.parse(text);
    return value;
  } catch {
    return undefined;
  }
}

/** The reply's text as JSON, a fence around it aside; undefined when it is not JSON. A model that corrects itself
 *  writes fenced answers with prose between them: its last fenced block is its final answer (#2806). One that reasons
 *  first may end on its answer unfenced (#2900). */
function jsonOf(content: unknown): unknown {
  if (typeof content !== 'string') return undefined;
  const whole = parsed(content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
  if (whole !== undefined) return whole;
  const last = [...content.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].at(-1)?.[1];
  if (last !== undefined) return parsed(last);
  return trailing(content);
}

/** The JSON object that ends `content` after its prose, unfenced, read from the last line it starts on (#2900). */
function trailing(content: string): unknown {
  const starts = [...content.matchAll(/(?:^|\n)\s*\{/g)].map((match) => match.index + match[0].lastIndexOf('{'));
  for (const start of starts.reverse()) {
    const value = parsed(content.slice(start).trim());
    if (value !== undefined) return value;
  }
  return undefined;
}

export type LawsModelOptions = { key: string; fetch?: typeof globalThis.fetch; model?: string; timeoutMs?: number };

/** The judge's model on OpenRouter's key `key`. */
export function lawsModel({ key, fetch = globalThis.fetch, model = JUDGE_MODEL, timeoutMs = JUDGE_TIMEOUT_MS }: LawsModelOptions): AskLaws {
  return async ({ system, user }) => {
    try {
      const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json', 'x-title': 'omni loop business laws' },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: MAX_TOKENS,
          response_format: { type: 'json_object' },
          messages: [{ role: 'system', content: maskSecrets(system) }, { role: 'user', content: maskSecrets(user) }],
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) return { ok: false, why: `OpenRouter answered ${response.status}` };
      const message = propertyOf(propertyOf(propertyOf(await response.json(), 'choices'), '0'), 'message');
      const reply = jsonOf(propertyOf(message, 'content'));
      return reply === undefined ? { ok: false, why: 'the reply was not JSON' } : { ok: true, reply };
    } catch (error) {
      return { ok: false, why: error instanceof Error && error.name === 'TimeoutError' ? 'it took too long' : 'OpenRouter could not be reached' };
    }
  };
}

/** The judge's model when OPENROUTER_API_KEY is set, and null otherwise: then every spec is not judged, and says why. */
export function lawsModelFromEnv(openrouter: OpenRouterEnv | null, fetch?: typeof globalThis.fetch): AskLaws | null {
  return openrouter ? lawsModel({ key: openrouter.key, ...(fetch ? { fetch } : {}) }) : null;
}

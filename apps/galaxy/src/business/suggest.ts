import type { Claim, ClaimKind } from './model';

// Suggested rivals (PRD 748 s3, decision 4): once offering, trade and region are picked, one call to
// the existing small model through OpenRouter (the shape of src/ask/classify.ts) for up to five rival
// names. Nothing names a competitor in the code: the names come from the model only, and each is stored
// as a `proposed` claim a person confirms (✓) or rejects (✗). Every rival the business already holds,
// in any state, is excluded, so a rejected rival is never suggested again. No key, a non-ok answer, an
// unparseable reply, a timeout or a throw give null, and nothing retries: the page then shows no guess
// and no error. Pure apart from the one fetch, which a test stubs.

export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
/** The small model the ask classifier uses. */
export const SUGGEST_MODEL = 'anthropic/claude-haiku-4.5';
export const SUGGEST_TIMEOUT_MS = 15_000;
/** The most guesses the page shows. */
export const MAX_GUESSES = 5;
const MAX_NAME = 80;

/** What the model is told: the confirmed picks, and every rival name it must not answer. */
export interface SuggestInput {
  offering: string[];
  trade: string[];
  region: string[];
  exclude: string[];
}

const confirmedValues = (claims: readonly Claim[], kind: ClaimKind) =>
  claims.filter((c) => c.kind === kind && c.state === 'confirmed').sort((a, b) => a.seq - b.seq).map((c) => c.value);

/** The model's input once offering, trade and region are each confirmed; null before. */
export function suggestInput(claims: readonly Claim[]): SuggestInput | null {
  const offering = confirmedValues(claims, 'offering');
  const trade = confirmedValues(claims, 'trade');
  const region = confirmedValues(claims, 'region');
  if (!offering.length || !trade.length || !region.length) return null;
  const exclude = claims.filter((c) => c.kind === 'rival').sort((a, b) => a.seq - b.seq).map((c) => c.value);
  return { offering, trade, region, exclude };
}

/** The three picks as one key: the page asks again only when it changes. Null until all three are in. */
export function suggestKey(claims: readonly Claim[]): string | null {
  const input = suggestInput(claims);
  if (!input) return null;
  const part = (vs: string[]) => vs.map((v) => v.trim().toLowerCase()).sort().join(',');
  return [part(input.offering), part(input.trade), part(input.region)].join('|');
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The reply's names, one a line, list marks aside, none excluded or repeated, five at most; null
 * when the reply is no text at all. */
export function readRivals(reply: unknown, exclude: readonly string[]): string[] | null {
  if (typeof reply !== 'string' || !reply.trim()) return null;
  const names: string[] = [];
  for (const line of reply.split('\n')) {
    const name = line.trim().replace(/^(?:[-*•]|\d+[.)])\s*/, '').replace(/^["'`]+|["'`]+$/g, '').trim();
    if (!name || name.length > MAX_NAME || /[\t\r]/.test(name)) continue;
    if (exclude.some((e) => same(e, name)) || names.some((n) => same(n, name))) continue;
    names.push(name);
    if (names.length === MAX_GUESSES) break;
  }
  return names;
}

const listed = (vs: readonly string[]) => (vs.length <= 1 ? vs.join('') : `${vs.slice(0, -1).join(', ')} and ${vs.at(-1)}`);

const SYSTEM = [
  'You name the companies a business competes with.',
  `Reply with at most ${MAX_GUESSES} real company names, one per line, and nothing else: no numbering, no comments.`,
  'Name only companies you are confident exist and sell to the customers described. Fewer is better than invented.',
].join('\n');

function describe(input: SuggestInput): string {
  const lines = [
    `The business sells ${listed(input.offering)} to ${listed(input.trade)} firms in ${listed(input.region)}.`,
    'Who does it compete with?',
  ];
  if (input.exclude.length) lines.push(`Do not name: ${input.exclude.join(', ')}.`);
  return lines.join('\n');
}

export type SuggestOptions = { apiKey: string | null | undefined; fetch?: typeof globalThis.fetch; model?: string; timeoutMs?: number };

/** One call to the small model: the names it answers, or null on no key and on any failure. */
export async function suggestRivals(input: SuggestInput, { apiKey, fetch = globalThis.fetch, model = SUGGEST_MODEL, timeoutMs = SUGGEST_TIMEOUT_MS }: SuggestOptions): Promise<string[] | null> {
  const key = apiKey?.trim();
  if (!key) return null;
  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 120,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: describe(input) },
        ],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
    return readRivals(body?.choices?.[0]?.message?.content, input.exclude);
  } catch {
    return null;
  }
}

export type Suggester = (input: SuggestInput) => Promise<string[] | null>;

/** The suggester when OPENROUTER_API_KEY is set, and null otherwise: then no guess is ever shown. */
export function suggesterFromEnv(env: Record<string, string | undefined>): Suggester | null {
  const apiKey = env.OPENROUTER_API_KEY?.trim();
  return apiKey ? (input) => suggestRivals(input, { apiKey }) : null;
}

// The mask (PRD 812, decision 10): every token-shaped string is masked before anything is sent to Jev.
// The rules are the kit's (kit/lib/openrouter.ts › maskSecrets), ported here so Galaxy's server code
// does not load the kit's OpenRouter client; mask.test.ts holds the two to the same output. GitHub
// tokens, `sk-` keys, AWS key ids and JWTs become `[masked]`, and so does a bearer credential after its
// `Bearer`. Masking twice changes nothing.

export const MASK = '[masked]';

const SECRETS: readonly RegExp[] = Object.freeze([
  /\bgh[pousr]_[A-Za-z0-9]{16,}/g,
  /\bgithub_pat_[A-Za-z0-9_]{16,}/g,
  /\bsk-[A-Za-z0-9_-]{16,}/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\beyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]*/g,
]);
const BEARER = /\b(Bearer)\s+[A-Za-z0-9\-._~+/]+=*/gi;

/** `text` with every token-shaped string replaced by `[masked]`. */
export function maskSecrets(text: string | null | undefined): string {
  let out = String(text ?? '');
  for (const pattern of SECRETS) out = out.replace(pattern, MASK);
  return out.replace(BEARER, `$1 ${MASK}`);
}

/** A state as Jev is given it, every string inside masked; keys, numbers and booleans kept. */
export function maskState<T>(value: T): T {
  if (typeof value === 'string') return maskSecrets(value) as T;
  if (Array.isArray(value)) return value.map((v) => maskState(v)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, maskState(v)])) as T;
  }
  return value;
}

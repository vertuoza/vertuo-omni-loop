import { z } from 'zod';
import { SUGGEST_MODEL } from '../suggest';
import { maxValue, type ClaimKind } from '../model';
import type { OpenRouterEnv } from '../../env';
import type { Candidate } from './verify';
import { propertyOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';

// The extraction of a draft (PRD 774, spec step 2): one call per source to the small model already
// used for suggested rivals (../suggest.ts, through OpenRouter), which answers candidate claims of the
// five kinds (decision 7), each with the words of the source that say it. Never lines are not among
// them (PRD 871): a product's Never list is its constituents, typed by an owner, never proposed, so a
// `never` answer is an unknown kind and dropped. Nothing here trusts the
// model: ./verify.ts keeps only the candidates whose quote is really in the source, and a value that is
// not 1 to 80 characters on one line is dropped here. No key, a non-ok answer, an unparseable reply, a
// timeout or a throw give no candidate, never an error. Pure apart from the one fetch, which a test stubs.

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const EXTRACT_TIMEOUT_MS = 30_000;
/** The most characters of one source the model reads; the quote check still reads all of it. */
const MAX_SOURCE_CHARS = 24_000;
/** The most candidates kept from one source. */
const MAX_CANDIDATES = 20;
const KINDS = ['region', 'offering', 'size', 'trade', 'rival'] as const satisfies readonly ClaimKind[];

const Answer = z.array(z.looseObject({ kind: z.string(), value: z.string(), quote: z.string() }));

const SYSTEM = [
  'You read one document of a software company and find what it says about the company\'s business.',
  'Answer a JSON array and nothing else. Each item is {"kind", "value", "quote"}:',
  '- kind: one of "region" (a country or region it sells in), "offering" (what kind of product it sells, in two or three words, such as ERP or CRM),',
  '  "size" (how many people work at its customers, as <min>-<max>, such as 2-50), "trade" (its customers\' industry, such as construction), "rival" (a company it competes with);',
  '- value: the answer, 1 to 80 characters;',
  '- quote: the exact words of the document that say it, copied character for character, at most 300 characters.',
  'Only what the document states. When it states nothing of the kind, leave the kind out. An empty array is a fine answer.',
].join('\n');

const oneLine = (value: string, kind: ClaimKind) => {
  const v = value.trim();
  return v.length >= 1 && v.length <= maxValue(kind) && !/[\r\n\t]/.test(v) ? v : null;
};

/** The model's reply as candidates: the JSON array it holds (fenced or not), each item of a known kind
 * with a one-line value and a quote. Anything else is dropped; no array at all is none. */
export function readCandidates(reply: unknown): Candidate[] {
  if (typeof reply !== 'string') return [];
  const from = reply.indexOf('[');
  const to = reply.lastIndexOf(']');
  if (from < 0 || to <= from) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(reply.slice(from, to + 1));
  } catch {
    return [];
  }
  const items = Answer.safeParse(parsed);
  if (!items.success) return [];
  const found: Candidate[] = [];
  for (const item of items.data) {
    const kind = KINDS.find((k) => k === item.kind.trim().toLowerCase());
    const value = kind ? oneLine(item.value, kind) : null;
    const quote = item.quote.trim();
    if (!kind || !value || !quote) continue;
    found.push({ kind, value, quote });
    if (found.length === MAX_CANDIDATES) break;
  }
  return found;
}

export type ExtractOptions = { apiKey: string | null | undefined; fetch?: typeof globalThis.fetch; model?: string; timeoutMs?: number };

/** One call to the small model on one source's text: its candidates, or none on no key and any failure. */
export async function extractCandidates(text: string, where: string, { apiKey, fetch = globalThis.fetch, model = SUGGEST_MODEL, timeoutMs = EXTRACT_TIMEOUT_MS }: ExtractOptions): Promise<Candidate[]> {
  const key = apiKey?.trim();
  if (!key || !text.trim()) return [];
  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 1500,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: `Document: ${where}\n\n${text.slice(0, MAX_SOURCE_CHARS)}` },
        ],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return [];
    const body: unknown = await response.json();
    const message = propertyOf(propertyOf(propertyOf(body, 'choices'), '0'), 'message');
    return readCandidates(propertyOf(message, 'content'));
  } catch {
    return [];
  }
}

export type Extractor = (text: string, where: string) => Promise<Candidate[]>;

/** The extractor when OPENROUTER_API_KEY is set, and null otherwise: then a draft finds nothing. */
export function extractorFromEnv(openrouter: OpenRouterEnv | null): Extractor | null {
  return openrouter ? (text, where) => extractCandidates(text, where, { apiKey: openrouter.key }) : null;
}

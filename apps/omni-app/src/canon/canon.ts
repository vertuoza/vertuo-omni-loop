// @ts-nocheck
// The canon gate (PRD 839): the inbox check's fifth gate. A phase-0 PR's `spec.md` and the business of
// its repository in, one gate out:
//
//   red      "canon ✗ N"                — the spec breaks a Never line, or designs for a customer outside
//                                         the size, trade or region claims; each break names its claims,
//                                         quotes the spec, and one persona says it in a line
//   green    "canon ✓ · N claims read"
//   neutral  one line saying why         — no business, no confirmed claim for the repository's product,
//                                         no model key, a model error. Never red on its own failure.
//
// One model call per evaluation, the spec capped at CANON_SPEC_LIMIT characters. A finding is kept only
// when its quote is in the spec word for word (whitespace and case aside, as PRD 774's receipts) and it
// cites a claim the business holds. The verdict is cached by the repository, the spec's hash and the
// claims' latest update, so a re-run with nothing changed asks nothing.
//
// Its two ports are injected: `readBusiness(repo)` (the service-role read `business_for_repo_app`, or
// `null` when the App cannot read businesses) and `ask(request)` (the kit's OpenRouter client, bound to
// its key and model). ./live.ts binds them to the environment.
import { createHash } from 'node:crypto';
import { NO_KEY } from 'vertuo-omni-plan/kit/lib/openrouter.ts';

export const CANON_GATE = 'canon';
/** The most characters of the spec the model reads; the quote check still reads all of it. */
export const CANON_SPEC_LIMIT = 40_000;
/** The longest quote a finding may carry, as a receipt's. */
const MAX_QUOTE = 300;
/** Verdicts kept in the cache, oldest dropped first. */
const CACHE_LIMIT = 200;

const plain = (text) => String(text ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

/** Whether `quote` appears in `text`, whitespace and case aside. */
export function quoted(text, quote) {
  const q = plain(quote);
  return q.length > 0 && plain(text).includes(q);
}

const SYSTEM = [
  "You check a product spec against the product's canon: the business claims its team confirmed, and its personas.",
  'Report a finding only when the spec breaks a Never line, or designs for a customer outside the size, trade or region claims.',
  'Answer one JSON object and nothing else: {"findings": [{"quote", "claims", "why"}], "persona": {"name", "line"}}.',
  '- quote: the exact words of the spec that break the claim, copied character for character, at most 300 characters.',
  '- claims: the ids of the claims it breaks, exactly as given (e.g. "never#4").',
  '- why: one short sentence.',
  '- persona: of the personas given, the one the spec fits worst, by name, and one line in their own voice about the spec, at most 200 characters. Empty name and line when there is no persona.',
  'No finding when the spec fits: "findings": [].',
].join('\n');

const SCHEMA = Object.freeze({
  name: 'canon_findings',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['findings', 'persona'],
    properties: {
      findings: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['quote', 'claims', 'why'],
          properties: { quote: { type: 'string' }, claims: { type: 'array', items: { type: 'string' } }, why: { type: 'string' } },
        },
      },
      persona: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'line'],
        properties: { name: { type: 'string' }, line: { type: 'string' } },
      },
    },
  },
});

/** The model's reply, checked for its shape: `{ errors, reply }`, as the kit's client expects. */
function checkReply(value) {
  if (!value || typeof value !== 'object') return { errors: ['the reply must be one JSON object'], reply: null };
  if (!Array.isArray(value.findings)) return { errors: ['findings: an array'], reply: null };
  const errors = value.findings
    .map((item, i) => (isFinding(item) ? null : `findings.${i}: {"quote": string, "claims": string[], "why": string}`))
    .filter(Boolean);
  if (errors.length > 0) return { errors, reply: null };
  const findings = value.findings.map((item) => ({ quote: item.quote.trim(), claims: item.claims.map((id) => id.trim()), why: text(item.why) }));
  const persona = value.persona ?? {};
  return { errors, reply: { findings, persona: { name: text(persona.name), line: text(persona.line) } } };
}

const text = (value) => String(value ?? '').trim();

function isFinding(item) {
  return Boolean(item) && typeof item.quote === 'string' && Array.isArray(item.claims) && item.claims.every((id) => typeof id === 'string');
}

function userPrompt({ spec, claims, personas }) {
  const claimLines = claims.map((claim) => `${claim.id}: ${claim.kind} — ${claim.value}`);
  const personaLines = personas.length
    ? personas.map((p) => `${p.name}: ${[p.who, p.trade, p.stance, p.usage].filter(Boolean).join('; ')}`)
    : ['(none)'];
  return [
    'Claims (confirmed):',
    ...claimLines,
    '',
    'Personas:',
    ...personaLines,
    '',
    'The spec:',
    '"""',
    spec.slice(0, CANON_SPEC_LIMIT),
    '"""',
  ].join('\n');
}

/** The gate when it cannot judge: ok, neutral, with one line saying why. */
export const neutral = (reason) => ({
  name: CANON_GATE,
  ok: true,
  neutral: true,
  reason,
  details: [],
  canon: { state: 'neutral', reason, claimsRead: 0, findings: [], persona: null },
});

/** The findings the spec and the business prove, and the persona the model named, if it is one. */
function kept({ spec, reply, claims, personas }) {
  const ids = new Set(claims.map((claim) => claim.id));
  const findings = [];
  for (const finding of reply.findings) {
    if (finding.quote.length > MAX_QUOTE || !quoted(spec, finding.quote)) continue;
    const cited = [...new Set(finding.claims.filter((id) => ids.has(id)))];
    if (cited.length === 0) continue;
    findings.push({ quote: finding.quote, claims: cited, why: finding.why });
  }
  const named = personas.find((p) => plain(p.name) === plain(reply.persona.name));
  const persona = named && reply.persona.line ? { name: named.name, line: reply.persona.line.slice(0, 200) } : null;
  return { findings, persona };
}

function judged({ claims, findings, persona }) {
  const claimsRead = claims.length;
  if (findings.length === 0) {
    const reason = `canon ✓ · ${claimsRead} claim${claimsRead === 1 ? '' : 's'} read`;
    return { name: CANON_GATE, ok: true, neutral: false, reason, details: [], canon: { state: 'green', reason, claimsRead, findings, persona } };
  }
  const reason = `canon ✗ ${findings.length}`;
  const values = new Map(claims.map((claim) => [claim.id, claim.value]));
  const details = findings.map(
    (finding) => `${finding.claims.map((id) => `${id} "${values.get(id)}"`).join(', ')} — the spec: "${finding.quote}"`,
  );
  if (persona) details.push(`${persona.name}: "${persona.line}"`);
  return { name: CANON_GATE, ok: false, neutral: false, title: reason, reason, details, canon: { state: 'red', reason, claimsRead, findings, persona } };
}

/** The repository's business, its claims and personas; or `{ gate }`, neutral, when there is none to judge by. */
async function canonOf(readBusiness, repo) {
  let business;
  try {
    business = await readBusiness(repo);
  } catch (error) {
    return { gate: neutral(`no business: the read failed (${error?.message ?? error})`) };
  }
  if (!business) return { gate: neutral('no business: the App cannot read businesses here') };
  if (!business.business) return { gate: neutral(`no business: no workspace tracking ${repo} has one`) };
  const claims = business.claims ?? [];
  if (claims.length === 0) return { gate: neutral("no confirmed claim for this repository's product") };
  return { business, claims, personas: business.personas ?? [] };
}

/**
 * @param {{
 *   readBusiness:(repo: string) => Promise<object | null>,
 *   ask: (request: { system: string, user: string, check: Function, schema: object }) =>
 *     Promise<{ ok: boolean, error: string | null, reply: unknown, reason: string | null }>,
 *   cache?: Map<string, object>,
 *   limit?: number,
 * }} ports
 */
export function createCanon({ readBusiness, ask, cache = new Map(), limit = CACHE_LIMIT }) {
  return {
    /** @param {{ repo: string, spec: string }} input */
    async grade({ repo, spec }) {
      const read = await canonOf(readBusiness, repo);
      if (read.gate) return read.gate;
      const { business, claims, personas } = read;

      const key = [repo, createHash('sha256').update(spec).digest('hex'), business.updatedAt ?? ''].join('\n');
      const hit = cache.get(key);
      if (hit) return hit;

      const answer = await ask({ system: SYSTEM, user: userPrompt({ spec, claims, personas }), check: checkReply, schema: SCHEMA });
      if (!answer.ok) {
        return neutral(answer.error === NO_KEY ? `model not configured (${answer.reason})` : `model error: ${answer.reason}`);
      }
      const gate = judged({ claims, ...kept({ spec, reply: answer.reply, claims, personas }) });
      cache.set(key, gate);
      while (cache.size > limit) cache.delete(cache.keys().next().value);
      return gate;
    },
  };
}

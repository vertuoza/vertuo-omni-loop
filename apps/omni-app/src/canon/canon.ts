// The canon gate (PRD 839, constituents PRD 871): the inbox check's fifth gate. A phase-0 PR's `spec.md`,
// the business of its repository and its product's constituents in, one gate out:
//
//   red      "canon ✗ N"                — the spec breaks the Statement or a Never line, or designs for a
//                                         customer outside the size, trade or region claims; each break
//                                         names what it breaks, quotes the spec, and one persona says it
//   green    "canon ✓ · N claims read"  (", M constituents" when the product has some)
//   neutral  one line saying why         — no business, neither a confirmed claim nor a constituent, no
//                                         model key, a model error, a judge or Jev failure. Never red on
//                                         its own failure.
//
// One model call per evaluation, the spec capped at CANON_SPEC_LIMIT characters. A finding is kept only
// when its quote is in the spec word for word (whitespace and case aside, as PRD 774's receipts) and it
// cites a claim the business holds, a live `never#<n>` or the `statement`. The model's verdict is cached
// by the repository, the spec's hash, the claims' latest update and the constituents' latest event id,
// so a re-run with nothing changed asks the model nothing, and any constituent change re-judges.
//
// When the product has constituents, whether they are broken is the `constituent-break` Jev decision's
// to say, asked on every evaluation through galaxy's App-signed judge route, where the workspace's mode
// lives: Off and Shadow answer the model's own verdict (Shadow logs Jev's beside it), On answers Jev's
// when it is at or above the floor. Jev says only broken or not: when it says not, the constituents'
// citations leave the findings; when it says broken, the findings that quote the spec stay, and with
// none the check is not red, since a red check must name a quote.
//
// Its four ports are injected: `readBusiness(repo)` (the service-role read `business_for_repo_app`, or
// `null` when the App cannot read businesses), `readConstituents(repo)` (the service-role read
// `constituents_for_repo_app`), `judge(request)` (./judge.ts, the signed call to galaxy's judge route)
// and `ask(request)` (the kit's OpenRouter client, bound to its key and model). ./live.ts binds them.
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { NO_KEY } from 'vertuo-omni-plan/kit/lib/openrouter.ts';
import { type Business, type Claim, type Constituent, type Constituents, FindingSchema, type Persona, ReplyPersonaSchema } from './schema.ts';

/** A break the gate keeps: the spec's words, the claims they break, and why. */
export type Finding = { quote: string; claims: string[]; why: string };

/** The persona the spec fits worst, in one line of their own voice. */
export type PersonaLine = { name: string; line: string };

/** Who decided a constituents verdict (`jev`, or `old` for the model's own), and how sure Jev was. */
export type JudgeFacts = { decidedBy: string | null; confidence: number | null };

/** The canon facts a verdict carries, for the check run and its buttons. */
export type CanonFacts = {
  state: 'green' | 'red' | 'neutral';
  reason: string;
  claimsRead: number;
  findings: Finding[];
  persona: PersonaLine | null;
  judge: JudgeFacts | null;
};

/** The canon gate, as the inbox check shows it. */
export type CanonGate = {
  name: typeof CANON_GATE;
  ok: boolean;
  neutral: boolean;
  title?: string;
  reason: string;
  details: string[];
  canon: CanonFacts;
};

/** The model's kept findings and persona, cached by the spec, the claims and the constituents. */
type Verdict = { findings: Finding[]; persona: PersonaLine | null };

/** The business read: `null` when the App cannot read businesses here. */
export type ReadBusiness = (repo: string) => Promise<Business | null>;
/** The constituents read: `null` when the product has none to read. */
export type ReadConstituents = (repo: string) => Promise<Constituents | null>;

/** What galaxy's judge route reads as `constituent-break`'s state. */
export type JudgeState = {
  spec: string;
  statement: string | null;
  never: Constituent[];
  verdict: { broken: boolean; findings: { quote: string; constituents: string[]; why: string }[] };
};

/** One call to the judge: the verdict that counts, or why there is none. */
export type JudgeRequest = { repo: string; state: JudgeState; old: 'true' | 'false'; ref: string | null };
export type JudgeAnswer = {
  ok: boolean;
  error: string | null;
  answer: string | null;
  confidence: number | null;
  decidedBy: string | null;
  reason: string | null;
};
export type Judge = (request: JudgeRequest) => Promise<JudgeAnswer>;

/**
 * The model's reply, once `checkReply` checked it and trimmed its words: the reply the kit's client
 * answers is read through it, so the verdict is built from what it says it is.
 */
const CheckedReplySchema = z.object({
  findings: z.array(z.object({ quote: z.string(), claims: z.array(z.string()), why: z.string() })),
  persona: z.object({ name: z.string(), line: z.string() }),
});
type Reply = z.infer<typeof CheckedReplySchema>;

/** What the check of a reply answers the kit's client: its errors, or the reply. */
type Checked = { errors: string[]; reply: Reply | null };

/** One call to the model, as the kit's client answers it. */
export type Ask = (request: { system: string; user: string; check: (value: unknown) => Checked; schema: typeof SCHEMA }) => Promise<{
  ok: boolean;
  error: string | null;
  reply: unknown;
  reason: string | null;
}>;

export const CANON_GATE = 'canon';
/** The most characters of the spec the model reads; the quote check still reads all of it. */
export const CANON_SPEC_LIMIT = 40_000;
/** The longest quote a finding may carry, as a receipt's. */
const MAX_QUOTE = 300;
/** Verdicts kept in the cache, oldest dropped first. */
const CACHE_LIMIT = 200;
/** The judge's error when it has no secret to sign with: the gate says "not configured". */
export const JUDGE_NOT_CONFIGURED = 'no-secret';

const plain = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

/** Whether `quote` appears in `text`, whitespace and case aside. */
export function quoted(text: string | null | undefined, quote: string | null | undefined): boolean {
  const q = plain(quote);
  return q.length > 0 && plain(text).includes(q);
}

const SYSTEM = [
  "You check a product spec against the product's canon: its Statement (what the product is), its Never lines (what it must never become or do), the business claims its team confirmed, and its personas.",
  'Report a finding only when the spec designs something that is not the product the Statement describes, breaks a Never line, or designs for a customer outside the size, trade or region claims.',
  'Answer one JSON object and nothing else: {"findings": [{"quote", "claims", "why"}], "persona": {"name", "line"}}.',
  '- quote: the exact words of the spec that break the claim, copied character for character, at most 300 characters.',
  '- claims: the ids of what it breaks, exactly as given (e.g. "statement", "never#4", "size#1").',
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
function checkReply(value: unknown): Checked {
  if (!value || typeof value !== 'object') return { errors: ['the reply must be one JSON object'], reply: null };
  const items: unknown = 'findings' in value ? value.findings : undefined;
  if (!Array.isArray(items)) return { errors: ['findings: an array'], reply: null };
  const parsed = items.map((item) => FindingSchema.safeParse(item));
  const errors = parsed.flatMap((result, i) => (result.success ? [] : [`findings.${i}: {"quote": string, "claims": string[], "why": string}`]));
  if (errors.length > 0) return { errors, reply: null };
  const findings = parsed.flatMap((result) =>
    result.success ? [{ quote: result.data.quote.trim(), claims: result.data.claims.map((id) => id.trim()), why: text(result.data.why) }] : [],
  );
  const persona = ReplyPersonaSchema.safeParse('persona' in value ? (value.persona ?? {}) : {});
  const { name, line } = persona.success ? persona.data : {};
  return { errors, reply: { findings, persona: { name: text(name), line: text(line) } } };
}

/** Whatever the model wrote, as `String` prints it, trimmed: nothing for null and undefined. */
const text = (value: unknown) => (value === undefined || value === null ? '' : stringOf(value)).trim();

/** Any value, as `String` prints it. */
export const stringOf = (value: unknown) => String(value);

/** What a thrown value says: its `message`, when it has one. */
export const thrownMessage = (error: unknown): unknown =>
  error !== null && typeof error === 'object' && 'message' in error ? error.message : undefined;

function userPrompt({ spec, claims, constituents, personas }: { spec: string; claims: Claim[]; constituents: Constituent[]; personas: Persona[] }): string {
  const constituentLines = constituents.length ? constituents.map((c) => `${c.id}: ${c.text}`) : ['(none)'];
  const claimLines = claims.length ? claims.map((claim) => `${claim.id}: ${claim.kind} — ${claim.value}`) : ['(none)'];
  const personaLines = personas.length
    ? personas.map((p) => `${p.name}: ${[p.who, p.trade, p.stance, p.usage].filter(Boolean).join('; ')}`)
    : ['(none)'];
  return [
    'Constituents (the Statement and the Never lines):',
    ...constituentLines,
    '',
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
export const neutral = (reason: string): CanonGate => ({
  name: CANON_GATE,
  ok: true,
  neutral: true,
  reason,
  details: [],
  canon: { state: 'neutral', reason, claimsRead: 0, findings: [], persona: null, judge: null },
});

/** The findings the spec, the business and the live constituents prove, and the persona named, if it is one. */
function kept({ spec, reply, claims, constituents, personas }: {
  spec: string;
  reply: Reply;
  claims: Claim[];
  constituents: Constituent[];
  personas: Persona[];
}): Verdict {
  const ids = new Set([...claims.map((claim) => claim.id), ...constituents.map((c) => c.id)]);
  const findings: Finding[] = [];
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

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function judged({ claims, constituents, findings, persona, judge }: {
  claims: Claim[];
  constituents: Constituent[];
  findings: Finding[];
  persona: PersonaLine | null;
  judge: JudgeFacts | null;
}): CanonGate {
  const claimsRead = claims.length;
  if (findings.length === 0) {
    const read = constituents.length ? `${plural(claimsRead, 'claim')}, ${plural(constituents.length, 'constituent')}` : plural(claimsRead, 'claim');
    const reason = `canon ✓ · ${read} read`;
    return { name: CANON_GATE, ok: true, neutral: false, reason, details: [], canon: { state: 'green', reason, claimsRead, findings, persona, judge } };
  }
  const reason = `canon ✗ ${findings.length}`;
  const values = new Map<string, string | null | undefined>([
    ...claims.map((claim) => [claim.id, claim.value] as const),
    ...constituents.map((c) => [c.id, c.text] as const),
  ]);
  const details = findings.map(
    (finding) => `${finding.claims.map((id) => `${id} "${values.get(id)}"`).join(', ')} — the spec: "${finding.quote}"`,
  );
  if (persona) details.push(`${persona.name}: "${persona.line}"`);
  if (judge?.decidedBy === 'jev') details.push(`judged by Jev (constituent-break, confidence ${judge.confidence})`);
  return { name: CANON_GATE, ok: false, neutral: false, title: reason, reason, details, canon: { state: 'red', reason, claimsRead, findings, persona, judge } };
}

/** The live Statement and Never lines of a constituents read, each `{ id, text }`. */
function liveConstituents(read: Constituents | null): Constituent[] {
  if (read?.state !== 'ok') return [];
  return [...(read.statement ? [read.statement] : []), ...(read.never ?? [])]
    .filter((c) => c.text.trim())
    .map((c) => ({ id: c.id, text: c.text.trim() }));
}

/** What the gate judges by, once both reads answered. */
type Canon = { business: Business; claims: Claim[]; personas: Persona[]; constituents: Constituent[]; version: string };

/**
 * The repository's business, its claims, personas and constituents; or `{ gate }`, neutral, when there
 * is nothing to judge by or a read failed.
 */
async function canonOf(
  { readBusiness, readConstituents }: { readBusiness: ReadBusiness; readConstituents: ReadConstituents },
  repo: string,
): Promise<{ gate: CanonGate } | ({ gate?: undefined } & Canon)> {
  const business = await attempt(() => readBusiness(repo), 'no business');
  if (business.gate) return business;
  if (!business.value) return { gate: neutral('no business: the App cannot read businesses here') };
  const read = await attempt(() => readConstituents(repo), 'no constituents');
  if (read.gate) return read;
  return enough(repo, business.value, read.value);
}

/** One read's value, or `{ gate }`, neutral, naming what failed. */
async function attempt<T>(read: () => Promise<T>, what: string): Promise<{ gate: CanonGate } | { gate?: undefined; value: T }> {
  try {
    return { value: await read() };
  } catch (error) {
    return { gate: neutral(`${what}: the read failed (${String(thrownMessage(error) ?? error)})`) };
  }
}

/** What the gate judges by, or `{ gate }`, neutral, when there is neither a claim nor a constituent. */
function enough(repo: string, business: Business, read: Constituents | null): { gate: CanonGate } | ({ gate?: undefined } & Canon) {
  const constituents = liveConstituents(read);
  const claims = business.claims ?? [];
  if (constituents.length === 0 && !business.business) return { gate: neutral(`no business: no workspace tracking ${repo} has one`) };
  if (constituents.length === 0 && claims.length === 0) {
    return { gate: neutral("no confirmed claim or constituent for this repository's product") };
  }
  return { business, claims, personas: business.personas ?? [], constituents, version: read?.latestEventId ?? '' };
}

const isConstituent = (id: string) => id === 'statement' || /^never#\d+$/.test(id);

/** What the judge route reads as `constituent-break`'s state: the spec, the constituents, today's verdict. */
function judgeState({ spec, constituents, findings }: { spec: string; constituents: Constituent[]; findings: Finding[] }): JudgeState {
  const statement = constituents.find((c) => c.id === 'statement')?.text ?? null;
  const never = constituents.filter((c) => c.id !== 'statement');
  const broken = findings
    .map((f) => ({ quote: f.quote, constituents: f.claims.filter(isConstituent), why: f.why.slice(0, 500) }))
    .filter((f) => f.constituents.length > 0)
    .slice(0, 50);
  return { spec: spec.slice(0, CANON_SPEC_LIMIT), statement, never, verdict: { broken: broken.length > 0, findings: broken } };
}

/** The findings once the answer that counts is known: not broken drops every constituent's citation. */
function counted(findings: Finding[], broken: boolean): Finding[] {
  if (broken) return findings;
  return findings
    .map((f) => ({ ...f, claims: f.claims.filter((id) => !isConstituent(id)) }))
    .filter((f) => f.claims.length > 0);
}

/** A judge that is not wired: the gate is neutral whenever the product has constituents. */
const NO_JUDGE: Judge = () => Promise.resolve({ ok: false, error: JUDGE_NOT_CONFIGURED, answer: null, confidence: null, decidedBy: null, reason: 'no judge here' });

/**
 * The gate on its four ports, with its cache of the model's verdicts. Without `readConstituents` the
 * product has none; without `judge`, constituents are neutral.
 */
export function createCanon({ readBusiness, readConstituents = () => Promise.resolve(null), judge = NO_JUDGE, ask, cache = new Map(), limit = CACHE_LIMIT }: {
  readBusiness: ReadBusiness;
  readConstituents?: ReadConstituents;
  judge?: Judge;
  ask: Ask;
  cache?: Map<string, Verdict>;
  limit?: number;
}) {
  /** The model's kept findings and persona, asked once per spec, claims and constituents; or `{ gate }`. */
  async function modelVerdict({ repo, spec, read }: { repo: string; spec: string; read: Canon }): Promise<{ gate: CanonGate } | ({ gate?: undefined } & Verdict)> {
    const { business, claims, constituents, personas, version } = read;
    const key = [repo, createHash('sha256').update(spec).digest('hex'), business.updatedAt ?? '', version].join('\n');
    const hit = cache.get(key);
    if (hit) return hit;
    const answer = await ask({ system: SYSTEM, user: userPrompt({ spec, claims, constituents, personas }), check: checkReply, schema: SCHEMA });
    if (!answer.ok) {
      return { gate: neutral(answer.error === NO_KEY ? `model not configured (${answer.reason})` : `model error: ${answer.reason}`) };
    }
    const verdict = kept({ spec, reply: CheckedReplySchema.parse(answer.reply), claims, constituents, personas });
    cache.set(key, verdict);
    for (const oldest of cache.keys()) {
      if (cache.size <= limit) break;
      cache.delete(oldest);
    }
    return verdict;
  }

  return {
    async grade({ repo, spec, ref = null }: { repo: string; spec: string; ref?: string | null }): Promise<CanonGate> {
      const read = await canonOf({ readBusiness, readConstituents }, repo);
      if (read.gate) return read.gate;
      const { claims, constituents } = read;

      const verdict = await modelVerdict({ repo, spec, read });
      if (verdict.gate) return verdict.gate;
      if (constituents.length === 0) return judged({ claims, constituents, ...verdict, judge: null });

      const state = judgeState({ spec, constituents, findings: verdict.findings });
      const said = await judge({ repo, state, old: state.verdict.broken ? 'true' : 'false', ref });
      if (!said.ok) {
        return neutral(said.error === JUDGE_NOT_CONFIGURED ? `judge not configured (${said.reason})` : `judge error: ${said.reason}`);
      }
      const findings = counted(verdict.findings, said.answer === 'true');
      return judged({ claims, constituents, findings, persona: verdict.persona, judge: { decidedBy: said.decidedBy, confidence: said.confidence } });
    },
  };
}

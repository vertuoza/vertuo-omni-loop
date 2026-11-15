// The business laws' judge (PRD 2632 s4): one spec against the laws its words point to, read from the law
// home's newest pack, merged laws only. Pure but for the model, which is a port (`ask`), so a test hands it a
// fake and no test calls a model.
//
// - Which laws: the kit's one selection (`selectBusinessLaws`, kit/lib/knowledge/business-laws.ts): the
//   domains of the spec's `areas:`, the domains of each glossary term or avoid word its body uses, every law
//   of those domains, and every `product/` law. No model picks.
// - How: the laws in batches of BATCH (40), one model call each, all at once. A finding counts only when it quotes the
//   spec word for word (whitespace and case aside, as the canon gate does), cites a law of its own batch and
//   says what the design does that the law forbids; anything else is dropped, so it never makes a verdict
//   red. The model is told that a sentence which restates a law, cites it or says how the design keeps it is
//   no finding (bug #2696). A law binds only what the spec designs: a law the design does not touch, a gap in
//   the spec or a sentence saying a law does not apply is no finding, and a why that only names what the spec
//   does not describe is dropped (bug #2815). A why that hedges ("could", "may", "implies", "however", "not
//   explicitly") and a quote from a paragraph or list item that names the law it is judged on are dropped too, and
//   the batches' findings that remain stand only when a second reading of the whole spec confirms each, as a
//   breach it states (bug #2900): one reading never turns a verdict red, and a second reading that fails is
//   neutral.
// - What it answers: `red` with each finding (the law's statement and Why as they are now, the spec's words,
//   what the judge found broken in its own words, who owns the law), `green` with the laws and domains judged, or `neutral` with why, never red on its own
//   failure: no model key, a model error, a reply out of shape.
//
// It keeps nothing: ./verdicts.service.ts keeps what it says, once per spec version and pack commit.
import { selectBusinessLaws, type BusinessLaw, type SelectedDomain, type SelectionTerm } from 'omni-loop/kit/lib/knowledge/business-laws.ts';
import { z } from 'zod';
import { MAX_QUOTE, quoted } from '../business/draft/verify';

/** The most laws one model call judges. */
const BATCH = 40;
/** The most characters of the spec the model reads; the quote check still reads all of it. */
const SPEC_LIMIT = 40_000;

/** The most characters kept of what the judge says a finding breaks. */
const MAX_BROKEN = 300;

/** One break the judge keeps: the law, its words as judged (`why` is the law's own Why), the spec's words,
 * what the judge says the design does that the law forbids (`broken`), and who owns it. */
export type LawFinding = {
  law: string;
  statement: string;
  why: string;
  quote: string;
  broken: string;
  domain: string;
  file: string;
  owners: string[];
};

/** What the judge says of a spec. `laws` are the ids judged; `domains` the domains taken, with why. */
export type LawVerdict = {
  state: 'green' | 'red' | 'neutral';
  reason: string;
  laws: string[];
  domains: SelectedDomain[];
  findings: LawFinding[];
};

/** One call to the model: its reply as parsed JSON, or why there is none. */
export type AskLaws = (request: { system: string; user: string }) => Promise<{ ok: true; reply: unknown } | { ok: false; why: string }>;

/** The reply the model is asked for. */
const Reply = z.object({
  findings: z.array(z.object({ law: z.string(), quote: z.string(), why: z.string().optional() })),
});

/** The reply the second reading is asked for. */
const Confirm = z.object({
  findings: z.array(z.object({ n: z.number(), breaks: z.boolean(), why: z.string().optional() })),
});

const SYSTEM = [
  "You decide whether a product spec breaks any of the product's business laws: rules of the product, each with the reason it exists.",
  'Most specs break none. Your job is to decide, not to find something: when no sentence of the spec designs what a law forbids, answer no finding.',
  'Report a finding only when what the spec designs breaks a law given below, as written, read the way its author meant it. Never report a law that is not given.',
  'A finding is something the spec designs that a law forbids. A sentence that restates a law, cites it, or says how the design keeps it is no finding, even when it uses the words of the law.',
  'A law binds only what the spec designs. When the spec designs nothing a law speaks of, that law has no finding: a law about changes to the knowledge says nothing of a spec that changes only code (a job, a table, a page, a decision).',
  'What the spec does not say is never a finding: a missing detail, case or explanation breaks no law. A sentence that says a law does not apply, and why, is no finding.',
  'What the design might allow, could lead to, implies or could be misread as is never a finding. A finding states, as a fact, what the quoted words make the product do.',
  'Answer one JSON object and nothing else: {"findings": [{"law", "quote", "why"}]}.',
  '- law: the id of the law broken, exactly as given (e.g. "BL-QUOTES-1").',
  `- quote: the exact words of the spec that break it, copied character for character, at most ${MAX_QUOTE} characters.`,
  '- why: one short sentence saying what the design does that the law forbids, stated as a fact, with no "could", "may", "might", "implies" or "however". When you cannot say it, there is no finding. A why about what the spec does not describe, say or explain is no finding.',
  'No finding when the spec breaks none: "findings": [].',
].join('\n');

/** The second reading: each finding of the first, one at a time, kept only when it is a breach as stated. */
const CONFIRM_SYSTEM = [
  "A first reader says a product spec breaks some of the product's business laws. You check each claim, one by one, against the spec as a whole.",
  'A claim stands only when the quoted words, read in the spec around them as their author meant them, design what the law forbids.',
  'It does not stand when the spec elsewhere says how the design keeps the law, when the quote restates or cites the law, when it names something the spec does not say, or when it is about what the design might allow or could be misread as.',
  'When you are not sure, it does not stand.',
  'Answer one JSON object and nothing else: {"findings": [{"n", "breaks", "why"}]}, one entry per claim.',
  '- n: the number of the claim.',
  '- breaks: true only when the claim stands, else false.',
  '- why: one short sentence: what the quoted words make the product do that the law forbids, or why the claim does not stand.',
].join('\n');

/** A why that names the spec's silence (it "does not describe…", "fails to specify…") says nothing the design does
 *  that a law forbids: no finding (bug #2815). A why about what the design does ("nobody is told") is kept. */
const SILENCE = /\b(?:does\s+not|doesn['’]t|never|fails\s+to)\s+(?:describe|design|explain|mention|specify|address|detail|clarify|define|cover)\b|\bspec\s+(?:does\s+not|doesn['’]t|never|fails\s+to)\s+(?:say|state)\b/i;

/** A why that hedges says what the design might do, not what it does: no finding (bug #2900). "could not" is kept,
 *  as a law's own words ("a check that could not decide"). */
const HEDGE = /\b(?:could(?!\s+not\b|n['’]t\b)|might|may|possibly|potentially|perhaps|impl(?:y|ies|ied|ying)|suggests?|seems?|appears?|misread|misinterpret\w*|ambiguous|unclear|however|explicit(?:ly)?)\b/i;

/** Words as a quote is compared: whitespace and case aside. */
const plain = (text: string) => text.replace(/\s+/g, ' ').trim().toLowerCase();

function userPrompt(spec: string, batch: readonly BusinessLaw[]): string {
  return [
    'Business laws:',
    ...batch.map((law) => `${law.id}: ${law.statement}${law.why ? ` Why: ${law.why}` : ''}`),
    '',
    'The spec:',
    '"""',
    spec.slice(0, SPEC_LIMIT),
    '"""',
  ].join('\n');
}

function confirmPrompt(spec: string, findings: readonly LawFinding[]): string {
  return [
    'Claims:',
    ...findings.map((finding, at) => `${at + 1}. ${finding.law}: ${finding.statement}${finding.why ? ` Why: ${finding.why}` : ''}\n   Quote: "${finding.quote}"\n   Claim: ${finding.broken}`),
    '',
    'The spec:',
    '"""',
    spec.slice(0, SPEC_LIMIT),
    '"""',
  ].join('\n');
}

/** The laws `laws` holds in batches of `size`, in order. */
export function batchesOf<T>(laws: readonly T[], size: number = BATCH): T[][] {
  const batches: T[][] = [];
  for (let at = 0; at < laws.length; at += size) batches.push(laws.slice(at, at + size));
  return batches;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The verdict when the spec could not be judged. */
const notJudged =(reason: string, laws: string[] = [], domains: SelectedDomain[] = []): LawVerdict => ({ state: 'neutral', reason, laws, domains, findings: [] });

/** A why that states a breach: not empty, not about the spec's silence, not hedged. */
const states = (why: string) => why !== '' && !SILENCE.test(why) && !HEDGE.test(why);

/** The spec's blocks: its paragraphs and its list items, each as its words are compared. */
function blocksOf(spec: string): string[] {
  return spec.split(/\n\s*\n|\n(?=\s*(?:[-*+]|\d+[.)])\s)/).map(plain).filter((block) => block !== '');
}

/** The quote sits in a paragraph or a list item that names the law it is judged on: the spec saying how it keeps
 *  that law, no finding (bug #2900). A quote across two blocks is not. */
function citesLaw(spec: string, quote: string, law: string): boolean {
  const words = plain(quote);
  const id = law.toLowerCase();
  const names = (block: string) => block.split(/[^a-z0-9-]+/).includes(id);
  return blocksOf(spec).some((block) => block.includes(words) && names(block));
}

/** The findings of one batch's reply the spec and the batch prove. */
function keptFindings(spec: string, reply: z.infer<typeof Reply>, batch: readonly BusinessLaw[], owners: readonly string[]): LawFinding[] {
  const laws = new Map(batch.map((law) => [law.id, law]));
  return reply.findings.flatMap((finding) => {
    const law = laws.get(finding.law.trim());
    const quote = finding.quote.trim();
    const broken = (finding.why ?? '').trim().slice(0, MAX_BROKEN);
    if (!law || !states(broken) || quote.length > MAX_QUOTE || !quoted(spec, quote) || citesLaw(spec, quote, law.id)) return [];
    return [{ law: law.id, statement: law.statement, why: law.why ?? '', quote, broken, domain: law.domain, file: law.file, owners: [...owners] }];
  });
}

/** Each finding once: the first of a law and a quote. */
function once(findings: readonly LawFinding[]): LawFinding[] {
  const seen = new Set<string>();
  return findings.filter((finding) => {
    const key = `${finding.law}\n${plain(finding.quote)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Judges `spec` against the business laws of the law home (`laws`, every law of the pack), as the glossary
 * points to them. `ask` null: no model key, the verdict is neutral. `owners` are the logins that own the
 * laws (the law home's `laws.owners`), carried by every finding.
 */
export async function judgeSpec({ spec, laws, glossary, owners, ask }: {
  spec: string;
  laws: readonly BusinessLaw[];
  glossary: readonly SelectionTerm[];
  owners: readonly string[];
  ask: AskLaws | null;
}): Promise<LawVerdict> {
  const selection = selectBusinessLaws({ spec, laws: laws.filter((law) => law.statement !== ''), glossary });
  const judged = selection.laws.map((law) => law.id);
  const { domains } = selection;
  if (judged.length === 0) return { state: 'green', reason: 'no business law applies to this spec', laws: [], domains, findings: [] };
  if (!ask) return notJudged('no model key on this deployment', judged, domains);
  const answers = await Promise.all(batchesOf(selection.laws).map(async (batch) => ({ batch, answer: await ask({ system: SYSTEM, user: userPrompt(spec, batch) }) })));
  const findings: LawFinding[] = [];
  for (const { batch, answer } of answers) {
    if (!answer.ok) return notJudged(`the model did not answer: ${answer.why}`.slice(0, 500), judged, domains);
    const reply = Reply.safeParse(answer.reply);
    if (!reply.success) return notJudged('the model answered out of shape', judged, domains);
    findings.push(...keptFindings(spec, reply.data, batch, owners));
  }
  const candidates = once(findings);
  if (candidates.length === 0) return { state: 'green', reason: `${judged.length} judged`, laws: judged, domains, findings: [] };
  // One reading is not a verdict (bug #2900): a red stands only on the findings a second reading confirms.
  const second = await ask({ system: CONFIRM_SYSTEM, user: confirmPrompt(spec, candidates) });
  if (!second.ok) return notJudged(`the second reading did not answer: ${second.why}`.slice(0, 500), judged, domains);
  const confirm = Confirm.safeParse(second.reply);
  if (!confirm.success) return notJudged('the second reading answered out of shape', judged, domains);
  const stands = new Set(confirm.data.findings.filter((entry) => entry.breaks && states((entry.why ?? '').trim())).map((entry) => entry.n));
  const kept = candidates.filter((_, at) => stands.has(at + 1));
  if (kept.length > 0) return { state: 'red', reason: `${plural(new Set(kept.map((f) => f.law)).size, 'law', 'laws')} broken`, laws: judged, domains, findings: kept };
  return { state: 'green', reason: `${judged.length} judged`, laws: judged, domains, findings: [] };
}

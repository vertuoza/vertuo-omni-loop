/**
 * **What to ask** (PRD #82, slice s3). The harvest asks a model one question per candidate: where
 * does this decision belong in the knowledge base? This module is that question's contract, and
 * nothing else: the prompt, built from the candidate and a summary of the knowledge base, and the
 * schema every reply must pass. The model classifies; code writes — the reply names a kind, a place
 * and the words, never an id to create, a file or a provenance line.
 *
 * The contract is bound to the repository it runs in. A reply may only name:
 *
 * - **a kind the repository has a place for:** `adr` needs the decision-record folder
 *   (`ctx.layout.adrDir`) on disk, `rule` and `invariant` the knowledge folder
 *   (`ctx.layout.knowledgeRoot`). `covered` and `stays-here` need nothing.
 * - **an existing place:** `product`, or a domain folder that exists. The harvest never creates one.
 * - **an existing principle** to serve, of `product` or of the rule's own domain — the same rule
 *   `omni check knowledge` grades — or `new`, with the principle it proposes.
 * - **an existing entry or record** it is covered by.
 *
 * {@link knowledgeSummary} reads what those rules need from the working tree;
 * {@link classificationSchema} binds the reply's schema to it; {@link classificationPrompt} is pure.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { readDecisions } from '../playbook/decisions.ts';
import { plainText } from '../outbox/plain-text.ts';
import { LOOK_RULE } from './look-rule.ts';
import { PRODUCT_CODE, domainsDir, readKnowledge, type EntryKind, type KnowledgeCtx, type KnowledgeEntry } from './registers.ts';

/** A kind a reply may name. */
export type ClassificationKind = 'adr' | 'invariant' | 'rule' | 'covered' | 'stays-here';

/** Every kind a reply may name, in the order the prompt lists them. */
export const CLASSIFICATION_KINDS: readonly ClassificationKind[] = ['adr', 'invariant', 'rule', 'covered', 'stays-here'];

/** Which of the two folders a reply's kinds need sit on disk. */
export type Places = { adr: boolean; knowledge: boolean };

/** What the prompt and the schema need of the knowledge base (see {@link knowledgeSummary}). */
export type KnowledgeSummary = {
  places: Places;
  domains: { name: string; firstLine: string | null }[];
  principles: { id: string; place: string; statement: string }[];
  decisions: { number: string; title: string | null }[];
  laws: { id: string; kind: EntryKind | null; place: string; statement: string }[];
};

/** The sections of a candidate's embedded item the harvest quotes; any of them may be absent. */
export type ItemSections = {
  questionPlain?: string | null;
  decisionPlain?: string | null;
  options?: readonly { letter: string; text: string }[] | null;
  personSteps?: string | null;
  whatIHadToDecide?: string | null;
  whatIDidMeanwhile?: string | null;
  whatItCostsToChangeLater?: string | null;
};

/** What the prompt reads of a candidate (a `harvestCandidates` entry). */
export type PromptCandidate = {
  id: string;
  verdict?: string | null;
  answer?: string | null;
  itemText?: string | null;
  item?: { sections?: ItemSections | null } | null;
};

/** A reply {@link ClassificationSchema} accepted. */
export type ClassificationReply = z.infer<typeof ClassificationSchema>;

/** The place a product-wide entry goes: the `product/` folder. */
export const PRODUCT_PLACE = PRODUCT_CODE.toLowerCase();

/** `serves: new` — the rule proposes the principle it serves. */
export const NEW_PRINCIPLE = 'new';

/** The caps on a reply's words, in characters. */
export const CAPS = Object.freeze({ statement: 300, principle: 300, reason: 200 });

const RECORD_ID = /^ADR-(\d{4})$/;

function capped(field: string, max: number) {
  return z
    .string({ error: (issue) => (issue.input === undefined ? `${field} is required` : `${field} must be text`) })
    .trim()
    .min(1, `${field} is required`)
    .max(max, `${field} is over its cap of ${max} characters`);
}

const text = (field: string) =>
  z.string({ error: (issue) => (issue.input === undefined ? `${field} is required` : `${field} must be text`) }).trim().min(1, `${field} is required`);

const statement = capped('statement', CAPS.statement);
const reason = capped('reason', CAPS.reason);

/**
 * The reply's shape, one strict object per kind, with the field table of the spec and nothing
 * more: a field the kind does not carry is refused, like one it is missing. Context-free: whether a
 * place, a principle or a covered entry exists is {@link classificationSchema}'s call.
 */
export const ClassificationSchema = z
  .discriminatedUnion(
    'kind',
    [
      z
        .object({
          kind: z.literal('adr'),
          title: text('title').refine((value) => !value.includes('\n'), 'title must be one line'),
          statement,
          reason,
        })
        .strict(),
      z.object({ kind: z.literal('invariant'), place: text('place'), statement, reason }).strict(),
      z
        .object({
          kind: z.literal('rule'),
          place: text('place'),
          statement,
          serves: text('serves'),
          principle: z
            .object({ statement: capped('principle.statement', CAPS.principle), why: capped('principle.why', CAPS.principle) })
            .strict()
            .optional(),
          reason,
        })
        .strict(),
      z.object({ kind: z.literal('covered'), covers: text('covers'), reason }).strict(),
      z.object({ kind: z.literal('stays-here'), statement, reason }).strict(),
    ],
    { error: () => `kind must be one of: ${CLASSIFICATION_KINDS.join(', ')}` },
  )
  .superRefine((reply, context) => {
    if (reply.kind !== 'rule') return;
    if (reply.serves === NEW_PRINCIPLE && !reply.principle) {
      context.addIssue({ code: 'custom', path: ['principle'], message: `serves "${NEW_PRINCIPLE}" needs the principle it proposes` });
    }
    if (reply.serves !== NEW_PRINCIPLE && reply.principle) {
      context.addIssue({ code: 'custom', path: ['principle'], message: `a principle is proposed only with serves "${NEW_PRINCIPLE}"` });
    }
  });

/** The first non-blank line of a text, as written; `null` when there is none. */
function firstLine(value: string): string | null {
  return value.split('\n').find((line) => line.trim().length > 0)?.trim() ?? null;
}

/**
 * What the prompt and the schema need of the knowledge base, read from the working tree:
 *
 * `{ places: { adr, knowledge }, domains: [{ name, firstLine }], principles: [{ id, place,
 * statement }], decisions: [{ number, title }], laws: [{ id, kind, place, statement }] }`.
 *
 * `laws` are the rules and invariants of `product/` and the domains; cross-domain entries are left
 * out, as the harvest never writes one.
 */
export function knowledgeSummary({ ctx }: { ctx: KnowledgeCtx & { layout: { adrDir: string } } }): KnowledgeSummary {
  const places = {
    adr: existsSync(join(ctx.root, ctx.layout.adrDir)),
    knowledge: existsSync(join(ctx.root, ctx.layout.knowledgeRoot)),
  };
  const knowledge = readKnowledge({ ctx });
  const placeOf = (entry: KnowledgeEntry) => (entry.scope === 'product' ? PRODUCT_PLACE : entry.domain);
  const domains = knowledge.domains.map((domain) => {
    const readme = join(ctx.root, domainsDir(ctx), domain.name, 'README.md');
    return { name: domain.name, firstLine: existsSync(readme) ? firstLine(readFileSync(readme, 'utf8')) : null };
  });
  const principles = knowledge.entries
    .filter((entry) => entry.kind === 'principle' && entry.scope !== 'cross-domain')
    .map((entry) => ({ id: entry.id, place: placeOf(entry), statement: entry.statement }));
  const laws = knowledge.entries
    .filter((entry) => (entry.kind === 'rule' || entry.kind === 'invariant') && entry.scope !== 'cross-domain')
    .map((entry) => ({ id: entry.id, kind: entry.kind, place: placeOf(entry), statement: entry.statement }));
  const decisions = places.adr
    ? readDecisions({ ctx }).records.map((record) => ({ number: record.number, title: record.title }))
    : [];
  return { places, domains, principles, decisions, laws };
}

/** The kinds a repository with `places` has room for, in {@link CLASSIFICATION_KINDS}' order. */
export function allowedKinds(places: Places): ClassificationKind[] {
  return CLASSIFICATION_KINDS.filter((kind) => {
    if (kind === 'adr') return places.adr;
    if (kind === 'rule' || kind === 'invariant') return places.knowledge;
    return true;
  });
}

/** Every place a rule or an invariant may name: `product`, then the domains. */
export function placesOf(summary: Pick<KnowledgeSummary, 'domains'>): string[] {
  return [PRODUCT_PLACE, ...summary.domains.map((domain) => domain.name)];
}

/**
 * The reply's schema bound to one repository's knowledge base (a {@link knowledgeSummary}): the
 * shape of {@link ClassificationSchema}, and every name in it pointing at something that exists.
 */
export function classificationSchema(summary: KnowledgeSummary) {
  const kinds = allowedKinds(summary.places);
  const places = placesOf(summary);
  const principles = new Map(summary.principles.map((principle) => [principle.id, principle]));
  const entryIds = new Set([...summary.principles, ...summary.laws].map((entry) => entry.id));
  const records = new Set(summary.decisions.map((record) => record.number));

  return ClassificationSchema.superRefine((reply, context) => {
    const issue = (path: string[], message: string) => {
      context.addIssue({ code: 'custom', path, message });
    };
    if (!kinds.includes(reply.kind)) {
      const missing = reply.kind === 'adr' ? 'no decision-record folder' : 'no knowledge folder';
      issue(['kind'], `kind "${reply.kind}" has no place here: this repository has ${missing} — one of: ${kinds.join(', ')}`);
      return;
    }
    if ('place' in reply && !places.includes(reply.place)) {
      issue(['place'], `place "${reply.place}" is not "${PRODUCT_PLACE}" nor an existing domain — one of: ${places.join(', ')}`);
    }
    if (reply.kind === 'rule' && reply.serves !== NEW_PRINCIPLE) {
      const served = principles.get(reply.serves);
      if (!served) {
        issue(['serves'], `serves "${reply.serves}", which is no existing principle — name one, or "${NEW_PRINCIPLE}"`);
      } else if (served.place !== PRODUCT_PLACE && served.place !== reply.place) {
        issue(['serves'], `serves ${reply.serves}, a principle of "${served.place}" — a rule of "${reply.place}" serves a ${PRODUCT_PLACE} principle or its own`);
      }
    }
    if (reply.kind === 'covered') {
      const record = reply.covers.match(RECORD_ID);
      const known = record ? records.has(record[1] ?? '') : entryIds.has(reply.covers);
      if (!known) issue(['covers'], `covers "${reply.covers}", which names no existing entry or decision record`);
    }
  });
}

/**
 * A JSON schema of the reply, for the model call's `response_format`: the fields, the kinds this
 * repository allows and the places that exist. Looser than {@link classificationSchema}, which
 * stays the judge: a reply this accepts may still be refused there.
 */
export function classificationJsonSchema(summary: KnowledgeSummary) {
  const string = (maxLength?: number) => (maxLength ? { type: 'string', maxLength } : { type: 'string' });
  return {
    type: 'object',
    additionalProperties: false,
    required: ['kind', 'reason'],
    properties: {
      kind: { type: 'string', enum: allowedKinds(summary.places) },
      place: { type: 'string', enum: placesOf(summary) },
      title: string(),
      statement: string(CAPS.statement),
      serves: string(),
      principle: {
        type: 'object',
        additionalProperties: false,
        required: ['statement', 'why'],
        properties: { statement: string(CAPS.principle), why: string(CAPS.principle) },
      },
      covers: string(),
      reason: string(CAPS.reason),
    },
  };
}

/** One `### heading` and its text, or nothing when the text is absent. */
function section(heading: string, body: unknown): string[] {
  const text = plainText(body).trim();
  if (text === '') return [];
  return [`### ${heading}`, '', text, ''];
}

function itemSections(candidate: PromptCandidate): string[] {
  const sections = candidate.item?.sections;
  if (!sections) return section('The item, as it was raised', candidate.itemText);
  const options = sections.options?.map((option) => `${option.letter}. ${option.text}`).join('\n');
  return [
    ...section('The question', sections.questionPlain),
    ...section('The decision', sections.decisionPlain),
    ...section('The options (A is what was built)', options),
    ...section('What a person must do', sections.personSteps),
    ...section('What the agent had to decide', sections.whatIHadToDecide),
    ...section('What it did meanwhile', sections.whatIDidMeanwhile),
    ...section('What it costs to change later', sections.whatItCostsToChangeLater),
  ];
}

function list<T>(items: readonly T[], render: (item: T) => string, empty = '(none)'): string[] {
  return items.length > 0 ? items.map(render) : [empty];
}

function kindLines(kinds: readonly ClassificationKind[]): string[] {
  const meaning: Record<ClassificationKind, string> = {
    adr: '- `adr`: a decision record — how something is built, and why. Fields: `title`, `statement`, `reason`.',
    invariant:
      '- `invariant`: something that must always hold in the code. Fields: `place`, `statement`, `reason`.',
    rule: `- \`rule\`: a precise, provable business rule. Fields: \`place\`, \`statement\`, \`serves\` (an existing principle's id, of \`${PRODUCT_PLACE}\` or of the rule's own place, or \`${NEW_PRINCIPLE}\`), \`principle\` (\`{ statement, why }\`, only when \`serves\` is \`${NEW_PRINCIPLE}\`), \`reason\`.`,
    covered:
      '- `covered`: an existing entry or decision record already says this. Fields: `covers` (its id, or `ADR-NNNN`), `reason`.',
    'stays-here':
      '- `stays-here`: a local choice with nothing lasting to keep; it stays in the ledger. Fields: `statement`, `reason`.',
  };
  return kinds.map((kind) => meaning[kind]);
}

/**
 * The prompt for one candidate (a `harvestCandidates` entry) against a {@link knowledgeSummary}.
 * Pure: the same candidate and summary give the same text, byte for byte.
 */
export function classificationPrompt({ candidate, summary }: { candidate: PromptCandidate; summary: KnowledgeSummary }): string {
  const kinds = allowedKinds(summary.places);
  return [
    'You classify one settled decision of a software delivery loop: where, if anywhere, it belongs in the',
    "repository's knowledge base. Reply with one JSON object and nothing else.",
    '',
    '## The kinds you may answer',
    '',
    ...kindLines(kinds),
    '',
    `\`place\` is \`${PRODUCT_PLACE}\`, or one of the existing domains below; never a new one.`,
    `\`statement\` and \`principle\`'s fields are one or two plain sentences, at most ${CAPS.statement} characters.`,
    `\`reason\` says why this kind and this place, at most ${CAPS.reason} characters.`,
    'Prefer `covered` when the knowledge base below already says it, and `stays-here` for a local choice.',
    LOOK_RULE,
    '',
    `## The decision: ${candidate.id}`,
    '',
    ...itemSections(candidate),
    `### The answer (verdict: ${candidate.verdict ?? 'unknown'})`,
    '',
    (candidate.answer ?? '').trim() || '(none)',
    '',
    '## The knowledge base',
    '',
    '### Domains',
    '',
    ...list(summary.domains, (domain) => `- ${domain.name}: ${domain.firstLine ?? '(no README)'}`),
    '',
    '### Principles',
    '',
    ...list(summary.principles, (principle) => `- ${principle.id} (${principle.place}): ${principle.statement}`),
    '',
    '### Decision records',
    '',
    ...list(summary.decisions, (record) => `- ADR-${record.number}: ${record.title ?? '(untitled)'}`),
    '',
    '### Rules and invariants',
    '',
    ...list(summary.laws, (law) => `- ${law.id} (${law.kind}, ${law.place}): ${law.statement}`),
    '',
  ].join('\n');
}

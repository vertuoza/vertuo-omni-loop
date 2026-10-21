// A terminal's change to its product's knowledge (PRD 2268), as zod schemas the controller reads and answers
// with, and the kit's `changeKnowledge` sends (`omni kb legal|glossary add|edit`, `omni constituents
// add|edit`). Browser-safe: zod only.
//
//   POST /api/knowledge/changes   Authorization: Bearer <omni signin>
//     {repo, product?, kind, action, entry?, fields}   → 200 {done: 'applied' | 'proposed', id, url, waitsFor}
//
// - repo: the repository the terminal runs in (owner/name); product: the product's name or key, needed only
//   when the repository is in several.
// - kind and action, and the fields each takes (an edit changes only the fields it names, one at least;
//   the database checks every value):
//     legal add          fields {code, statement, source}
//     legal edit         entry `L-<CODE>-<n>`, fields {statement?, source?}
//     glossary add       fields {term, meaning, avoid?}
//     glossary edit      entry the term, fields {term?, meaning?, avoid?}
//     constituent add    fields {statement} or {never}: the Statement, or a Never line
//     constituent edit   entry `statement` or `never#<n>`, fields {text}
// - The answer: `applied` (the change is saved; id is the item's, url its page) or `proposed` (a member
//   who is not the section's owner or delegate; id null, url the section's list, waitsFor the owner's
//   login, or null while the section names nobody and its workspace's owners decide). waitsFor is null for
//   `applied`.
// - A refusal is `{error}` in plain words (ADR-0029): 400 a malformed body, 401 signed out, 403 not allowed
//   (another workspace's repository, a member changing a constituent), 404 no such product or item, 409 a
//   repository in several products and none named, 413 too large, 422 the database's refusal, in its
//   words, 500 the database failed, 503 no database here.
import { z } from 'zod';

const REPO = /^[\w.-]+\/[\w.-]+$/;

/** A value as a person typed it: trimmed, at most `most` characters; the database checks the rest. */
const text = (most: number) => z.string().trim().max(most);

const AVOID = z.array(text(80)).max(20);

const NEVER_ID = /^never#[1-9]\d{0,8}$/;

/** Where the change goes: the repository, and the product when the repository is in several. */
const WHERE = {
  repo: z.string().trim().max(200).regex(REPO, 'the repository as owner/name'),
  product: z.string().trim().min(1).max(200).nullable().optional(),
};

const ENTRY = z.string().trim().min(1).max(200);

/** An edit names one field at least. */
const SOME = 'name at least one field to change';
const some = (given: Record<string, unknown>) => Object.values(given).some((v) => v !== undefined);

const LegalAdd = z.strictObject({
  ...WHERE, kind: z.literal('legal'), action: z.literal('add'),
  fields: z.strictObject({ code: text(40), statement: text(400), source: text(500) }),
});
const LegalEdit = z.strictObject({
  ...WHERE, kind: z.literal('legal'), action: z.literal('edit'), entry: ENTRY,
  fields: z.strictObject({ statement: text(400), source: text(500) }).partial().refine(some, SOME),
});
const GlossaryAdd = z.strictObject({
  ...WHERE, kind: z.literal('glossary'), action: z.literal('add'),
  fields: z.strictObject({ term: text(80), meaning: text(400), avoid: AVOID.optional() }),
});
const GlossaryEdit = z.strictObject({
  ...WHERE, kind: z.literal('glossary'), action: z.literal('edit'), entry: ENTRY,
  fields: z.strictObject({ term: text(80), meaning: text(400), avoid: AVOID }).partial().refine(some, SOME),
});
const ConstituentAdd = z.strictObject({
  ...WHERE, kind: z.literal('constituent'), action: z.literal('add'),
  fields: z.union([z.strictObject({ statement: text(400) }), z.strictObject({ never: text(200) })]),
});
const ConstituentEdit = z.strictObject({
  ...WHERE, kind: z.literal('constituent'), action: z.literal('edit'),
  entry: z.string().trim().refine((id) => id === 'statement' || NEVER_ID.test(id), 'statement or never#<n>'),
  fields: z.strictObject({ text: text(400) }),
});

/** Each change, by its kind and action. */
export const CHANGES = {
  legal: { add: LegalAdd, edit: LegalEdit },
  glossary: { add: GlossaryAdd, edit: GlossaryEdit },
  constituent: { add: ConstituentAdd, edit: ConstituentEdit },
} as const;

/** What picks a change's schema. */
export const ChangeHeadSchema = z.object({ kind: z.enum(['legal', 'glossary', 'constituent']), action: z.enum(['add', 'edit']) });

export type LegalChange = z.infer<typeof LegalAdd> | z.infer<typeof LegalEdit>;
export type GlossaryChange = z.infer<typeof GlossaryAdd> | z.infer<typeof GlossaryEdit>;
export type ConstituentChange = z.infer<typeof ConstituentAdd> | z.infer<typeof ConstituentEdit>;
export type KnowledgeChange = LegalChange | GlossaryChange | ConstituentChange;

export const KnowledgeChangeReplySchema = z.strictObject({
  done: z.enum(['applied', 'proposed']),
  id: z.string().nullable(),
  url: z.string(),
  waitsFor: z.string().nullable(),
});

/** Why a change was refused, each with its status. */
export const CHANGE_REFUSALS = {
  malformed: 400, 'signed-out': 401, 'not-allowed': 403, missing: 404, several: 409, refused: 422, database: 500, unavailable: 503,
} as const;
export type ChangeRefusal = keyof typeof CHANGE_REFUSALS;

/** The largest body a change carries. */
export const MAX_CHANGE_BYTES = 16 * 1024;

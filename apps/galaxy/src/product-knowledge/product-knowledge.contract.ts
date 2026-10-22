// What the product home's Knowledge tab reads and sends (PRD 1795 s2), as zod schemas both sides share:
// the repository parses the database's answer with them, the controller answers these shapes and the
// browser's client parses every answer with them. Browser-safe: zod only.
//
//   POST /app/products/<id>/knowledge/changes
//     {op: 'change', kind, action, entry?, fields}   → 200 { done: 'applied' | 'proposed' }
//         the kind's owner or delegate changes it directly, any other member proposes it
//     {op: 'decide', proposal, verdict}              → 200 { done: 'approved' | 'rejected' }
//         the kind's owner or delegate decides an open proposal
//     {op: 'name', kind, role, user}                 → 200 { done: 'named' }
//         a workspace owner names (or, user null, clears) a kind's owner or delegate
//
// A refusal is `{ error }` in plain words (ADR-0029): 400 a malformed request, 401 signed out, 403 not
// allowed, 404 no such product, 422 a value the database refuses (in its words), 500 the database failed.
import { z } from 'zod';

const KINDS = ['legal', 'glossary'] as const;
const KindSchema = z.enum(KINDS);
export type Kind = z.infer<typeof KindSchema>;

/** A member as the tab shows them: `{user, login}`, or null (none named, or one who left). */
const PersonSchema = z.object({ user: z.string(), login: z.string().nullable() }).nullable();
export type Person = z.infer<typeof PersonSchema>;

/** Who added an entry (null: nobody known, as when their account was deleted), when, and when it last changed (PRD 2240 s1). */
const AUTHORED = { createdBy: PersonSchema, createdAt: z.string(), updatedAt: z.string() };

const LegalEntrySchema = z.object({
  entry: z.string(),
  id: z.string(),
  code: z.string(),
  number: z.number(),
  statement: z.string(),
  source: z.string(),
  owner: PersonSchema,
  retiredAt: z.string().nullable(),
  ...AUTHORED,
});
export type LegalEntry = z.infer<typeof LegalEntrySchema>;

const GlossaryEntrySchema = z.object({
  entry: z.string(),
  term: z.string(),
  meaning: z.string(),
  avoid: z.array(z.string()),
  removedAt: z.string().nullable(),
  ...AUTHORED,
});
export type GlossaryEntry = z.infer<typeof GlossaryEntrySchema>;

const ProposalSchema = z.object({
  proposal: z.string(),
  action: z.string(),
  entry: z.string().nullable(),
  fields: z.record(z.string(), z.unknown()),
  proposedBy: PersonSchema,
  proposedAt: z.string(),
});
export type Proposal = z.infer<typeof ProposalSchema>;

const section = <E extends z.ZodType>(entries: E) =>
  z.object({ owner: PersonSchema, delegate: PersonSchema, decides: z.boolean(), entries: z.array(entries), proposals: z.array(ProposalSchema) });

/** product_knowledge_of(): what the tab shows a member of the workspace. */
export const KnowledgeReadSchema = z.object({
  product: z.object({ id: z.string(), name: z.string() }),
  canName: z.boolean(),
  latestEventId: z.string().nullable(),
  legal: section(LegalEntrySchema),
  glossary: section(GlossaryEntrySchema),
});
export type KnowledgeRead = z.infer<typeof KnowledgeReadSchema>;
export type LegalSection = KnowledgeRead['legal'];
export type GlossarySection = KnowledgeRead['glossary'];

/** A member a workspace owner may name. */
export interface KnowledgeMember {
  id: string;
  login: string;
}

/** What the tab draws: the read, and the members a workspace owner may name (none for anyone else). */
export interface KnowledgeTab extends KnowledgeRead {
  members: KnowledgeMember[];
}

const text = (most: number) => z.string().trim().max(most);

/** The fields a change may carry; the database checks their values. */
const FieldsSchema = z.strictObject({
  code: text(40),
  statement: text(400),
  source: text(500),
  term: text(80),
  meaning: text(400),
  avoid: z.array(text(80)).max(20),
}).partial();
export type Fields = z.infer<typeof FieldsSchema>;

const UUID = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

const ACTIONS = ['add', 'edit', 'retire', 'remove'] as const;

const ChangeSchema = z.strictObject({
  op: z.literal('change'),
  kind: KindSchema,
  action: z.enum(ACTIONS),
  entry: UUID.optional(),
  fields: FieldsSchema.default({}),
}).refine(
  (w) => (w.kind === 'legal' ? w.action !== 'remove' : w.action !== 'retire') && (w.action === 'add' ? w.entry === undefined : w.entry !== undefined),
  'An addition names no entry; an edit, a retirement or a removal names one; a Legal entry is retired, a term removed.',
);
export type ChangeWrite = z.infer<typeof ChangeSchema>;

const VERDICTS = ['approve', 'reject'] as const;

/** A change as a member sends it. */
export const KnowledgeWriteSchema = z.union([
  ChangeSchema,
  z.strictObject({ op: z.literal('decide'), proposal: UUID, verdict: z.enum(VERDICTS) }),
  z.strictObject({ op: z.literal('name'), kind: KindSchema, role: z.enum(['owner', 'delegate']), user: UUID.nullable() }),
]);
export type KnowledgeWrite = z.infer<typeof KnowledgeWriteSchema>;

const DONE = ['applied', 'proposed', 'approved', 'rejected', 'named'] as const;
export const KnowledgeDoneSchema = z.object({ done: z.enum(DONE) });
export type Done = z.infer<typeof KnowledgeDoneSchema>['done'];

/** Every refusal. */
export const KnowledgeErrorSchema = z.object({ error: z.string() });

/** Why a change was refused, each with its status. */
export const KNOWLEDGE_REFUSALS = { malformed: 400, 'signed-out': 401, 'not-allowed': 403, missing: 404, refused: 422, database: 500 } as const;
export type KnowledgeRefusal = keyof typeof KNOWLEDGE_REFUSALS;

/** The tab's page, under the product home. */
export const knowledgeTabHref = (product: string) => `/app/products/${encodeURIComponent(product)}/knowledge`;
/** Where the changes are written. */
export const changesRoute = (product: string) => `${knowledgeTabHref(product)}/changes`;

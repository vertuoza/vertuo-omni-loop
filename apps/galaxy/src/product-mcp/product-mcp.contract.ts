// A product's MCP server (PRD 2707 s3; ADR-0095): what `/api/products/<key>/mcp` answers, as zod schemas,
// and the one-line refusals. Browser-safe: no server module is imported.
//
//   search_knowledge {query?, kind?, domain?, repo?}  → {hits, total, mode?, repositories}
//   get_knowledge    {id}                             → {entry, repositories}
//
// Every answer carries `repositories`: each repository of the product the key may read, with its newest
// knowledge pack, or `pack: null` and the line telling the agent to tell its person (BL-PRODUCTKNOWLEDGE-4).
// A search with a query says by `mode` how it ranked (PRD 2728 s5): `meaning`, by the entries' vectors, or
// `words`, the word search, whenever the vectors could not answer. A listing (no query) carries no mode.
import { z } from 'zod';

/** The kinds of knowledge an entry is. */
export const KNOWLEDGE_KINDS = ['business-law', 'adr', 'rule', 'legal', 'term', 'never'] as const;
const KnowledgeKindSchema = z.enum(KNOWLEDGE_KINDS);
export type KnowledgeKind = z.infer<typeof KnowledgeKindSchema>;

/** One entry of the product's knowledge, its body whole. */
const KnowledgeEntrySchema = z.object({
  id: z.string().min(1),
  kind: KnowledgeKindSchema,
  title: z.string(),
  /** The repository (owner/name) the entry comes from; null for the product's own rows and its business laws. */
  repo: z.string().nullable(),
  domain: z.string().nullable(),
  body: z.string(),
  /** The file in the repository it was read from; null for the product's own rows. */
  file: z.string().nullable(),
  status: z.string().nullable(),
});

/** One search hit: an entry without its body, with the body's sentence that holds a word of the query. */
const KnowledgeHitSchema = KnowledgeEntrySchema.pick({ id: true, kind: true, title: true, repo: true, domain: true }).extend({
  snippet: z.string(),
});
export type KnowledgeHit = z.infer<typeof KnowledgeHitSchema>;

/** The line an agent gets for a repository with no knowledge pack yet. */
export const NO_PACK_LINE = 'no knowledge from this repository yet: it arrives with its next merge. Tell your person.';

/** A repository the key reads, and the pack its entries come from. */
const RepositoryStateSchema = z.object({
  repo: z.string(),
  pack: z.object({ sha: z.string(), committedAt: z.string() }).nullable(),
  note: z.string().optional(),
});
export type RepositoryState = z.infer<typeof RepositoryStateSchema>;

/** How a search with a query ranked its hits: by meaning, or by words when the vectors could not answer. */
const SearchModeSchema = z.enum(['meaning', 'words']);
export type SearchMode = z.infer<typeof SearchModeSchema>;

export const SearchAnswerSchema = z.object({
  hits: z.array(KnowledgeHitSchema),
  total: z.number().int().nonnegative(),
  mode: SearchModeSchema.optional(),
  repositories: z.array(RepositoryStateSchema),
});

export const GetAnswerSchema = z.object({ entry: KnowledgeEntrySchema, repositories: z.array(RepositoryStateSchema) });

/** At most this many hits per search. */
export const HIT_CAP = 20;

/** The body of a product that is off, unknown, of another workspace or out of the key's reach: HTTP 404. */
export const NOT_HERE = 'No MCP server here.';
/** The body when this deployment has no database: HTTP 503. */
export const NO_DATABASE = 'The knowledge is not available here: this deployment has no database.';
/** The body when the database could not say who may read: HTTP 500. */
export const NOT_READ = 'The knowledge could not be read. Try again.';
/** What each tool call answers, as a tool error, for a missing, malformed, wrong or revoked key (ADR-0067). */
export const KEY_REFUSED = 'This API key does not work here. Make one on Settings › API keys, and check the product\'s MCP server is on.';

/** What get_knowledge answers, as a tool error, for an id the product does not hold. */
export const noEntryLine = (id: string, product: string): string =>
  `No knowledge entry ${id} in ${product}. Search for it with search_knowledge.`;


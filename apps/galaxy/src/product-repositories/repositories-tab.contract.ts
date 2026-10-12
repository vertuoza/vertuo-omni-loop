// What the product home's Repositories & approvers tab sends and reads (PRD 1364 s11; ADR-0095), as zod
// schemas both sides share: the controller (repositories-tab.controller.ts) answers these shapes, and
// the browser's client (repositories-tab.client.ts) parses every answer with them. Browser-safe: zod
// and the approvers' pure model only.
//
//   POST   /app/products/<id>/repositories/links {repo, role, knowledge, readAt, readOnly, consumes}
//          → 200 { link }                 an owner adds a repository, or sets every field of its link
//   DELETE /app/products/<id>/repositories/links?repo=<owner/name>
//          → 200 { repo, removed }        an owner takes a repository out of the product
//   POST   /app/products/<id>/repositories/approvers {member, state}
//          → 200 { member, state }        an owner lists a member as asked or skipped
//   DELETE /app/products/<id>/repositories/approvers?member=<id>
//          → 200 { member, removed }      an owner takes a member off the list
//
// A refusal is `{ error }` in plain words (ADR-0029): 400 a malformed request, 401 signed out, 403 not an
// owner, 404 no such product the caller reads, 422 a field or a repository the database refuses (in its
// words), 500 the database failed.
import { z } from 'zod';
import { ApproverState, type Approvers } from '../products/approvers';

export const KNOWLEDGE = ['own', 'imported', 'none'] as const;
const KnowledgeSchema = z.enum(KNOWLEDGE);
export type Knowledge = z.infer<typeof KnowledgeSchema>;

const RepoSchema = z.string().trim().min(3).max(200).regex(/^[\w.-]+\/[\w.-]+$/);

/** One repository of the product, as the tab shows it. */
const LinkSchema = z.object({
  repo: z.string(),
  role: z.string().nullable(),
  knowledge: KnowledgeSchema,
  readAt: z.string().nullable(),
  readOnly: z.boolean(),
  consumes: z.array(z.string()),
  addedBy: z.enum(['prd', 'person']),
});
export type Link = z.infer<typeof LinkSchema>;

/** A link as an owner writes it: every field, set to what it names. */
export const LinkWriteSchema = z.strictObject({
  repo: RepoSchema,
  role: z.string().trim().max(40).nullable(),
  knowledge: KnowledgeSchema,
  readAt: z.string().trim().max(40).nullable(),
  readOnly: z.boolean(),
  consumes: z.array(RepoSchema).max(100),
});
export type LinkWrite = z.infer<typeof LinkWriteSchema>;

export const LinkSavedSchema = z.object({ link: LinkSchema });
export const LinkRemovedSchema = z.object({ repo: z.string(), removed: z.boolean() });
export const RepoQuerySchema = RepoSchema;

const MemberSchema = z.string().trim().min(1).max(100);
export const ApproverWriteSchema = z.strictObject({ member: MemberSchema, state: ApproverState });
export const ApproverSavedSchema = z.object({ member: z.string(), state: ApproverState });
export const ApproverRemovedSchema = z.object({ member: z.string(), removed: z.boolean() });
export const MemberQuerySchema = MemberSchema;

/** What the tab shows (repositories-tab.service.ts reads it; the page draws it). */
export interface RepositoriesTab {
  product: { id: string; name: string };
  /** Whether the reader owns the workspace: only then are the controls drawn. */
  owner: boolean;
  links: Link[];
  /** The workspace's repositories not in the product yet, by name. */
  addable: string[];
  /** The Approvers list, or null when it could not be read. */
  approvers: Approvers | null;
}

/** Every refusal. */
export const TabErrorSchema = z.object({ error: z.string() });

/** Why a change was refused, each with its status. */
export const TAB_REFUSALS = { malformed: 400, 'signed-out': 401, 'not-owner': 403, missing: 404, refused: 422, database: 500 } as const;
export type TabRefusal = keyof typeof TAB_REFUSALS;

/** The tab's page, under the product home. */
export const repositoriesTabHref = (product: string) => `/app/products/${encodeURIComponent(product)}/repositories`;
/** Where the links are written. */
export const linksRoute = (product: string) => `${repositoriesTabHref(product)}/links`;
/** Where the approvers are written. */
export const approversRoute = (product: string) => `${repositoriesTabHref(product)}/approvers`;

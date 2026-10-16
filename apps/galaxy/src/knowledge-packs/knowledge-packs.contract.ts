import { z } from 'zod';

// The knowledge pack read's contract (PRD 2011; ADR-0095): what the kit's `omni kb pack get` asks
// (PRD 2011 s12), and what `GET /api/knowledge-packs` answers. A pack is a repository's knowledge folder
// and flow config at one commit, kept by the App's knowledge pack (apps/omni-app/src/knowledge-pack/,
// s11) through knowledge_pack_put() (supabase/migrations/20261212100000_knowledge_packs.sql): each file
// by its repository path, with its content and the lower-case hex sha256 of that content's UTF-8 bytes.
// Browser-safe: zod only.

/** owner/name, as GitHub names a repository. */
const Repository = z.string().max(200).regex(/^[\w.-]+\/[\w.-]+$/, 'owner/name');
/** A full commit sha. */
const CommitSha = z.string().regex(/^[0-9a-f]{40}$/, 'the full 40-character commit');

/** `?repo=<owner/name>[&sha=<commit>]`: the newest pack of the repository, or the pack of that commit. */
export const PackQuerySchema = z.strictObject({
  repo: Repository,
  sha: CommitSha.optional(),
});
export type PackQuery = z.infer<typeof PackQuerySchema>;

/** One file of a pack. */
const PackFileSchema = z.strictObject({
  path: z.string().min(1).max(512),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  content: z.string(),
});

/** A pack: the repository (owner/name, lower case), its commit, when that commit was made and when the pack was kept, and its files in path order. */
export const PackReplySchema = z.strictObject({
  repository: z.string().min(1),
  sha: CommitSha,
  committedAt: z.string().min(1),
  madeAt: z.string().min(1),
  files: z.array(PackFileSchema),
});
export type PackReply = z.infer<typeof PackReplySchema>;

/** The refusals a read answers with, by status. */
export const PACK_REFUSALS = Object.freeze({ unavailable: 503, missing: 404, database: 500 } as const);
export type PackRefusal = keyof typeof PACK_REFUSALS;

// The knowledge pack's database (PRD 2011 s11), as the service role (`SUPABASE_URL`,
// `SUPABASE_SERVICE_ROLE_KEY`, the approved check's own pair): the App has no person's session.
//
//   held   whether any product holds the repository (`product_repositories`): read before GitHub is, so a
//          merge in a repository no product holds spends nothing of the installation's budget
//   put    knowledge_pack_put(), the only writer of a pack, granted to the service role alone
//          (supabase/migrations/20261212100000_knowledge_packs.sql): it keeps the pack in every workspace
//          that holds the repository in a product, changes nothing for a commit it already keeps, marks
//          the newest by the commit's date, and refuses a path that climbs out or a sha256 that does not
//          hash to the content
//
// Throws when the database refuses or answers out of shape.
import { z } from 'zod';
import type { Connection } from '../approved-check/record.ts';
import { rowsOf, serviceDb } from '../server-event/service-db.ts';
import type { PackFile } from './files.ts';

/** One pack kept: in which workspace, whether this put made it, whether it is the newest, how many files. */
const KeptSchema = z.object({
  workspace: z.string().min(1),
  packId: z.string().min(1),
  created: z.boolean(),
  newest: z.boolean(),
  files: z.number().int().nonnegative(),
});

/** What knowledge_pack_put() answers. */
const PutAnswerSchema = z.object({
  repository: z.string().min(1),
  sha: z.string().regex(/^[0-9a-f]{40}$/),
  packs: z.array(KeptSchema),
});
export type PutAnswer = z.infer<typeof PutAnswerSchema>;

/** A pack to keep: the repository (owner/name), the commit, when it was made, and the files. */
export type PackPut = { repository: string; sha: string; committedAt: string; files: readonly PackFile[] };

export type PackStore = {
  /** Whether any product holds `repository` (owner/name). */
  held: (repository: string) => Promise<boolean>;
  /** Keeps the pack; what the database answered. */
  put: (pack: PackPut) => Promise<PutAnswer>;
};

const HolderSchema = z.object({ product_id: z.string().min(1) });

const refused = (error: { message: string; code?: string }) =>
  new Error(`the database refused: ${error.message}${error.code ? ` (${error.code})` : ''}`);

/** The store, as the service role on `connection`. */
export function knowledgePackStore(connection: Connection): PackStore {
  const db = serviceDb(connection);
  return {
    held: async (repository) => {
      const answer = await db.from('product_repositories').select('product_id').eq('repository', repository.toLowerCase()).limit(1);
      return rowsOf(HolderSchema, answer).length > 0;
    },
    put: async ({ repository, sha, committedAt, files }) => {
      const { data, error } = await db.rpc('knowledge_pack_put', {
        p_repo: repository,
        p_sha: sha,
        p_committed_at: committedAt,
        p_files: files.map(({ path, content, sha256 }) => ({ path, content, sha256 })),
      });
      if (error) throw refused(error);
      return PutAnswerSchema.parse(data);
    },
  };
}

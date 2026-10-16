// The knowledge packs' storage (PRD 2011; ADR-0095), on the client it is given: the caller's own, acting
// as their access token, so row-level security has the last word: a member reads only the packs of their
// own workspaces (supabase/migrations/20261212100000_knowledge_packs.sql), and a pack of any other
// workspace reads as none. Every answer is parsed where it comes in; it holds no rule. A refusal comes
// back as the database's code and message; an answer out of shape as the code `shape`.
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

/** What the reads need: the tables. */
export type KnowledgePacksDb = Pick<SupabaseClient, 'from'>;

/** A stored answer: its value, or why the database said no. */
export type Stored<T> = { ok: true; value: T } | { ok: false; code: string | null; message: string | null };

/** PostgREST answers at most this many rows at once. */
const PAGE = 1000;

const PackRow = z.object({
  id: z.string().min(1),
  repository: z.string(),
  sha: z.string(),
  committed_at: z.string(),
  made_at: z.string(),
});
export type PackRow = z.infer<typeof PackRow>;

const FileRow = z.object({ path: z.string(), sha256: z.string(), content: z.string() });
export type FileRow = z.infer<typeof FileRow>;

type Raw = { data: unknown; error: { code?: string; message?: string } | null };

/** The rows `call` answered, read by `schema`; the database's refusal, or `shape` naming `table`. */
async function parsed<T>(call: PromiseLike<Raw>, schema: z.ZodType<T>, table: string): Promise<Stored<T>> {
  const answer = await call;
  const read = answer.error ? null : schema.safeParse(answer.data);
  if (read?.success) return { ok: true, value: read.data };
  const refusal = answer.error ?? { code: 'shape', message: `${table} answered out of shape` };
  return { ok: false, code: refusal.code ?? null, message: refusal.message ?? null };
}

export function knowledgePacksRepository(db: KnowledgePacksDb) {
  return {
    /**
     * The pack of `repository` (owner/name, lower case) the caller reads: the one of commit `sha`, or,
     * with none, the newest. A member of several workspaces holding it reads the latest commit's.
     */
    async pack(repository: string, sha: string | null): Promise<Stored<PackRow | null>> {
      const packs = db.from('knowledge_packs').select('id, repository, sha, committed_at, made_at').eq('repository', repository);
      const picked = sha === null ? packs.eq('newest', true) : packs.eq('sha', sha);
      const rows = await parsed(picked.order('committed_at', { ascending: false }).order('made_at', { ascending: false }).limit(1), z.array(PackRow), 'knowledge_packs');
      return rows.ok ? { ok: true, value: rows.value[0] ?? null } : rows;
    },

    /** Every file of the pack, in path order, a page at a time. */
    async files(packId: string): Promise<Stored<FileRow[]>> {
      const files: FileRow[] = [];
      for (let start = 0; ; start += PAGE) {
        const page = await parsed(
          db.from('knowledge_pack_files').select('path, sha256, content').eq('pack_id', packId).order('path').range(start, start + PAGE - 1),
          z.array(FileRow),
          'knowledge_pack_files',
        );
        if (!page.ok) return page;
        files.push(...page.value);
        if (page.value.length < PAGE) return { ok: true, value: files };
      }
    },
  };
}

export type KnowledgePacksRepository = ReturnType<typeof knowledgePacksRepository>;

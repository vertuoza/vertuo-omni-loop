// The knowledge graphs' storage, for the push (PRD 1798; ADR-0095), on the client it is given: the
// caller's own, acting as their access token, so the database decides who may push:
// knowledge_graph_push() (supabase/migrations/20261215100000_knowledge_graphs.sql) refuses a caller who
// is a member of no workspace listing the repository (42501), keeps one row per repository and commit and
// the last 20 commits. Its answer is parsed where it comes in; it holds no rule. A refusal comes back as
// the database's code and message; an answer out of shape as the code `shape`.
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { RepositoryGraph } from 'omni-loop/kit/lib/knowledge/graph-schema.ts';

/** What the push needs: the database's functions. */
export type GraphPushDb = Pick<SupabaseClient, 'rpc'>;

/** A stored answer: its value, or why the database said no. */
export type Stored<T> = { ok: true; value: T } | { ok: false; code: string | null; message: string | null };

const PushedSchema = z.object({
  repository: z.string().min(1),
  sha: z.string().min(1),
  nodes: z.number().int(),
  edges: z.number().int(),
  products: z.array(z.object({ id: z.string().min(1), key: z.string().nullable() })),
});
export type Pushed = z.infer<typeof PushedSchema>;

type RpcAnswer = { data: unknown; error: { code?: string; message?: string } | null };

export function graphPushRepository(db: GraphPushDb) {
  return {
    /** Keeps `graph` as the graph of `repo` at `sha`, as the caller. */
    async push(repo: string, sha: string, graph: RepositoryGraph): Promise<Stored<Pushed>> {
      const answer: RpcAnswer = await db.rpc('knowledge_graph_push', { p_repo: repo, p_sha: sha, p_graph: graph });
      const read = answer.error ? null : PushedSchema.safeParse(answer.data);
      if (read?.success) return { ok: true, value: read.data };
      const refusal = answer.error ?? { code: 'shape', message: 'knowledge_graph_push answered out of shape' };
      return { ok: false, code: refusal.code ?? null, message: refusal.message ?? null };
    },
  };
}

export type GraphPushRepository = ReturnType<typeof graphPushRepository>;

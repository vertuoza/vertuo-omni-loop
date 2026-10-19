import type { RepositoryGraph } from 'vertuo-omni-plan/kit/lib/knowledge/graph-schema.ts';
import type { GraphPushRefusal } from './push.contract';
import type { GraphPushRepository } from './push.repository';

// The knowledge graph push's rules (PRD 1798; ADR-0095), on its repository: the graph kept for the
// repository and commit, and the products it is served in, or why not. Who may push is the database's to
// decide (knowledge_graph_push(), as the caller): its refusal of a repository no workspace of the caller
// lists is passed on in its own words, never decided here.

/** A service answer: its value, or why it was refused, in plain words, with the database's own words when it failed. */
type Served<T> = { ok: true; value: T } | { ok: false; kind: GraphPushRefusal; error: string; cause: string | null };

/** What a push kept: the repository and commit as stored, the graph's counts, the products serving it. */
type GraphKept = { repo: string; commit: string; nodes: number; edges: number; products: Array<{ id: string; key: string | null }> };

/** The refusal each database code is, by kind; any other is the database failing. */
const KIND_OF: Readonly<Record<string, GraphPushRefusal>> = { '42501': 'forbidden', '22023': 'malformed' };

const NOT_STORED = 'The knowledge graph could not be stored. Try again.';

export function graphPushService(repository: GraphPushRepository) {
  return {
    /** Keeps `graph` as the graph of `repo` at `commit`. */
    async push({ repo, commit, graph }: { repo: string; commit: string; graph: RepositoryGraph }): Promise<Served<GraphKept>> {
      const kept = await repository.push(repo, commit, graph);
      if (kept.ok) {
        const { repository: stored, sha, nodes, edges, products } = kept.value;
        return { ok: true, value: { repo: stored, commit: sha, nodes, edges, products } };
      }
      const kind = (kept.code === null ? undefined : KIND_OF[kept.code]) ?? 'database';
      const error = kind === 'database' || kept.message === null ? NOT_STORED : kept.message;
      return { ok: false, kind, error, cause: kind === 'database' ? `${kept.code ?? 'no code'}: ${kept.message ?? 'no message'}` : null };
    },
  };
}

export type GraphPushService = ReturnType<typeof graphPushService>;

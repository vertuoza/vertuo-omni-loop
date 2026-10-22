import { describe, expect, it } from 'vitest';
import type { RepositoryGraph } from 'omni-loop/kit/lib/knowledge/graph-schema.ts';
import { graphPushRepository, type GraphPushDb } from './push.repository';

// The push's storage (PRD 1798 s1): one call of knowledge_graph_push() as the caller, its answer parsed
// where it comes in, its refusal passed on by code and words. No test calls Supabase.

const SHA = 'a'.repeat(40);
const GRAPH: RepositoryGraph = { version: 1, shape: 'repository', nodes: [], edges: [] };

/** A client whose one function answers `answer`, recording each call. */
function dbAnswering(answer: { data: unknown; error: { code?: string; message?: string } | null }) {
  const calls: Array<[string, unknown]> = [];
  const db = { rpc: (fn: string, args: unknown) => { calls.push([fn, args]); return Promise.resolve(answer); } } as unknown as GraphPushDb;
  return { db, calls };
}

describe('the knowledge graph push\'s storage (PRD 1798 s1)', () => {
  it('calls knowledge_graph_push() with the repository, the commit and the graph, and reads its answer', async () => {
    const pushed = { repository: 'acme/api', sha: SHA, nodes: 0, edges: 0, pushedAt: '2026-12-14T09:00:00Z', products: [{ id: 'p-1', key: 'mobile' }] };
    const { db, calls } = dbAnswering({ data: pushed, error: null });
    expect(await graphPushRepository(db).push('Acme/API', SHA, GRAPH)).toEqual({
      ok: true, value: { repository: 'acme/api', sha: SHA, nodes: 0, edges: 0, products: [{ id: 'p-1', key: 'mobile' }] },
    });
    expect(calls).toEqual([['knowledge_graph_push', { p_repo: 'Acme/API', p_sha: SHA, p_graph: GRAPH }]]);
  });

  it('passes on the database\'s refusal by its code and its words', async () => {
    const { db } = dbAnswering({ data: null, error: { code: '42501', message: 'You are not a member of a workspace that tracks acme/api.' } });
    expect(await graphPushRepository(db).push('acme/api', SHA, GRAPH)).toEqual({
      ok: false, code: '42501', message: 'You are not a member of a workspace that tracks acme/api.',
    });
    expect(await graphPushRepository(dbAnswering({ data: null, error: {} }).db).push('acme/api', SHA, GRAPH)).toEqual({ ok: false, code: null, message: null });
  });

  it('names an answer out of shape', async () => {
    const { db } = dbAnswering({ data: { repository: 'acme/api' }, error: null });
    expect(await graphPushRepository(db).push('acme/api', SHA, GRAPH)).toEqual({
      ok: false, code: 'shape', message: 'knowledge_graph_push answered out of shape',
    });
  });
});

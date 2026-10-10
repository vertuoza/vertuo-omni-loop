import { describe, expect, it } from 'vitest';
import { productHomeRepository, type ProductHomeDb } from './product-home.repository';

// The product home's storage (PRD 1364 s9), on a stubbed client (no test calls Supabase): each read's
// table, columns and filters, what it answers parsed, nothing read for no PRD, and a refusal or an answer
// out of shape thrown.

type Answer = { data?: unknown; error?: { message: string } | null };

function stub(answers: Record<string, Answer>) {
  const calls: unknown[][] = [];
  const query = (table: string) => {
    const answer = answers[table] ?? { data: [] };
    const q: Record<string, unknown> = {
      then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) =>
        Promise.resolve({ data: answer.data ?? null, error: answer.error ?? null }).then(ok, ko),
    };
    for (const verb of ['select', 'eq', 'not', 'in', 'is', 'like', 'order']) {
      q[verb] = (...a: unknown[]) => { calls.push([table, verb, ...a]); return q; };
    }
    return q;
  };
  const db = {
    from: (table: string) => query(table),
    rpc: (fn: string) => { calls.push([fn, 'rpc']); return query(fn); },
  };
  return { calls, repo: productHomeRepository(db as unknown as ProductHomeDb) };
}

describe('the product home\'s storage', () => {
  it('reads the workspace\'s product by its id, or none', async () => {
    const { calls, repo } = stub({ products: { data: [{ id: 'p-1', name: 'Mobile' }] } });
    expect(await repo.product('ws-1', 'p-1')).toEqual({ id: 'p-1', name: 'Mobile' });
    expect(calls).toEqual([['products', 'select', 'id, name'], ['products', 'eq', 'workspace_id', 'ws-1'], ['products', 'eq', 'id', 'p-1']]);
    expect(await stub({ products: { data: [] } }).repo.product('ws-1', 'p-x')).toBeNull();
  });

  it('reads the product\'s numbered PRDs, newest first', async () => {
    const row = { id: 'd-1', home_repo: 'vertuo/api', prd: 7, title: 'T', birthplace: 'server', opened_by: 'u-1', created_at: '2026-10-01T00:00:00Z' };
    const { calls, repo } = stub({ dossiers: { data: [row] } });
    expect(await repo.prds('ws-1', 'p-1')).toEqual([row]);
    expect(calls).toEqual([
      ['dossiers', 'select', 'id, home_repo, prd, title, birthplace, opened_by, created_at'], ['dossiers', 'eq', 'kind', 'prd'],
      ['dossiers', 'not', 'prd', 'is', null], ['dossiers', 'not', 'product_id', 'is', null],
      ['dossiers', 'eq', 'workspace_id', 'ws-1'], ['dossiers', 'eq', 'product_id', 'p-1'], ['dossiers', 'order', 'created_at', { ascending: false }],
    ]);
  });

  it('reads the stages, outboxes and topics of the workspace\'s PRDs in the repositories given', async () => {
    const { calls, repo } = stub({
      prd_stages: { data: [{ repository: 'vertuo/api', prd: 7, stage: 'building' }] },
      prd_outbox: { data: [{ repository: 'vertuo/api', prd: 7, waiting: [{ id: 's1-01', rank: 'high', question: 'Q?' }] }] },
      prd_topics: { data: [{ repository: 'vertuo/api', prd: 7, topic: 'invoices' }] },
    });
    expect(await repo.stages('ws-1', ['vertuo/api'])).toEqual([{ repository: 'vertuo/api', prd: 7, stage: 'building' }]);
    expect(await repo.outbox('ws-1', ['vertuo/api'])).toEqual([{ repository: 'vertuo/api', prd: 7, waiting: [{ id: 's1-01', rank: 'high', question: 'Q?' }] }]);
    expect(await repo.topics('ws-1', ['vertuo/api'])).toEqual([{ repository: 'vertuo/api', prd: 7, topic: 'invoices' }]);
    expect(calls).toEqual([
      ['prd_stages', 'select', 'repository, prd, stage'], ['prd_stages', 'eq', 'workspace_id', 'ws-1'], ['prd_stages', 'in', 'repository', ['vertuo/api']],
      ['prd_outbox', 'select', 'repository, prd, waiting'], ['prd_outbox', 'eq', 'workspace_id', 'ws-1'], ['prd_outbox', 'in', 'repository', ['vertuo/api']],
      ['prd_topics', 'select', 'repository, prd, topic'], ['prd_topics', 'eq', 'workspace_id', 'ws-1'], ['prd_topics', 'in', 'repository', ['vertuo/api']],
    ]);
  });

  it('reads the approvals and voids of the dossiers given, and what waits on the caller', async () => {
    const { calls, repo } = stub({
      approvals: { data: [{ id: 'a-1', dossier_id: 'd-1', approved_at: '2026-10-01T00:00:00Z' }] },
      approval_voids: { data: [{ approval_id: 'a-1', dossier_id: 'd-1' }] },
      approval_requests_waiting: { data: [{ id: 'r-1', dossier: 'd-1', repo: 'vertuo/api', prd: 7, title: 'T', askedAt: '2026-10-01T00:00:00Z' }] },
    });
    expect(await repo.approvals(['d-1'])).toEqual([{ id: 'a-1', dossier_id: 'd-1', approved_at: '2026-10-01T00:00:00Z' }]);
    expect(await repo.voids(['d-1'])).toEqual([{ approval_id: 'a-1', dossier_id: 'd-1' }]);
    expect(await repo.waitingOnMe()).toEqual(['d-1']);
    expect(calls).toEqual([
      ['approvals', 'select', 'id, dossier_id, approved_at'], ['approvals', 'in', 'dossier_id', ['d-1']],
      ['approval_voids', 'select', 'approval_id, dossier_id'], ['approval_voids', 'in', 'dossier_id', ['d-1']],
      ['approval_requests_waiting', 'rpc'],
    ]);
  });

  it('reads the workspace\'s open pull requests on a feature branch', async () => {
    const { calls, repo } = stub({ pull_requests: { data: [{ repo: 'vertuo/api', number: 447, head: 'feat/invoices' }] } });
    expect(await repo.featurePulls('ws-1')).toEqual([{ repo: 'vertuo/api', number: 447, head: 'feat/invoices' }]);
    expect(calls).toEqual([
      ['pull_requests', 'select', 'repo, number, head'], ['pull_requests', 'is', 'closed_at', null], ['pull_requests', 'is', 'merged_at', null],
      ['pull_requests', 'like', 'head', 'feat/%'], ['pull_requests', 'eq', 'workspace_id', 'ws-1'],
    ]);
  });

  it('reads the product\'s ideas still on the board, newest first (PRD 1364 s10)', async () => {
    const row = { id: 'i-1', repo: 'vertuo/api', title: 'Calmer gate', pitch: 'Fewer pings.', lane: 'now', prd: null, created_at: '2026-10-01T00:00:00Z' };
    const { calls, repo } = stub({ ideas: { data: [row] } });
    expect(await repo.ideas('ws-1', 'p-1')).toEqual([row]);
    expect(calls).toEqual([
      ['ideas', 'select', 'id, repo, title, pitch, lane, prd, created_at'], ['ideas', 'eq', 'archived', false],
      ['ideas', 'not', 'product_id', 'is', null], ['ideas', 'eq', 'workspace_id', 'ws-1'], ['ideas', 'eq', 'product_id', 'p-1'],
      ['ideas', 'order', 'created_at', { ascending: false }],
    ]);
  });

  it('reads the product\'s roadmaps, newest first (PRD 1364 s10)', async () => {
    const row = { id: 'r-1', number: 3, repo: 'vertuo/api', title: 'Spring', milestone: 'Beta', target_date: '2026-12-01', created_at: '2026-10-01T00:00:00Z' };
    const { calls, repo } = stub({ roadmaps: { data: [row] } });
    expect(await repo.roadmaps('ws-1', 'p-1')).toEqual([row]);
    expect(calls).toEqual([
      ['roadmaps', 'select', 'id, number, repo, title, milestone, target_date, created_at'], ['roadmaps', 'not', 'product_id', 'is', null],
      ['roadmaps', 'eq', 'workspace_id', 'ws-1'], ['roadmaps', 'eq', 'product_id', 'p-1'], ['roadmaps', 'order', 'created_at', { ascending: false }],
    ]);
  });

  it('reads the product\'s bug and visual fixes, newest first (PRD 1364 s10)', async () => {
    const rows = [
      { id: 'd-b', kind: 'bug', home_repo: 'vertuo/api', title: 'Crash on save', created_at: '2026-10-02T00:00:00Z' },
      { id: 'd-v', kind: 'visual', home_repo: 'vertuo/web', title: 'Darker sidebar', created_at: '2026-10-01T00:00:00Z' },
    ];
    const { calls, repo } = stub({ dossiers: { data: rows } });
    expect(await repo.fixes('ws-1', 'p-1')).toEqual(rows);
    expect(calls).toEqual([
      ['dossiers', 'select', 'id, kind, home_repo, title, created_at'], ['dossiers', 'in', 'kind', ['bug', 'visual']],
      ['dossiers', 'not', 'product_id', 'is', null], ['dossiers', 'eq', 'workspace_id', 'ws-1'], ['dossiers', 'eq', 'product_id', 'p-1'],
      ['dossiers', 'order', 'created_at', { ascending: false }],
    ]);
  });

  it('throws on a refused or out-of-shape read of the ideas, roadmaps or fixes', async () => {
    await expect(stub({ ideas: { error: { message: 'down' } } }).repo.ideas('ws-1', 'p-1')).rejects.toThrow('could not read the product\'s ideas (down)');
    await expect(stub({ roadmaps: { error: { message: 'down' } } }).repo.roadmaps('ws-1', 'p-1')).rejects.toThrow('could not read the product\'s roadmaps (down)');
    await expect(stub({ dossiers: { error: { message: 'down' } } }).repo.fixes('ws-1', 'p-1')).rejects.toThrow('could not read the product\'s fixes (down)');
    await expect(stub({ dossiers: { data: [{ id: 'd-1', kind: 'prd', home_repo: 'a/b', title: 'T', created_at: 'x' }] } }).repo.fixes('ws-1', 'p-1')).rejects.toThrow();
  });

  it('reads nothing for no repository and no dossier', async () => {
    const { calls, repo } = stub({});
    expect(await repo.stages('ws-1', [])).toEqual([]);
    expect(await repo.outbox('ws-1', [])).toEqual([]);
    expect(await repo.topics('ws-1', [])).toEqual([]);
    expect(await repo.approvals([])).toEqual([]);
    expect(await repo.voids([])).toEqual([]);
    expect(calls).toEqual([]);
  });

  it('throws on a refusal, naming the read', async () => {
    const { repo } = stub({ approval_requests_waiting: { error: { message: 'permission denied' } } });
    await expect(repo.waitingOnMe()).rejects.toThrow('could not read the approvals waiting on you (permission denied)');
    await expect(stub({ products: { error: { message: 'down' } } }).repo.product('ws-1', 'p-1')).rejects.toThrow('could not read the product (down)');
  });

  it('throws on an answer out of shape', async () => {
    const { repo } = stub({ dossiers: { data: [{ id: 'd-1', home_repo: 'vertuo/api', prd: null }] } });
    await expect(repo.prds('ws-1', 'p-1')).rejects.toThrow();
  });
});

import { describe, expect, it, vi } from 'vitest';
import { repositoriesTabRepository, type RepositoriesTabDb } from './repositories-tab.repository';

// The Repositories & approvers tab's storage (PRD 1364 s11) on a fake client: each read names its table
// and filter and parses its rows, a failed read throws, and each write calls its database function with
// every argument, answering the row it wrote or the database's code and words.

type Answer = { data?: unknown; error?: { code?: string; message: string } | null };

function db(answers: Record<string, Answer>) {
  const calls: unknown[] = [];
  const query = (answer: Answer) => {
    const q = {
      select: (...a: unknown[]) => { calls.push(['select', ...a]); return q; },
      eq: (...a: unknown[]) => { calls.push(['eq', ...a]); return q; },
      order: (...a: unknown[]) => { calls.push(['order', ...a]); return q; },
      in: (...a: unknown[]) => { calls.push(['in', ...a]); return q; },
      or: (...a: unknown[]) => { calls.push(['or', ...a]); return q; },
      not: (...a: unknown[]) => { calls.push(['not', ...a]); return q; },
      is: (...a: unknown[]) => { calls.push(['is', ...a]); return q; },
      then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve({ data: answer.data ?? null, error: answer.error ?? null }).then(ok, ko),
    };
    return q;
  };
  const fake = {
    calls,
    from: (table: string) => { calls.push(['from', table]); return query(answers[table] ?? {}); },
    rpc: (fn: string, args: unknown) => { calls.push(['rpc', fn, args]); const a = answers[fn] ?? {}; return Promise.resolve({ data: a.data ?? null, error: a.error ?? null }); },
  };
  return { fake, store: repositoriesTabRepository(fake as unknown as RepositoriesTabDb), calls };
}

const LINK = { product_id: 'p-1', workspace_id: 'w-1', repository: 'acme/api', role: 'api', knowledge: 'own', read_at: null, read_only: false, consumes: [], added_by: 'person', added_at: '2026-10-10T09:00:00Z', ladder_step: 4 };

describe('the reads', () => {
  it('reads the product by its id, or none', async () => {
    const { store, calls } = db({ products: { data: [{ id: 'p-1', workspace_id: 'w-1', name: 'Mobile', plan_repository: 'acme/plan' }] } });
    expect(await store.product('p-1')).toEqual({ id: 'p-1', workspace_id: 'w-1', name: 'Mobile', plan_repository: 'acme/plan' });
    expect(calls).toContainEqual(['eq', 'id', 'p-1']);
    expect(await db({ products: { data: [] } }).store.product('p-1')).toBeNull();
  });

  it('reads the product\'s links with who added each, by repository', async () => {
    const { store, calls } = db({ product_repositories: { data: [LINK] } });
    expect(await store.links('p-1')).toEqual([{ repository: 'acme/api', role: 'api', knowledge: 'own', read_at: null, read_only: false, consumes: [], added_by: 'person', ladder_step: 4 }]);
    expect(calls).toContainEqual(['select', expect.stringContaining('ladder_step')]);
    expect(calls).toContainEqual(['eq', 'product_id', 'p-1']);
    expect(calls).toContainEqual(['order', 'repository']);
  });

  it('reads the workspace\'s repositories, its owner flag, its members and the product\'s approvers', async () => {
    const { store, calls } = db({
      repositories: { data: [{ full_name: 'acme/api' }] },
      is_owner: { data: true },
      workspace_roster: { data: [{ user_id: 'u-1', name: 'Ada', github_login: 'ada', avatar_url: null, fleet: null }] },
      product_approvers: { data: [{ user_id: 'u-1', state: 'asked' }] },
    });
    expect(await store.repositories('w-1')).toEqual(['acme/api']);
    expect(await store.owner('w-1')).toBe(true);
    expect(await store.roster('w-1')).toMatchObject([{ user_id: 'u-1', name: 'Ada' }]);
    expect(await store.approvers('p-1')).toEqual([{ user_id: 'u-1', state: 'asked' }]);
    expect(calls).toContainEqual(['rpc', 'is_owner', { workspace: 'w-1' }]);
    expect(calls).toContainEqual(['rpc', 'workspace_roster', { workspace: 'w-1' }]);
  });

  it('throws when a read fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { store } = db({ product_repositories: { error: { message: 'down' } }, is_owner: { error: { message: 'down' } } });
    await expect(store.links('p-1')).rejects.toThrow('down');
    await expect(store.owner('w-1')).rejects.toThrow('down');
  });
});

describe('the writes', () => {
  it('links a repository with every field, answering the row it wrote', async () => {
    const { store, calls } = db({ product_repository_link: { data: LINK } });
    expect(await store.link('p-1', { repository: 'acme/api', role: null, knowledge: 'imported', read_at: 'a'.repeat(40), read_only: true, consumes: ['acme/web'] }))
      .toEqual({ ok: true, link: { repository: 'acme/api', role: 'api', knowledge: 'own', read_at: null, read_only: false, consumes: [], added_by: 'person', ladder_step: 4 } });
    expect(calls).toContainEqual(['rpc', 'product_repository_link', {
      p_product: 'p-1', p_repository: 'acme/api', p_role: undefined, p_knowledge: 'imported', p_read_at: 'a'.repeat(40), p_read_only: true, p_consumes: ['acme/web'],
    }]);
  });

  it('answers a refused write by its code and in its words', async () => {
    const { store } = db({
      product_repository_link: { error: { code: '22023', message: 'Role: X is not one kebab-case word.' } },
      product_repository_unlink: { error: { code: '42501', message: 'Only an owner.' } },
      product_approver_set: { error: { code: '22023', message: 'not a member' } },
      product_approver_remove: { error: { message: 'boom' } },
    });
    expect(await store.link('p-1', { repository: 'acme/api', role: 'X', knowledge: 'own', read_at: null, read_only: false, consumes: [] }))
      .toEqual({ ok: false, code: '22023', message: 'Role: X is not one kebab-case word.' });
    expect(await store.unlink('p-1', 'acme/api')).toEqual({ ok: false, code: '42501', message: 'Only an owner.' });
    expect(await store.setApprover('p-1', 'u-1', 'asked')).toEqual({ ok: false, code: '22023', message: 'not a member' });
    expect(await store.removeApprover('p-1', 'u-1')).toEqual({ ok: false, code: null, message: 'boom' });
  });

  it('unlinks, sets and removes through their functions', async () => {
    const { store, calls } = db({ product_repository_unlink: { data: true }, product_approver_set: { data: { state: 'skipped' } }, product_approver_remove: { data: false } });
    expect(await store.unlink('p-1', 'acme/api')).toEqual({ ok: true, removed: true });
    expect(await store.setApprover('p-1', 'u-1', 'skipped')).toEqual({ ok: true, state: 'skipped' });
    expect(await store.removeApprover('p-1', 'u-1')).toEqual({ ok: true, removed: false });
    expect(calls).toContainEqual(['rpc', 'product_repository_unlink', { p_product: 'p-1', p_repository: 'acme/api' }]);
    expect(calls).toContainEqual(['rpc', 'product_approver_set', { p_product: 'p-1', p_member: 'u-1', p_state: 'skipped' }]);
    expect(calls).toContainEqual(['rpc', 'product_approver_remove', { p_product: 'p-1', p_member: 'u-1' }]);
  });
});

describe('the records born in git (PRD 2011 s17)', () => {
  it('lists the PRDs not shipped, the bug records whose fix is not merged and the roadmaps with a PRD still open, born in the repository', async () => {
    const { store, calls } = db({
      dossiers: { data: [
        { id: 'd-1', prd: 2011, kind: 'prd' }, { id: 'd-2', prd: 7, kind: 'prd' },
        { id: 'd-3', prd: 1210, kind: 'bug' }, { id: 'd-4', prd: 1211, kind: 'bug' },
      ] },
      prd_stages: { data: [{ prd: 7 }] },
      fix_facts: { data: [{ dossier_id: 'd-4', facts: { pull: { state: 'merged' } } }, { dossier_id: 'd-3', facts: { pull: { state: 'open' } } }] },
      roadmaps: { data: [
        { number: 412, roadmap_prds: [{ state: 'merged' }, { state: 'building' }] },
        { number: 413, roadmap_prds: [{ state: 'merged' }, { state: 'closed' }] },
        { number: null, roadmap_prds: [{ state: 'building' }] },
      ] },
    });
    expect(await store.openBornInGit('w-1', 'acme/plan')).toEqual([
      { kind: 'prd', number: 2011 }, { kind: 'bug', number: 1210 }, { kind: 'roadmap', number: 412 },
    ]);
    expect(calls).toContainEqual(['eq', 'home_repo', 'acme/plan']);
    expect(calls).toContainEqual(['in', 'kind', ['prd', 'bug']]);
    expect(calls).toContainEqual(['or', 'birthplace.is.null,birthplace.eq.repo']);
    expect(calls).toContainEqual(['eq', 'stage', 'shipped']);
    expect(calls).toContainEqual(['in', 'dossier_id', ['d-3', 'd-4']]);
    expect(calls).toContainEqual(['eq', 'repo', 'acme/plan']);
    expect(calls).toContainEqual(['is', 'dossier_id', null]);
  });

  it('reads no fixes when no bug record is born there, and counts a fix whose facts are unread as not merged', async () => {
    const none = db({ dossiers: { data: [] }, roadmaps: { data: [] } });
    expect(await none.store.openBornInGit('w-1', 'acme/plan')).toEqual([]);
    expect(none.calls).not.toContainEqual(['from', 'fix_facts']);
    const unread = db({ dossiers: { data: [{ id: 'd-3', prd: 1210, kind: 'bug' }] }, fix_facts: { data: [{ dossier_id: 'd-3', facts: 'unread' }] }, roadmaps: { data: [] } });
    expect(await unread.store.openBornInGit('w-1', 'acme/plan')).toEqual([{ kind: 'bug', number: 1210 }]);
  });

  it('throws when any of its reads fails', async () => {
    for (const table of ['dossiers', 'prd_stages', 'roadmaps']) {
      const answers = { dossiers: { data: [] }, prd_stages: { data: [] }, roadmaps: { data: [] }, [table]: { error: { message: 'down' } } };
      await expect(db(answers).store.openBornInGit('w-1', 'acme/plan')).rejects.toThrow('down');
    }
    await expect(db({ dossiers: { data: [{ id: 'd-3', prd: 1, kind: 'bug' }] }, prd_stages: { data: [] }, fix_facts: { error: { message: 'down' } } }).store.openBornInGit('w-1', 'acme/plan')).rejects.toThrow('down');
  });

});

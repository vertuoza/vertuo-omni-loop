import { describe, expect, it } from 'vitest';
import { waitingBoardRepository, type WaitingBoardDb } from './waiting-board.repository';

// The Waiting board's storage (PRD 2377 s3), on a stubbed client (no test calls Supabase): each read's
// table, columns and filters, what it answers parsed, and a refusal or an answer out of shape thrown.

type Answer = { data?: unknown; error?: { message: string } | null };

function stub(answers: Record<string, Answer>) {
  const calls: unknown[][] = [];
  const query = (table: string) => {
    const answer = answers[table] ?? { data: [] };
    const q: Record<string, unknown> = {};
    for (const name of ['select', 'eq', 'in', 'is', 'not', 'gt', 'order', 'limit']) q[name] = (...a: unknown[]) => { calls.push([table, name, ...a]); return q; };
    q.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve({ data: answer.data ?? null, error: answer.error ?? null }).then(ok, ko);
    return q;
  };
  return { calls, repo: waitingBoardRepository({ from: (table: string) => query(table) } as unknown as WaitingBoardDb) };
}

const WAIT = { id: 'w-1', repo: 'acme/widgets', prd: 7, pr: 100, kind: 'review', turn: ['ada'], since: '2026-10-19T08:00:00Z' };

describe('the Waiting board\'s storage', () => {
  it('reads the workspace\'s open waits only', async () => {
    const { calls, repo } = stub({ waits: { data: [WAIT] } });
    expect(await repo.openWaits('ws-1')).toEqual([WAIT]);
    expect(calls).toEqual([['waits', 'select', 'id, repo, prd, pr, kind, turn, since'], ['waits', 'is', 'ended_at', null], ['waits', 'eq', 'workspace_id', 'ws-1']]);
  });

  it('reads the dossiers of the PRDs named, and none when it names none', async () => {
    const { calls, repo } = stub({ dossiers: { data: [{ id: 'd-7', home_repo: 'acme/widgets', prd: 7, title: 'Seven', opened_by: 'u-ada' }] } });
    expect(await repo.dossiers('ws-1', [])).toEqual([]);
    expect(calls).toEqual([]);
    expect(await repo.dossiers('ws-1', [7])).toEqual([{ id: 'd-7', home_repo: 'acme/widgets', prd: 7, title: 'Seven', opened_by: 'u-ada' }]);
    expect(calls.at(-1)).toEqual(['dossiers', 'in', 'prd', [7]]);
  });

  it('reads the open outbox questions of the PRDs named', async () => {
    const { calls, repo } = stub({ prd_outbox: { data: [{ repository: 'acme/widgets', prd: 7, open_questions: 2 }] } });
    expect(await repo.openQuestions('ws-1', [])).toEqual([]);
    expect(await repo.openQuestions('ws-1', [7])).toEqual([{ repository: 'acme/widgets', prd: 7, open_questions: 2 }]);
    expect(calls).toContainEqual(['prd_outbox', 'gt', 'open_questions', 0]);
  });

  it('reads when a repository was last synced from its newest prd stage, in lower case, or null', async () => {
    const { calls, repo } = stub({ prd_stages: { data: [{ repository: 'acme/widgets', synced_at: '2026-10-19T11:00:00Z' }] } });
    expect(await repo.lastSynced('ws-1', 'Acme/Widgets')).toBe('2026-10-19T11:00:00Z');
    expect(calls).toContainEqual(['prd_stages', 'eq', 'repository', 'acme/widgets']);
    expect(calls).toContainEqual(['prd_stages', 'eq', 'stage', 'prd']);
    expect(await stub({ prd_stages: { data: [] } }).repo.lastSynced('ws-1', 'acme/x')).toBeNull();
  });

  it('throws on a refusal and on an answer out of shape', async () => {
    await expect(stub({ waits: { error: { message: 'denied' } } }).repo.openWaits('ws-1')).rejects.toThrow('denied');
    await expect(stub({ waits: { data: [{ ...WAIT, kind: 'sulk' }] } }).repo.openWaits('ws-1')).rejects.toThrow();
  });
});

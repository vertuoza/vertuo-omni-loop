import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import type { Database } from '../../../../supabase/database.types';
import { loopRepository } from './loop.repository';

// repo_workspace() for the loop's reads (PRD 1665, s1), on a stubbed client: the workspace, or the
// database's reason why none.

function stubDb(answer: { data: unknown; error: { message: string } | null }) {
  const called: unknown[] = [];
  const db = { rpc: (fn: string, args: unknown) => { called.push([fn, args]); return Promise.resolve(answer); } };
  return { db: db as unknown as SupabaseClient<Database>, called };
}

describe('loopRepository.workspaceOf', () => {
  it('asks repo_workspace() for the person and the repository', async () => {
    const { db, called } = stubDb({ data: [{ workspace_id: 'w-acme', refusal: null }], error: null });
    expect(await loopRepository(db).workspaceOf('p-ada', 'acme/widgets')).toEqual({ workspace: 'w-acme' });
    expect(called).toEqual([['repo_workspace', { person: 'p-ada', repo: 'acme/widgets' }]]);
  });

  it('answers the database\'s reason when no workspace of the person owns it', async () => {
    const { db } = stubDb({ data: { workspace_id: null, refusal: 'Acme owns it; ask to join' }, error: null });
    expect(await loopRepository(db).workspaceOf('p-ada', 'acme/widgets')).toEqual({ refusal: 'Acme owns it; ask to join' });
  });

  it('answers plain words when the database gives no reason', async () => {
    const { db } = stubDb({ data: [], error: null });
    expect(await loopRepository(db).workspaceOf('p-ada', 'acme/widgets')).toEqual({ refusal: 'This repository is not in your workspace.' });
  });

  it('throws when the call fails', async () => {
    const { db } = stubDb({ data: null, error: { message: 'boom' } });
    await expect(loopRepository(db).workspaceOf('p-ada', 'acme/widgets')).rejects.toThrow('repo_workspace: boom');
  });
});

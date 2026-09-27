// The store and the migration agree: the store calls each function with exactly the parameters the
// migration declares, and the kinds and the cap it checks are the table's own. The rules themselves
// are proved by api.test.ts on the fake (which writes them as the migration does) and by
// supabase/checks/dossiers.sql on the database.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { ARTIFACT_MAX_BYTES, DOSSIER_KINDS, dossierStore, DossierStoreError, TITLE_MAX } from './store';

const MIGRATION = readFileSync(fileURLToPath(new URL('../../../../supabase/migrations/20260928090000_dossiers.sql', import.meta.url)), 'utf8');

/** The parameter names `create function public.<name>(…)` declares, in order. */
function parameters(name: string): string[] {
  const match = new RegExp(`create function public\\.${name}\\(([^)]*)\\)`).exec(MIGRATION);
  if (!match) throw new Error(`the migration declares no ${name}()`);
  return match[1].split(',').map((part) => part.trim().split(/\s+/)[0]);
}

/** A client that records each rpc call and answers `answer`. */
function recording(answer: { data: unknown; error: { code?: string; message: string } | null }) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const rpc = (name: string, args: Record<string, unknown>) => {
    calls.push({ name, args });
    return Promise.resolve(answer);
  };
  return { calls, db: { rpc } as never };
}

describe('the dossier store', () => {
  it('opens a draft through dossier_open(), with the migration\'s parameters', async () => {
    const { calls, db } = recording({ data: '00000000-0000-4000-8000-000000000001', error: null });
    expect(await dossierStore(db).open({ title: 'An idea', repo: 'acme/widgets', claudeSessionId: null })).toEqual({ id: '00000000-0000-4000-8000-000000000001' });
    expect(calls).toEqual([{ name: 'dossier_open', args: { p_title: 'An idea', p_repo: 'acme/widgets', p_claude_session_id: null } }]);
    expect(Object.keys(calls[0].args)).toEqual(parameters('dossier_open'));
  });

  it('pushes through dossier_push(), with the migration\'s parameters, and hands back what it did', async () => {
    const pushed = { id: '00000000-0000-4000-8000-000000000002', added: [{ kind: 'spec', version: 2 }], unchanged: ['plan'] };
    const { calls, db } = recording({ data: pushed, error: null });
    const push = { repo: 'acme/widgets', prd: 7, title: 'Team inbox', draftId: null, artifacts: [{ kind: 'spec' as const, content: 'x' }] };
    expect(await dossierStore(db).push(push)).toEqual(pushed);
    expect(Object.keys(calls[0].args)).toEqual(parameters('dossier_push'));
    expect(calls[0]).toEqual({
      name: 'dossier_push',
      args: { p_repo: 'acme/widgets', p_prd: 7, p_title: 'Team inbox', p_draft: null, p_artifacts: [{ kind: 'spec', content: 'x' }] },
    });
  });

  it('turns a refusal into a DossierStoreError carrying Postgres\'s code and reason', async () => {
    const { db } = recording({ data: null, error: { code: 'P0002', message: 'No such draft dossier.' } });
    const error = await dossierStore(db).push({ repo: 'a/b', prd: 1, title: 't', draftId: null, artifacts: [] }).catch((e) => e);
    expect(error).toBeInstanceOf(DossierStoreError);
    expect(error).toMatchObject({ code: 'P0002', reason: 'No such draft dossier.' });
  });

  it('checks the kinds, the cap and the title the table checks', () => {
    expect(MIGRATION).toContain(`kind in (${DOSSIER_KINDS.map((k) => `'${k}'`).join(', ')})`);
    expect(MIGRATION).toContain(`bytes between 0 and ${ARTIFACT_MAX_BYTES}`);
    expect(MIGRATION).toContain(`char_length(title) between 1 and ${TITLE_MAX}`);
  });
});

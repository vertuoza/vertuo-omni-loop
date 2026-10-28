import { describe, expect, it } from 'vitest';
import { SettingsRepositoryChosenSchema } from './omni-settings.contract';
import { chooseSettingsRepository, type SettingsRepositoryDeps } from './omni-settings.controller';
import { omniSettingsRepository, type OmniSettingsDb } from './omni-settings.repository';
import { omniSettingsChoiceService } from './omni-settings.service';

// POST /api/omni-settings/settings-repository (PRD 2543, s3), with a fake database behind the real
// service and repository: signed out is 401 before anything is read; a body that does not read is 400;
// the database function is called as the signed-in person with p_workspace and p_full_name (null to
// clear); 42501 answers 403, P0002 404, any other failure 502, and a save 200 with the stored name.

type Answer = { data: unknown; error: { message: string; code?: string } | null };

function world({ answer = { data: { settings_repository: 'acme/plans' }, error: null }, signedIn = true }: { answer?: Answer; signedIn?: boolean } = {}, database = true) {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const logged: string[] = [];
  const db = {
    rpc: (name: string, args: Record<string, unknown>) => { calls.push({ name, args }); return Promise.resolve(answer); },
  } as unknown as OmniSettingsDb;
  const service = omniSettingsChoiceService(omniSettingsRepository(db));
  const deps: SettingsRepositoryDeps = {
    session: database ? () => Promise.resolve(signedIn ? { service } : null) : null,
    log: (line) => { logged.push(line); },
  };
  return { deps, calls, logged };
}

const post = (deps: SettingsRepositoryDeps, body: unknown = { workspace: 'w-acme', repository: 'acme/plans' }) =>
  chooseSettingsRepository(new Request('https://omni.test/api/omni-settings/settings-repository', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body),
  }), deps);

describe('POST /api/omni-settings/settings-repository', () => {
  it('stores the repository through the database function as the caller, and answers the stored name', async () => {
    const { deps, calls } = world();
    const res = await post(deps);
    expect(res.status).toBe(200);
    expect(SettingsRepositoryChosenSchema.parse(await res.json())).toEqual({ repository: 'acme/plans' });
    expect(calls).toEqual([{ name: 'set_workspace_settings_repository', args: { p_workspace: 'w-acme', p_full_name: 'acme/plans' } }]);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('clears the choice with a null repository, and answers null', async () => {
    const { deps, calls } = world({ answer: { data: { settings_repository: null }, error: null } });
    const res = await post(deps, { workspace: 'w-acme', repository: null });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ repository: null });
    expect(calls[0]?.args).toEqual({ p_workspace: 'w-acme', p_full_name: null });
  });

  it('refuses a request with no session with 401, and reads nothing', async () => {
    const { deps, calls } = world({ signedIn: false });
    const res = await post(deps);
    expect(res.status).toBe(401);
    expect(calls).toEqual([]);
  });

  it('answers 503 where there is no database', async () => {
    expect((await post(world({}, false).deps)).status).toBe(503);
  });

  it('refuses a body that does not read with 400, and calls nothing', async () => {
    const { deps, calls } = world();
    const bodies = [
      '', 'not json', '[]', {}, { workspace: 'w' }, { workspace: '', repository: null }, { workspace: 'w', repository: '' },
      { workspace: 'w', repository: 'no-slash' }, { workspace: 'w', repository: 7 }, { workspace: 'w', repository: null, extra: 1 },
      { workspace: 'w', repository: `a/${'b'.repeat(3000)}` },
    ];
    for (const body of bodies) expect((await post(deps, body)).status).toBe(400);
    expect(calls).toEqual([]);
  });

  it('answers 403 when the database refuses a member (42501) and 404 for a repository the workspace does not list (P0002)', async () => {
    const forbidden = await post(world({ answer: { data: null, error: { message: 'not the owner', code: '42501' } } }).deps);
    expect(forbidden.status).toBe(403);
    expect(await forbidden.json()).toEqual({ error: 'Only the workspace’s owner can change it.' });
    const gone = await post(world({ answer: { data: null, error: { message: 'unknown', code: 'P0002' } } }).deps);
    expect(gone.status).toBe(404);
    expect(await gone.json()).toEqual({ error: 'That repository is no longer in this workspace. Reload the page.' });
  });

  it('answers 502, and logs why, for any other failure', async () => {
    const { deps, logged } = world({ answer: { data: null, error: { message: 'boom' } } });
    expect((await post(deps)).status).toBe(502);
    expect(logged).toEqual(['omni settings: choose the settings repository of w-acme: boom']);
  });

  it('answers 502 when the database answers a row that does not read', async () => {
    const { deps, logged } = world({ answer: { data: { odd: true }, error: null } });
    expect((await post(deps)).status).toBe(502);
    expect(logged).toHaveLength(1);
  });
});

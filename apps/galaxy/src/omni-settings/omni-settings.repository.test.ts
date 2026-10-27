import { describe, expect, it } from 'vitest';
import { omniSettingsRepository, type OmniSettingsDb } from './omni-settings.repository';

// The workspaces that list a repository (PRD 2417, s3), over a fake query builder: the live listing,
// then the workspaces' columns, the installation id as a number.

type Answer = { data: unknown; error: { message: string } | null };

function fakeDb(tables: Record<string, Answer>) {
  const calls: string[] = [];
  const db = {
    from(table: string) {
      const builder = {
        select: (columns: string) => { calls.push(`${table} select ${columns}`); return builder; },
        eq: (column: string, value: string) => { calls.push(`${table} eq ${column} ${value}`); return builder; },
        is: (column: string, value: null) => { calls.push(`${table} is ${column} ${String(value)}`); return builder; },
        in: (column: string, values: string[]) => { calls.push(`${table} in ${column} ${values.join(',')}`); return builder; },
        order: () => builder,
        // A supabase query builder is awaited.
        then: (resolve: (answer: Answer) => unknown) => resolve(tables[table] ?? { data: [], error: null }),
      };
      return builder;
    },
    rpc(name: string, args: Record<string, unknown>) {
      calls.push(`rpc ${name} ${JSON.stringify(args)}`);
      return Promise.resolve(tables[`rpc ${name}`] ?? { data: null, error: null });
    },
  };
  return { db: db as unknown as OmniSettingsDb, calls };
}

describe('omniSettingsRepository.isOwner (PRD 2417, s7)', () => {
  it('asks the database whether the caller owns the workspace', async () => {
    const { db, calls } = fakeDb({ 'rpc is_owner': { data: true, error: null } });
    expect(await omniSettingsRepository(db).isOwner('w1')).toBe(true);
    expect(calls).toEqual(['rpc is_owner {"workspace":"w1"}']);
  });

  it('reads anything but true as not the owner, and throws when the read fails', async () => {
    expect(await omniSettingsRepository(fakeDb({ 'rpc is_owner': { data: false, error: null } }).db).isOwner('w1')).toBe(false);
    expect(await omniSettingsRepository(fakeDb({}).db).isOwner('w1')).toBe(false);
    await expect(omniSettingsRepository(fakeDb({ 'rpc is_owner': { data: null, error: { message: 'boom' } } }).db).isOwner('w1')).rejects.toThrow('boom');
  });
});

describe('omniSettingsRepository.workspacesListing', () => {
  it('reads the live listings, then the workspaces they name', async () => {
    const { db, calls } = fakeDb({
      repositories: { data: [{ workspace_id: 'w1' }], error: null },
      workspaces: { data: [{ id: 'w1', github_org: 'acme', github_installation_id: '77', plan_repo: 'plan', settings_repository: null }], error: null },
    });
    expect(await omniSettingsRepository(db).workspacesListing('acme/app')).toEqual([{ id: 'w1', githubOrg: 'acme', installation: 77, planRepo: 'plan', settingsRepository: null }]);
    expect(calls).toContain('repositories is removed_at null');
    expect(calls).toContain('workspaces in id w1');
  });

  it('selects the chosen settings repository beside the plan repository (PRD 2543)', async () => {
    const { db, calls } = fakeDb({
      workspaces: { data: [{ id: 'w1', github_org: 'acme', github_installation_id: 77, plan_repo: 'plan', settings_repository: 'acme/playbook' }], error: null },
    });
    expect(await omniSettingsRepository(db).workspaceById('w1')).toEqual({ id: 'w1', githubOrg: 'acme', installation: 77, planRepo: 'plan', settingsRepository: 'acme/playbook' });
    expect(calls).toContain('workspaces select id, github_org, github_installation_id, plan_repo, settings_repository');
  });

  it('refuses a workspace row without the settings repository column', async () => {
    const { db } = fakeDb({ workspaces: { data: [{ id: 'w1', github_org: 'acme', github_installation_id: 77, plan_repo: 'plan' }], error: null } });
    await expect(omniSettingsRepository(db).workspaceById('w1')).rejects.toThrow();
  });

  it('answers none when no workspace lists it, and throws when a read fails', async () => {
    expect(await omniSettingsRepository(fakeDb({}).db).workspacesListing('acme/app')).toEqual([]);
    await expect(omniSettingsRepository(fakeDb({ repositories: { data: null, error: { message: 'boom' } } }).db).workspacesListing('acme/app')).rejects.toThrow('boom');
    await expect(
      omniSettingsRepository(fakeDb({ repositories: { data: [{ workspace_id: 'w1' }], error: null }, workspaces: { data: null, error: { message: 'bust' } } }).db).workspacesListing('acme/app'),
    ).rejects.toThrow('bust');
  });
});

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
        // eslint-disable-next-line unicorn/no-thenable -- a supabase query builder is awaited
        then: (resolve: (answer: Answer) => unknown) => resolve(tables[table] ?? { data: [], error: null }),
      };
      return builder;
    },
  };
  return { db: db as unknown as OmniSettingsDb, calls };
}

describe('omniSettingsRepository.workspacesListing', () => {
  it('reads the live listings, then the workspaces they name', async () => {
    const { db, calls } = fakeDb({
      repositories: { data: [{ workspace_id: 'w1' }], error: null },
      workspaces: { data: [{ id: 'w1', github_org: 'acme', github_installation_id: '77', plan_repo: 'plan' }], error: null },
    });
    expect(await omniSettingsRepository(db).workspacesListing('acme/app')).toEqual([{ id: 'w1', githubOrg: 'acme', installation: 77, planRepo: 'plan' }]);
    expect(calls).toContain('repositories is removed_at null');
    expect(calls).toContain('workspaces in id w1');
  });

  it('answers none when no workspace lists it, and throws when a read fails', async () => {
    expect(await omniSettingsRepository(fakeDb({}).db).workspacesListing('acme/app')).toEqual([]);
    await expect(omniSettingsRepository(fakeDb({ repositories: { data: null, error: { message: 'boom' } } }).db).workspacesListing('acme/app')).rejects.toThrow('boom');
    await expect(
      omniSettingsRepository(fakeDb({ repositories: { data: [{ workspace_id: 'w1' }], error: null }, workspaces: { data: null, error: { message: 'bust' } } }).db).workspacesListing('acme/app'),
    ).rejects.toThrow('bust');
  });
});

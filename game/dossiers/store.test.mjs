import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { dossierStore } from './store.mjs';
import { fakeDossiers } from './fake-supabase.mjs';

const VERTUOZA = 'a0000000-0000-4000-8000-000000000001';
const ACME = 'b0000000-0000-4000-8000-000000000002';
const COMMIT = 'c0ffee0000000000000000000000000000000001';
const BLOB = 'b10b000000000000000000000000000000000001';
const HOME = 'vertuoza/vertuo-omni-loop';

const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
const dossier = (id, over = {}) => ({ id, workspace_id: VERTUOZA, home_repo: HOME, prd: 216, title: 'PRD dossiers', opened_by: null, claude_session_id: null, created_at: '2026-09-27T08:00:00Z', numbered_at: '2026-09-27T08:00:00Z', ...over });
const version = (id, dossier_id, kind, content, created_at, over = {}) => ({ id, dossier_id, kind, content, sha256: sha256(content), bytes: Buffer.byteLength(content), source: 'kit', uploaded_by: 'u1', commit_sha: null, git_blob: null, created_at, ...over });

function world(tables = {}) {
  const fake = fakeDossiers(tables);
  return { fake, store: dossierStore({ url: 'https://x.supabase.co', key: 'service', fetch: fake.fetch }) };
}

describe('dossierStore: the fallback\'s one way into the dossier tables', () => {
  it('reads one repository\'s numbered dossiers of the workspace, each with the latest version of each kind', async () => {
    const { fake, store } = world({
      dossiers: [
        dossier('d-216'),
        dossier('d-draft', { prd: null, numbered_at: null }),
        dossier('d-other-repo', { home_repo: 'vertuoza/vertuo-core' }),
        dossier('d-acme', { workspace_id: ACME }),
        dossier('d-217', { prd: 217, title: 'Another' }),
      ],
      dossier_versions: [
        version('v1', 'd-216', 'spec', 'spec one', '2026-09-27T08:00:01Z'),
        version('v2', 'd-216', 'spec', 'spec two', '2026-09-27T08:00:03Z', { source: 'github', commit_sha: COMMIT, git_blob: BLOB }),
        version('v3', 'd-216', 'plan', 'plan one', '2026-09-27T08:00:02Z'),
      ],
    });
    const found = await store.dossiersOf(VERTUOZA, HOME);
    expect([...found.keys()]).toEqual([216, 217]);
    expect(found.get(216)).toEqual({
      id: 'd-216', prd: 216, title: 'PRD dossiers',
      latest: { spec: { id: 'v2', gitBlob: BLOB, bytes: 8 }, plan: { id: 'v3', gitBlob: null, bytes: 8 } },
    });
    expect(found.get(217).latest).toEqual({});
    const read = fake.calls.find((c) => c.path === 'dossiers');
    expect(read.headers.Authorization).toBe('Bearer service');
    expect(read.url.searchParams.get('select')).not.toContain('content'); // versions are read without their content
    expect((await store.dossiersOf(VERTUOZA, HOME, 217)).get(217).title).toBe('Another');
  });

  it('refuses to read or write without a workspace, before any call', async () => {
    const { fake, store } = world();
    await expect(store.dossiersOf('', HOME)).rejects.toThrow(/workspace/);
    await expect(store.open({ workspaceId: undefined, homeRepo: HOME, prd: 1, title: 't', at: '2026-09-27T09:00:00Z' })).rejects.toThrow(/workspace/);
    expect(fake.calls).toEqual([]);
  });

  it('opens a numbered dossier with the granted columns only, and answers null when its key is already taken', async () => {
    const { fake, store } = world();
    const opened = await store.open({ workspaceId: VERTUOZA, homeRepo: HOME, prd: 3, title: 'Ask mode', at: '2026-09-27T09:00:00Z' });
    expect(opened).toEqual({ id: expect.any(String), prd: 3, title: 'Ask mode', latest: {} });
    expect(fake.tables.dossiers).toEqual([expect.objectContaining({ id: opened.id, workspace_id: VERTUOZA, home_repo: HOME, prd: 3, numbered_at: '2026-09-27T09:00:00Z', opened_by: null })]);
    expect(await store.open({ workspaceId: VERTUOZA, homeRepo: HOME, prd: 3, title: 'Again', at: '2026-09-27T09:05:00Z' })).toBeNull();
    expect(fake.tables.dossiers).toHaveLength(1);
  });

  it('retitles a dossier', async () => {
    const { fake, store } = world({ dossiers: [dossier('d-216')] });
    await store.retitle('d-216', 'PRD dossiers, renamed');
    expect(fake.tables.dossiers[0].title).toBe('PRD dossiers, renamed');
  });

  it('adds a version only through the version rule, from GitHub with the commit and the blob, and says when nothing was added', async () => {
    const { fake, store } = world({ dossiers: [dossier('d-216')] });
    const add = (content) => store.addVersion({ dossierId: 'd-216', kind: 'spec', content, commitSha: COMMIT, gitBlob: BLOB });
    expect(await add('spec one')).toBe(1);
    expect(await add('spec one')).toBeNull();
    expect(await add('spec two')).toBe(2);
    expect(fake.tables.dossier_versions.map((v) => [v.content, v.source, v.commit_sha, v.git_blob, v.uploaded_by])).toEqual([
      ['spec one', 'github', COMMIT, BLOB, null],
      ['spec two', 'github', COMMIT, BLOB, null],
    ]);
    expect(fake.calls.filter((c) => c.method !== 'GET').map((c) => c.path)).toEqual(['rpc/dossier_add_version', 'rpc/dossier_add_version', 'rpc/dossier_add_version']);
  });

  it('reads one version\'s content', async () => {
    const { store } = world({ dossiers: [dossier('d-216')], dossier_versions: [version('v1', 'd-216', 'spec', 'the spec', '2026-09-27T08:00:01Z')] });
    expect(await store.content('v1')).toBe('the spec');
    expect(await store.content('v-missing')).toBeNull();
  });

  it('throws, naming what failed and why, on a refusal or no answer', async () => {
    const { store } = world({ dossiers: [dossier('d-216')] });
    await expect(store.addVersion({ dossierId: 'd-216', kind: 'spec', content: 'x'.repeat(524289), commitSha: COMMIT, gitBlob: BLOB }))
      .rejects.toThrow(/Supabase: add a spec version failed \(400.*512 KiB/);
    await expect(store.retitle('d-216', '')).rejects.toThrow(/Supabase: retitle a dossier failed \(400/);
    const down = dossierStore({ url: 'https://x.supabase.co', key: 'k', fetch: async () => { throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } }); } });
    await expect(down.addVersion({ dossierId: 'd', kind: 'plan', content: 'p', commitSha: COMMIT, gitBlob: BLOB })).rejects.toThrow(/ECONNREFUSED/);
  });
});

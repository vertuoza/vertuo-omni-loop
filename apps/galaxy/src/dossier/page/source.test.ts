import { describe, it, expect, vi } from 'vitest';
import { FAKE_WORKSPACE, fakeSupabase } from '../store.fake';
import { deleteDraft, readContent, readDossier, readSandboxed } from './source';

// Where /prd/<id> reads: straight from the database as the viewer (the stubbed client of
// ../store.fake.ts, which keeps the migration's access rules), so a member of the dossier's workspace
// reads it and anyone else reads nothing, exactly as if it never was.

const ADA = { id: '00000000-0000-4000-8000-0000000000a1', email: 'ada@vertuoza.com', name: 'ADA' };
const BOB = { id: '00000000-0000-4000-8000-0000000000b1', email: 'bob@vertuoza.com' };
const OTHER = '00000000-0000-4000-8000-00000000aced';
const CARL = { id: '00000000-0000-4000-8000-0000000000c1', email: 'carl@vertuoza.com', workspaces: [OTHER] };
const MISSING = '00000000-0000-4000-8000-00000000ffff';

const SPEC = '---\nprd: 7\n---\n# Team inbox\n';
const PAGE = '<!doctype html><title>v1</title>';

async function world() {
  let now = Date.parse('2026-09-28T09:00:00Z');
  const fake = fakeSupabase({ ada: ADA, bob: BOB, carl: CARL }, { [FAKE_WORKSPACE]: 'acme', [OTHER]: 'other' }, () => (now += 1000));
  const as = (token: string | null) => fake.client(token ?? 'nobody') as never;
  const { data: draftId } = await fake.client('ada').rpc('dossier_open', { p_title: 'An idea', p_repo: 'acme/widgets', p_claude_session_id: null });
  const pushed = await fake.client('ada').rpc('dossier_push', {
    p_repo: 'acme/widgets', p_prd: 7, p_title: 'Team inbox', p_draft: null,
    p_artifacts: [{ kind: 'spec', content: SPEC }, { kind: 'before-after', content: PAGE }],
  });
  await fake.client('bob').rpc('dossier_push', {
    p_repo: 'acme/widgets', p_prd: 7, p_title: 'Team inbox', p_draft: null,
    p_artifacts: [{ kind: 'before-after', content: '<!doctype html><title>v2</title>' }],
  });
  return { fake, as, draft: draftId as string, numbered: (pushed.data as { id: string }).id };
}

describe('reading a dossier as the viewer', () => {
  it('gives a member the dossier, its versions oldest first, and its workspace\'s members', async () => {
    const { as, numbered } = await world();
    const read = await readDossier(as('bob'), numbered);
    expect(read?.dossier).toMatchObject({ id: numbered, prd: 7, title: 'Team inbox', home_repo: 'acme/widgets', opened_by: ADA.id });
    expect(read?.versions.map((v) => [v.kind, v.uploaded_by])).toEqual([['spec', ADA.id], ['before-after', ADA.id], ['before-after', BOB.id]]);
    expect(read?.versions[0]).not.toHaveProperty('content');
    expect(read?.members.map((m) => m.email).sort()).toEqual(['ada@vertuoza.com', 'bob@vertuoza.com']);
  });

  it('gives a member of another workspace nothing, as if it never was', async () => {
    const { as, numbered } = await world();
    expect(await readDossier(as('carl'), numbered)).toBeNull();
    expect(await readDossier(as('carl'), MISSING)).toBeNull();
  });

  it('gives someone signed out nothing', async () => {
    const { as, numbered } = await world();
    expect(await readDossier(as(null), numbered)).toBeNull();
  });

  it('reads nothing for an id that is not a dossier\'s', async () => {
    const { fake, as } = await world();
    const before = fake.state.calls;
    expect(await readDossier(as('ada'), 'not-a-uuid')).toBeNull();
    expect(fake.state.calls).toBe(before);
  });

  it('names nobody when the members cannot be read, and still shows the dossier', async () => {
    const { fake, numbered } = await world();
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    const client = fake.client('ada');
    const read = await readDossier({ from: client.from, rpc: async () => ({ data: null, error: { message: 'down' } }) } as never, numbered);
    expect(read?.members).toEqual([]);
    expect(read?.dossier.id).toBe(numbered);
    quiet.mockRestore();
  });
});

describe('reading a version', () => {
  it('reads one version\'s content for a member, and nothing for anyone else', async () => {
    const { as, numbered } = await world();
    const spec = (await readDossier(as('ada'), numbered))!.versions[0];
    expect(await readContent(as('bob'), spec.id)).toBe(SPEC);
    expect(await readContent(as('carl'), spec.id)).toBeNull();
    expect(await readContent(as(null), spec.id)).toBeNull();
  });

  it('serves the before/after page by its number, to a member only', async () => {
    const { as, numbered } = await world();
    expect(await readSandboxed(as('bob'), numbered, 1)).toBe(PAGE);
    expect(await readSandboxed(as('bob'), numbered, 2)).toBe('<!doctype html><title>v2</title>');
    expect(await readSandboxed(as('bob'), numbered, 3)).toBeNull();
    expect(await readSandboxed(as('carl'), numbered, 1)).toBeNull();
    expect(await readSandboxed(as(null), numbered, 1)).toBeNull();
    expect(await readSandboxed(as('bob'), 'not-a-uuid', 1)).toBeNull();
    expect(await readSandboxed(as('bob'), numbered, 0)).toBeNull();
  });
});

describe('deleting a draft', () => {
  it('lets its opener delete it', async () => {
    const { fake, as, draft } = await world();
    expect(await deleteDraft(as('ada'), draft)).toBe(true);
    expect(fake.tables.dossiers.some((d) => d.id === draft)).toBe(false);
    expect(await readDossier(as('ada'), draft)).toBeNull();
  });

  it('lets no other member delete it', async () => {
    const { fake, as, draft } = await world();
    expect(await deleteDraft(as('bob'), draft)).toBe(false);
    expect(await deleteDraft(as('carl'), draft)).toBe(false);
    expect(await deleteDraft(as(null), draft)).toBe(false);
    expect(fake.tables.dossiers.some((d) => d.id === draft)).toBe(true);
  });

  it('lets nobody delete a numbered dossier, not even its opener', async () => {
    const { fake, as, numbered } = await world();
    expect(await deleteDraft(as('ada'), numbered)).toBe(false);
    expect(fake.tables.dossier_versions.filter((v) => v.dossier_id === numbered)).toHaveLength(3);
  });
});

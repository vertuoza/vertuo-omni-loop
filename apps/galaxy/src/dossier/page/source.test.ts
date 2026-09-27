import { describe, it, expect, vi } from 'vitest';
import { dossierRounds } from '../store';
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

describe('reading the questions that shaped it', () => {
  const at = (hhmm: string) => `2026-09-28T${hhmm}:00.000Z`;

  /** Ada opens a dossier at 09:00 in the Claude session sess-a, numbered PRD 7, and another at 12:00 in
   * the same Claude session; then questions are asked in every way the rules tell apart. */
  async function asked() {
    let now = Date.parse(at('09:00'));
    const fake = fakeSupabase({ ada: ADA, bob: BOB, carl: CARL }, { [FAKE_WORKSPACE]: 'acme', [OTHER]: 'other' }, () => now);
    const as = (token: string | null) => fake.client(token ?? 'nobody') as never;
    const open = async (title: string) =>
      (await fake.client('ada').rpc('dossier_open', { p_title: title, p_repo: 'acme/widgets', p_claude_session_id: 'sess-a' })).data as string;
    const inbox = await open('Team inbox');
    await fake.client('ada').rpc('dossier_push', { p_repo: 'acme/widgets', p_prd: 7, p_title: 'Team inbox', p_draft: inbox, p_artifacts: [] });
    now = Date.parse(at('12:00'));
    const roster = await open('Team roster');
    const ids = (seeded: { rounds: Array<{ id: string }> }) => seeded.rounds.map((r) => r.id);
    const [before, brainstorm, both, later] = ids(fake.seedAsk({ owner: ADA.id, repo: 'Acme/Widgets', branch: 'main', claudeSessionId: 'sess-a' }, [
      { created_at: at('08:00') },
      { created_at: at('09:30'), status: 'answered', answers: { 'A question?': 'Yes' }, answered_via: 'terminal', answered_by: ADA.id, answered_at: at('09:31') },
      { created_at: at('10:00'), prd: 7 },
      { created_at: at('12:30') },
    ]));
    const [delivery, other] = ids(fake.seedAsk({ owner: BOB.id, repo: 'acme/widgets', branch: 'feat/team-inbox--s2', claudeSessionId: 'sess-b' }, [
      { created_at: at('15:00'), prd: 7, skill: '/omni:do-work', category: 'product', category_by: 'model' },
      { created_at: at('15:30'), prd: 8 },
    ]));
    const [gadgets] = ids(fake.seedAsk({ owner: BOB.id, repo: 'acme/gadgets' }, [{ created_at: at('16:00'), prd: 7 }]));
    const [elsewhere] = ids(fake.seedAsk({ owner: CARL.id, workspace: OTHER, repo: 'acme/widgets', claudeSessionId: 'sess-a' }, [{ created_at: at('10:30'), prd: 7 }]));
    return { fake, as, inbox, roster, round: { before, brainstorm, both, later, delivery, other, gadgets, elsewhere } };
  }

  it('gives a member the brainstorm rounds and the delivery rounds, once each, in the order they were asked', async () => {
    const { as, inbox, round } = await asked();
    const read = await readDossier(as('bob'), inbox);
    expect(read?.rounds?.map((r) => [r.round_id, r.rule])).toEqual([
      [round.brainstorm, 'brainstorm'],
      [round.both, 'brainstorm'],
      [round.delivery, 'delivery'],
    ]);
    expect(read?.rounds?.[2]).toMatchObject({
      asked_by: BOB.id, repo: 'acme/widgets', branch: 'feat/team-inbox--s2', prd: 7, skill: '/omni:do-work', category: 'product', status: 'open',
    });
    expect(read?.rounds?.[0]).toMatchObject({ status: 'answered', answered_by: ADA.id, answered_via: 'terminal', answers: { 'A question?': 'Yes' } });
  });

  it('ends a brainstorm where its Claude session opened its next dossier', async () => {
    const { as, roster, round } = await asked();
    expect((await readDossier(as('ada'), roster))?.rounds?.map((r) => [r.round_id, r.rule])).toEqual([[round.later, 'brainstorm']]);
  });

  it('gives nothing to someone who cannot read the dossier', async () => {
    const { as, inbox } = await asked();
    expect(await readDossier(as('carl'), inbox)).toBeNull();
    expect(await dossierRounds(as('carl'), inbox)).toEqual([]);
    expect(await dossierRounds(as(null), inbox)).toEqual([]);
  });

  it('still shows the dossier when its questions cannot be read, saying so', async () => {
    const { fake, inbox } = await asked();
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    const client = fake.client('bob');
    const failing = {
      from: client.from,
      rpc: (name: string, args: Record<string, unknown>) =>
        name === 'dossier_rounds' ? Promise.resolve({ data: null, error: { message: 'down' } }) : client.rpc(name, args),
    };
    const read = await readDossier(failing as never, inbox);
    expect(read?.dossier.id).toBe(inbox);
    expect(read?.rounds).toBeNull();
    quiet.mockRestore();
  });
});

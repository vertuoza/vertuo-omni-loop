import { describe, it, expect, vi } from 'vitest';
import { dossierRounds } from '../store';
import { FAKE_WORKSPACE, fakeSupabase } from '../store.fake';
import { pulseOf, signature } from './live';
import { fakeSupabase as askFake } from '../../ask/store.fake';
import { answerQuick, deleteDraft, readContent, readDossier, readHistory, readPlanSlices, readPulse, readSandboxed } from './source';

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
    expect(await readContent(as('bob'), spec!.id)).toBe(SPEC);
    expect(await readContent(as('carl'), spec!.id)).toBeNull();
    expect(await readContent(as(null), spec!.id)).toBeNull();
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

  it('serves a visual fix\'s round of variations by its number, apart from its before/after page (PRD 627)', async () => {
    const { fake, as } = await world();
    const pushed = await fake.client('ada').rpc('dossier_push', {
      p_repo: 'acme/widgets', p_prd: 548, p_kind: 'visual', p_title: 'Darker sidebar', p_draft: null,
      p_artifacts: [{ kind: 'before-after', content: PAGE }, { kind: 'variations', content: '<title>r1</title>' }, { kind: 'variations', content: '<title>r2</title>' }],
    });
    const fix = (pushed.data as { id: string }).id;
    expect(await readSandboxed(as('bob'), fix, 2, 'variations')).toBe('<title>r2</title>');
    expect(await readSandboxed(as('bob'), fix, 1, 'variations')).toBe('<title>r1</title>');
    expect(await readSandboxed(as('bob'), fix, 1)).toBe(PAGE);
    expect(await readSandboxed(as('bob'), fix, 3, 'variations')).toBeNull();
    expect(await readSandboxed(as('carl'), fix, 1, 'variations')).toBeNull();
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

describe('reading the history', () => {
  const at = (hhmm: string) => `2026-09-28T${hhmm}:00.000Z`;

  /** Acme's plan repository is acme/plans. Ada opens a draft of it at 08:00, then at 09:00, in the Claude
   * session sess-a, the dossier a push numbers PRD 7; a brainstorm question is asked in Acme/Gadgets and
   * answered, a delivery question at 11:00 in its home repository; PRD 7's planet is surveyed in widgets,
   * gadgets (twice, once in another case) and core. Bob pushes PRD 7 of acme/widgets at 10:00. Carl's
   * workspace keeps a PRD 7 of its own plan repository, its planet surveyed in secret. */
  async function history() {
    let now = Date.parse(at('08:00'));
    const fake = fakeSupabase({ ada: ADA, bob: BOB, carl: CARL }, { [FAKE_WORKSPACE]: 'acme', [OTHER]: 'other' }, () => now);
    const as = (token: string | null) => fake.client(token ?? 'nobody') as never;
    const open = async (title: string, session: string | null) =>
      (await fake.client('ada').rpc('dossier_open', { p_title: title, p_repo: 'acme/plans', p_claude_session_id: session })).data as string;
    const push = async (token: string, repo: string, title: string, draft: string | null, artifacts: unknown[] = []) =>
      ((await fake.client(token).rpc('dossier_push', { p_repo: repo, p_prd: 7, p_title: title, p_draft: draft, p_artifacts: artifacts })).data as { id: string }).id;
    const draft = await open('Grout colours', null);
    now = Date.parse(at('09:00'));
    const reminders = await push('ada', 'acme/plans', 'Invoice reminders', await open('Reminders', 'sess-a'), [{ kind: 'spec', content: 'spec one' }]);
    now = Date.parse(at('10:00'));
    const widgets = await push('bob', 'acme/widgets', 'Widget sizes', null);
    const elsewhere = await push('carl', 'other/stuff', 'Elsewhere', null);
    fake.seedPlanet({ planRepo: 'plans', prd: 7, regions: ['widgets', 'Gadgets', 'gadgets', 'core'] });
    fake.seedPlanet({ workspace: OTHER, planRepo: 'stuff', prd: 7, regions: ['secret'] });
    fake.seedAsk({ owner: ADA.id, repo: 'Acme/Gadgets', claudeSessionId: 'sess-a' }, [
      { created_at: at('09:30'), status: 'answered', answers: { 'A question?': 'Yes' }, answered_via: 'terminal', answered_by: ADA.id, answered_at: at('09:31') },
    ]);
    fake.seedAsk({ owner: BOB.id, repo: 'Acme/Plans', branch: 'feat/invoice-reminders--s1' }, [{ created_at: at('11:00'), prd: 7 }]);
    return { fake, as, draft, reminders, widgets, elsewhere };
  }

  it('gives a member every dossier of their workspace, newest activity first, each with its repositories, versions and counts', async () => {
    const { as, draft, reminders, widgets } = await history();
    const rows = await readHistory(as('bob'));
    expect(rows.map((r) => r.id)).toEqual([reminders, widgets, draft]);
    expect(rows[0]).toMatchObject({
      prd: 7, title: 'Invoice reminders', home_repo: 'acme/plans',
      repos: ['acme/plans', 'acme/core', 'acme/gadgets', 'acme/widgets'],
      latest: { spec: { version: 1, source: 'kit' } }, asked: 2, answered: 1, last_activity: at('11:00'),
    });
    expect(rows[0]!.latest.plan).toBeUndefined();
    expect(rows[1]).toMatchObject({ repos: ['acme/widgets'], latest: {}, asked: 0, answered: 0, last_activity: at('10:00') });
    expect(rows[2]).toMatchObject({ prd: null, repos: ['acme/plans'], last_activity: at('08:00') });
  });

  it('gives a member of another workspace its own dossiers alone, and someone signed out nothing', async () => {
    const { as, elsewhere } = await history();
    expect((await readHistory(as('carl'))).map((r) => [r.id, r.repos])).toEqual([[elsewhere, ['other/stuff', 'other/secret']]]);
    expect(await readHistory(as(null))).toEqual([]);
  });

  it('chips a dossier\'s repositories on its page, and its home repository alone when they cannot be read', async () => {
    const { fake, as, reminders } = await history();
    expect((await readDossier(as('bob'), reminders))?.repos).toEqual(['acme/plans', 'acme/core', 'acme/gadgets', 'acme/widgets']);
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    const client = fake.client('bob');
    const failing = {
      from: client.from,
      rpc: (name: string, args: Record<string, unknown>) =>
        name === 'dossier_list' ? Promise.resolve({ data: null, error: { message: 'down' } }) : client.rpc(name, args),
    };
    const read = await readDossier(failing as never, reminders);
    expect(read?.repos).toBeNull();
    expect(read?.rounds).toHaveLength(2);
    quiet.mockRestore();
  });
});

describe('reading the change check (PRD 384)', () => {
  it('reads the counts and the latest versions a member sees, and moves when a round is asked, answered or a version pushed', async () => {
    const { fake, as, numbered } = await world();
    const first = await readPulse(as('bob'), numbered);
    expect(first).toEqual({ asked: 0, answered: 0, latest: { spec: 1, 'before-after': 2 } });

    const [round] = fake.seedAsk({ owner: ADA.id, repo: 'acme/widgets' }, [{ created_at: '2026-09-28T10:00:00.000Z', prd: 7 }]).rounds;
    const asked = await readPulse(as('bob'), numbered);
    expect(asked).toMatchObject({ asked: 1, answered: 0 });
    expect(signature(asked)).not.toBe(signature(first));

    Object.assign(round!, { status: 'answered', answers: { 'A question?': 'Yes' }, answered_at: '2026-09-28T10:01:00.000Z' });
    const answered = await readPulse(as('bob'), numbered);
    expect(answered).toMatchObject({ asked: 1, answered: 1 });
    expect(signature(answered)).not.toBe(signature(asked));

    await fake.client('ada').rpc('dossier_push', {
      p_repo: 'acme/widgets', p_prd: 7, p_title: 'Team inbox', p_draft: null, p_artifacts: [{ kind: 'plan', content: '# Plan' }],
    });
    const pushed = await readPulse(as('bob'), numbered);
    expect(pushed?.latest).toEqual({ spec: 1, plan: 1, 'before-after': 2 });
    expect(signature(pushed)).not.toBe(signature(answered));
    expect(signature(await readPulse(as('bob'), numbered))).toBe(signature(pushed));
  });

  it('agrees with what the page rendered, so a page read and a check of the same dossier match', async () => {
    const { fake, as, numbered } = await world();
    fake.seedAsk({ owner: ADA.id, repo: 'acme/widgets' }, [
      { created_at: '2026-09-28T10:00:00.000Z', prd: 7, status: 'answered', answered_at: '2026-09-28T10:01:00.000Z' },
      { created_at: '2026-09-28T10:02:00.000Z', prd: 7 },
    ]);
    const read = await readDossier(as('bob'), numbered);
    expect(signature(pulseOf(read!))).toBe(signature(await readPulse(as('bob'), numbered)));
  });

  it('reads nothing for someone who cannot read the dossier, or an id that is not a dossier\'s', async () => {
    const { fake, as, numbered } = await world();
    expect(await readPulse(as('carl'), numbered)).toBeNull();
    expect(await readPulse(as(null), numbered)).toBeNull();
    const calls = fake.state.calls;
    expect(await readPulse(as('bob'), 'not-a-uuid')).toBeNull();
    expect(fake.state.calls).toBe(calls);
  });
});

describe('who may answer a round on the list (PRD 384), decided on the server', () => {
  const DORA = { id: '00000000-0000-4000-8000-0000000000d7', email: 'dora@vertuoza.com' };
  const ACCOUNTS = { ada: ADA, bob: BOB, dora: DORA };

  async function asked() {
    const fake = fakeSupabase(ACCOUNTS, { [FAKE_WORKSPACE]: 'acme' });
    const pushed = await fake.client('ada').rpc('dossier_push', {
      p_repo: 'acme/widgets', p_prd: 7, p_title: 'Team inbox', p_draft: null, p_artifacts: [{ kind: 'spec', content: SPEC }],
    });
    const id = (pushed.data as { id: string }).id;
    const [shared, own, done] = fake.seedAsk({ owner: ADA.id, repo: 'acme/widgets' }, [
      { created_at: '2026-09-28T10:00:00.000Z', prd: 7 },
      { created_at: '2026-09-28T10:01:00.000Z', prd: 7 },
      { created_at: '2026-09-28T10:02:00.000Z', prd: 7, status: 'answered', answers: { 'A question?': 'Yes' } },
    ]).rounds.map((r) => r.id);
    fake.seedShare(shared!, BOB.id, ADA.id);
    fake.seedShare(done!, BOB.id, ADA.id);
    const read = async (token: keyof typeof ACCOUNTS) => (await readDossier(fake.client(token) as never, id, ACCOUNTS[token].id))?.answerable;
    return { fake, id, read, shared, own };
  }

  it("lets the session's owner answer every open round of it", async () => {
    const { read, shared, own } = await asked();
    expect(await read('ada')).toEqual([shared, own]);
  });

  it('lets a member answer only the open rounds shared with them', async () => {
    const { read, shared } = await asked();
    expect(await read('bob')).toEqual([shared]);
  });

  it('lets any other member answer nothing', async () => {
    const { read } = await asked();
    expect(await read('dora')).toEqual([]);
  });

  it('lets nobody answer when the viewer is not named', async () => {
    const { fake, id } = await asked();
    expect((await readDossier(fake.client('ada') as never, id))?.answerable).toEqual([]);
  });

  it('still lets the owner answer when the shares cannot be read, and nobody else', async () => {
    const { fake, id, own, shared } = await asked();
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failing = (token: string) => {
      const client = fake.client(token);
      return {
        rpc: client.rpc,
        from: (table: string) => (table === 'ask_shares'
          ? { select: () => ({ eq: async () => ({ data: null, error: { message: 'down' } }) }) }
          : client.from(table as 'dossiers')),
      } as never;
    };
    expect((await readDossier(failing('ada'), id, ADA.id))?.answerable).toEqual([shared, own]);
    expect((await readDossier(failing('bob'), id, BOB.id))?.answerable).toEqual([]);
    quiet.mockRestore();
  });
});

describe('answering a quick round from the list (PRD 384)', () => {
  const QUESTION = 'Which storage?';
  const START = Date.parse('2026-09-28T09:00:00Z');

  async function round() {
    const fake = askFake({ ada: ADA, bob: BOB }, () => START);
    const ada = fake.client('ada');
    const { data: session } = await ada.from('ask_sessions').insert({ title: 'omni' }).select('id').single() as { data: { id: string } };
    const questions = [{ question: QUESTION, header: '', multiSelect: false, options: [{ label: 'Postgres (Recommended)' }, { label: 'Memory' }] }];
    const { data } = await ada.from('ask_rounds').insert({ session_id: session.id, questions }).select('id').single() as { data: { id: string } };
    return { fake, id: data.id, as: (token: string) => fake.client(token) as never };
  }

  it('records the option as the answer, answered on the page', async () => {
    const { fake, id, as } = await round();
    expect(await answerQuick(as('ada'), id, QUESTION, 'Postgres (Recommended)')).toEqual({ kind: 'answered' });
    expect(fake.tables.ask_rounds[0]).toMatchObject({
      status: 'answered', answers: { [QUESTION]: 'Postgres (Recommended)' }, answered_via: 'page', answered_by: ADA.id,
    });
  });

  it('says who came first when the round was answered already, and changes nothing', async () => {
    const { fake, id, as } = await round();
    await answerQuick(as('ada'), id, QUESTION, 'Memory');
    expect(await answerQuick(as('ada'), id, QUESTION, 'Postgres (Recommended)')).toEqual({ kind: 'taken', by: ADA.id, via: 'page', moved: false });
    expect(fake.tables.ask_rounds[0]).toMatchObject({ answers: { [QUESTION]: 'Memory' } });
  });

  it('says it moved when the terminal took it over', async () => {
    const { fake, id, as } = await round();
    fake.tables.ask_rounds[0]!.status = 'abandoned';
    expect(await answerQuick(as('ada'), id, QUESTION, 'Memory')).toMatchObject({ kind: 'taken', by: null, moved: true });
  });

  it('answers nothing for a member it is not shared with', async () => {
    const { fake, id, as } = await round();
    expect(await answerQuick(as('bob'), id, QUESTION, 'Memory')).toMatchObject({ kind: 'taken', by: null });
    expect(fake.tables.ask_rounds[0]).toMatchObject({ status: 'open', answers: null });
  });

  it('throws when the database cannot be reached', async () => {
    const { fake, id, as } = await round();
    fake.state.fail = { message: 'down' };
    await expect(answerQuick(as('ada'), id, QUESTION, 'Memory')).rejects.toThrow();
  });
});

describe('the plan\'s slice count, for the stage (PRD 426)', () => {
  const PLAN = (rows: string[]) => `# Plan\n\n| id | slice | territory | blocked by | wave |\n| --- | --- | --- | --- | --- |\n${rows.join('\n')}\n`;
  const row = (id: string) => `| ${id} | A slice | \`src/${id}\` | — | 1 |`;

  it('counts the slices of the latest plan version', async () => {
    const { fake, as, numbered } = await world();
    for (const plan of [PLAN([row('s1')]), PLAN([row('s1'), row('s2'), row('s3')])]) {
      await fake.client('ada').rpc('dossier_push', { p_repo: 'acme/widgets', p_prd: 7, p_title: 'Team inbox', p_draft: null, p_artifacts: [{ kind: 'plan', content: plan }] });
    }
    const read = await readDossier(as('bob'), numbered);
    expect(await readPlanSlices(as('bob'), read!.versions)).toBe(3);
  });

  it('is null with no plan version, or one with no slice table', async () => {
    const { fake, as, numbered } = await world();
    expect(await readPlanSlices(as('bob'), (await readDossier(as('bob'), numbered))!.versions)).toBeNull();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await fake.client('ada').rpc('dossier_push', { p_repo: 'acme/widgets', p_prd: 7, p_title: 'Team inbox', p_draft: null, p_artifacts: [{ kind: 'plan', content: '# Plan\n\nNo table.\n' }] });
    expect(await readPlanSlices(as('bob'), (await readDossier(as('bob'), numbered))!.versions)).toBeNull();
    vi.restoreAllMocks();
  });
});

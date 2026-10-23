import { describe, it, expect, vi } from 'vitest';
import { assertDefined } from 'omni-loop/kit/test/assert.ts';
import { dossierRounds } from '../store';
import { FAKE_WORKSPACE, fakeSupabase } from '../store.fake';
import { pulseOf, signature } from './live';
import { fakeSupabase as askFake } from '../../ask/store.fake';
import { answerQuick, deleteDraft, readContent, readDossier, readHistory, readPlanSlices, readPulse, readSandboxed, startListScope } from './source';
import { parsePrd } from 'omni-loop/kit/lib/ids.ts';
import { createTimings } from './timing';
import { createElement, type ReactElement } from 'react';
import { prerender } from 'react-dom/static';
import { WithLateParts, shellOf } from './DossierRoute';
import { approvalView } from './approval';
import { DEMO_VIEWER, demoDossier } from './demo';

vi.mock('server-only', () => ({}));

// Where /prd/<id> reads: straight from the database as the viewer (the stubbed client of
// ../store.fake.ts, which keeps the migration's access rules), so a member of the dossier's workspace
// reads it and anyone else reads nothing, exactly as if it never was.

const ADA = { id: '00000000-0000-4000-8000-0000000000a1', email: 'ada@example.com', name: 'ADA' };
const BOB = { id: '00000000-0000-4000-8000-0000000000b1', email: 'bob@example.com' };
const OTHER = '00000000-0000-4000-8000-00000000aced';
const CARL = { id: '00000000-0000-4000-8000-0000000000c1', email: 'carl@example.com', workspaces: [OTHER] };
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
    expect(read?.members.map((m) => m.email).sort()).toEqual(['ada@example.com', 'bob@example.com']);
  });

  it('times each read under its name, for the Server-Timing of the page (PRD 2401 s1)', async () => {
    const { as, numbered } = await world();
    const timings = createTimings();
    await readDossier(as('bob'), numbered, BOB.id, timings);
    expect(timings.entries().map((entry) => entry.name).sort()).toEqual(['answerable', 'dossier', 'members', 'people', 'repos', 'rounds', 'versions']);
  });

  it('times only the dossier when the viewer may not read it', async () => {
    const { as, numbered } = await world();
    const timings = createTimings();
    await readDossier(as('carl'), numbered, null, timings);
    expect(timings.entries().map((entry) => entry.name)).toEqual(['dossier']);
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
    const read = await readDossier({ from: client.from, rpc: () => Promise.resolve({ data: null, error: { message: 'down' } }) } as never, numbered);
    expect(read?.members).toEqual([]);
    expect(read?.dossier.id).toBe(numbered);
    quiet.mockRestore();
  });
});

describe('reading a version', () => {
  it('reads one version\'s content for a member, and nothing for anyone else', async () => {
    const { as, numbered } = await world();
    const spec = (await readDossier(as('ada'), numbered))?.versions[0];
    assertDefined(spec, 'the spec\'s version');
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

  it('serves a concept\'s vision tour by its version and its boards by their round, never another kind\'s page (PRD 1272)', async () => {
    const { fake, as, numbered } = await world();
    const pushed = await fake.client('ada').rpc('dossier_push', {
      p_repo: 'acme/widgets', p_prd: 1269, p_kind: 'concept', p_title: 'Products', p_draft: null,
      p_artifacts: [{ kind: 'vision', content: '<title>tour</title>' }, { kind: 'board', content: '<title>b1</title>' }, { kind: 'board', content: '<title>b2</title>' }],
    });
    const concept = (pushed.data as { id: string }).id;
    expect(await readSandboxed(as('bob'), concept, 1, 'vision')).toBe('<title>tour</title>');
    expect(await readSandboxed(as('bob'), concept, 2, 'board')).toBe('<title>b2</title>');
    expect(await readSandboxed(as('bob'), concept, 1, 'board')).toBe('<title>b1</title>');
    expect(await readSandboxed(as('bob'), concept, 3, 'board')).toBeNull();
    expect(await readSandboxed(as('bob'), concept, 1)).toBeNull();
    expect(await readSandboxed(as('carl'), concept, 1, 'vision')).toBeNull();
    expect(await readSandboxed(as('bob'), numbered, 1, 'vision')).toBeNull();
    expect(await readSandboxed(as('bob'), numbered, 1, 'board')).toBeNull();
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
      { created_at: at('10:00'), prd: parsePrd(7) },
      { created_at: at('12:30') },
    ]));
    const [delivery, other] = ids(fake.seedAsk({ owner: BOB.id, repo: 'acme/widgets', branch: 'feat/team-inbox--s2', claudeSessionId: 'sess-b' }, [
      { created_at: at('15:00'), prd: parsePrd(7), skill: '/omni:do-work', category: 'product', category_by: 'model' },
      { created_at: at('15:30'), prd: parsePrd(8) },
    ]));
    const [gadgets] = ids(fake.seedAsk({ owner: BOB.id, repo: 'acme/gadgets' }, [{ created_at: at('16:00'), prd: parsePrd(7) }]));
    const [elsewhere] = ids(fake.seedAsk({ owner: CARL.id, workspace: OTHER, repo: 'acme/widgets', claudeSessionId: 'sess-a' }, [{ created_at: at('10:30'), prd: parsePrd(7) }]));
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
    fake.seedPlanet({ planRepo: 'plans', prd: parsePrd(7), regions: ['widgets', 'Gadgets', 'gadgets', 'core'] });
    fake.seedPlanet({ workspace: OTHER, planRepo: 'stuff', prd: parsePrd(7), regions: ['secret'] });
    fake.seedAsk({ owner: ADA.id, repo: 'Acme/Gadgets', claudeSessionId: 'sess-a' }, [
      { created_at: at('09:30'), status: 'answered', answers: { 'A question?': 'Yes' }, answered_via: 'terminal', answered_by: ADA.id, answered_at: at('09:31') },
    ]);
    fake.seedAsk({ owner: BOB.id, repo: 'Acme/Plans', branch: 'feat/invoice-reminders--s1' }, [{ created_at: at('11:00'), prd: parsePrd(7) }]);
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
    const [first] = rows;
    assertDefined(first, 'the first row');
    expect(first.latest.plan).toBeUndefined();
    expect(rows[1]).toMatchObject({ repos: ['acme/widgets'], latest: {}, asked: 0, answered: 0, last_activity: at('10:00') });
    expect(rows[2]).toMatchObject({ prd: null, repos: ['acme/plans'], last_activity: at('08:00') });
  });

  it('lists only the kind asked for, the database filtering them, and every kind otherwise (PRD 2401 s3)', async () => {
    const { fake, draft, reminders, widgets } = await history();
    await fake.client('bob').rpc('dossier_push', {
      p_repo: 'acme/widgets', p_prd: 8, p_kind: 'bug', p_title: 'Widgets crack', p_draft: null, p_artifacts: [{ kind: 'bug-record', content: 'the record' }],
    });
    const client = fake.client('bob');
    const calls: Array<[string, Record<string, unknown>]> = [];
    const recorded = { from: client.from, rpc: (name: string, args: Record<string, unknown>) => { calls.push([name, args]); return client.rpc(name, args); } };
    expect((await readHistory(recorded as never, 'prd')).map((r) => r.id)).toEqual([reminders, widgets, draft]);
    expect(calls).toEqual([['dossier_list', { p_dossier: null, p_kind: 'prd' }]]);
    expect(await readHistory(recorded as never)).toHaveLength(4);
    expect(calls.at(-1)).toEqual(['dossier_list', { p_dossier: null }]);
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
    expect(read?.repos).toEqual(['acme/plans', 'acme/core', 'acme/gadgets', 'acme/widgets']);
    const down = {
      from: client.from,
      rpc: (name: string, args: Record<string, unknown>) =>
        name === 'dossier_repos' ? Promise.resolve({ data: null, error: { message: 'down' } }) : client.rpc(name, args),
    };
    const unread = await readDossier(down as never, reminders);
    expect(unread?.repos).toBeNull();
    expect(unread?.rounds).toHaveLength(2);
    quiet.mockRestore();
  });

  it('chips them from dossier_repos(), the one dossier\'s own read, never the history\'s (PRD 2401 s3)', async () => {
    const { fake, reminders } = await history();
    const client = fake.client('bob');
    const names: string[] = [];
    const recorded = { from: client.from, rpc: (name: string, args: Record<string, unknown>) => { names.push(name); return client.rpc(name, args); } };
    await readDossier(recorded as never, reminders);
    expect(names).toContain('dossier_repos');
    expect(names).not.toContain('dossier_list');
  });
});

describe('reading the change check (PRD 384)', () => {
  it('reads the counts and the latest versions a member sees, and moves when a round is asked, answered or a version pushed', async () => {
    const { fake, as, numbered } = await world();
    const first = await readPulse(as('bob'), numbered);
    expect(first).toEqual({ asked: 0, answered: 0, latest: { spec: 1, 'before-after': 2 } });

    const [round] = fake.seedAsk({ owner: ADA.id, repo: 'acme/widgets' }, [{ created_at: '2026-09-28T10:00:00.000Z', prd: parsePrd(7) }]).rounds;
    const asked = await readPulse(as('bob'), numbered);
    expect(asked).toMatchObject({ asked: 1, answered: 0 });
    expect(signature(asked)).not.toBe(signature(first));

    assertDefined(round, 'the round');
    Object.assign(round, { status: 'answered', answers: { 'A question?': 'Yes' }, answered_at: '2026-09-28T10:01:00.000Z' });
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
      { created_at: '2026-09-28T10:00:00.000Z', prd: parsePrd(7), status: 'answered', answered_at: '2026-09-28T10:01:00.000Z' },
      { created_at: '2026-09-28T10:02:00.000Z', prd: parsePrd(7) },
    ]);
    const read = await readDossier(as('bob'), numbered);
    assertDefined(read, 'the dossier, read');
    expect(signature(pulseOf(read))).toBe(signature(await readPulse(as('bob'), numbered)));
  });

  it('reads the pulse through dossier_repos(), never the history\'s dossier_list() (PRD 2401 s3)', async () => {
    const { fake, numbered } = await world();
    const client = fake.client('bob');
    const names: string[] = [];
    const recorded = { rpc: (name: string, args: Record<string, unknown>) => { names.push(name); return client.rpc(name, args); } };
    expect(await readPulse(recorded as never, numbered)).toEqual({ asked: 0, answered: 0, latest: { spec: 1, 'before-after': 2 } });
    expect(names).toEqual(['dossier_repos']);
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
  const DORA = { id: '00000000-0000-4000-8000-0000000000d7', email: 'dora@example.com' };
  const ACCOUNTS = { ada: ADA, bob: BOB, dora: DORA };

  async function asked() {
    const fake = fakeSupabase(ACCOUNTS, { [FAKE_WORKSPACE]: 'acme' });
    const pushed = await fake.client('ada').rpc('dossier_push', {
      p_repo: 'acme/widgets', p_prd: 7, p_title: 'Team inbox', p_draft: null, p_artifacts: [{ kind: 'spec', content: SPEC }],
    });
    const id = (pushed.data as { id: string }).id;
    const [shared, own, done] = fake.seedAsk({ owner: ADA.id, repo: 'acme/widgets' }, [
      { created_at: '2026-09-28T10:00:00.000Z', prd: parsePrd(7) },
      { created_at: '2026-09-28T10:01:00.000Z', prd: parsePrd(7) },
      { created_at: '2026-09-28T10:02:00.000Z', prd: parsePrd(7), status: 'answered', answers: { 'A question?': 'Yes' } },
    ]).rounds.map((r) => r.id);
    assertDefined(shared, 'the shared round');
    assertDefined(done, 'the answered round');
    fake.seedShare(shared, BOB.id, ADA.id);
    fake.seedShare(done, BOB.id, ADA.id);
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
          ? { select: () => ({ eq: () => Promise.resolve({ data: null, error: { message: 'down' } }) }) }
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
    const [asked] = fake.tables.ask_rounds;
    assertDefined(asked, 'the round');
    asked.status = 'abandoned';
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
    assertDefined(read, 'the dossier, read');
    expect(await readPlanSlices(as('bob'), read.versions)).toBe(3);
  });

  /** A client of `token` that records the columns each read of dossier_versions selects. */
  const recordingVersions = (fake: Awaited<ReturnType<typeof world>>['fake'], token: string) => {
    const client = fake.client(token);
    const selected: string[] = [];
    const from = (table: 'dossiers' | 'dossier_versions') => {
      const query = client.from(table);
      if (table !== 'dossier_versions') return query;
      const select = query.select.bind(query);
      return Object.assign(query, { select: (columns?: string) => { selected.push(columns ?? '*'); return select(columns); } });
    };
    return { db: { from, rpc: client.rpc } as never, selected };
  };

  it('reads the stored count of the latest plan version, and never its body (PRD 2401 s3)', async () => {
    const { fake, as, numbered } = await world();
    await fake.client('ada').rpc('dossier_push', { p_repo: 'acme/widgets', p_prd: 7, p_title: 'Team inbox', p_draft: null, p_artifacts: [{ kind: 'plan', content: PLAN([row('s1'), row('s2')]) }] });
    const read = await readDossier(as('bob'), numbered);
    assertDefined(read, 'the dossier, read');
    expect(read.versions.find((v) => v.kind === 'plan')?.slices).toBe(2);
    const { db, selected } = recordingVersions(fake, 'bob');
    expect(await readPlanSlices(db, read.versions)).toBe(2);
    expect(selected).toEqual([]);
  });

  it('reads a stored count of none as no slice, without the body (PRD 2401 s3)', async () => {
    const { fake, as, numbered } = await world();
    await fake.client('ada').rpc('dossier_push', { p_repo: 'acme/widgets', p_prd: 7, p_title: 'Team inbox', p_draft: null, p_artifacts: [{ kind: 'plan', content: '# Plan\n\nNo table.\n' }] });
    const read = await readDossier(as('bob'), numbered);
    assertDefined(read, 'the dossier, read');
    expect(read.versions.find((v) => v.kind === 'plan')?.slices).toBe(0);
    const { db, selected } = recordingVersions(fake, 'bob');
    expect(await readPlanSlices(db, read.versions)).toBeNull();
    expect(selected).toEqual([]);
  });

  it('counts from the body of a plan version added before the count was stored (PRD 2401 s3)', async () => {
    const { fake, as, numbered } = await world();
    await fake.client('ada').rpc('dossier_push', { p_repo: 'acme/widgets', p_prd: 7, p_title: 'Team inbox', p_draft: null, p_artifacts: [{ kind: 'plan', content: PLAN([row('s1'), row('s2'), row('s3')]) }] });
    for (const version of fake.tables.dossier_versions) version.slices = null;
    const read = await readDossier(as('bob'), numbered);
    assertDefined(read, 'the dossier, read');
    const { db, selected } = recordingVersions(fake, 'bob');
    expect(await readPlanSlices(db, read.versions)).toBe(3);
    expect(selected).toEqual(['content']);
    expect(await readPlanSlices(db, read.versions.map((version) => ({ ...version, slices: undefined })))).toBe(3);
  });

  it('is null with no plan version, or one with no slice table', async () => {
    const { fake, as, numbered } = await world();
    const versions = async () => {
      const read = await readDossier(as('bob'), numbered);
      assertDefined(read, 'the dossier, read');
      return read.versions;
    };
    expect(await readPlanSlices(as('bob'), await versions())).toBeNull();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await fake.client('ada').rpc('dossier_push', { p_repo: 'acme/widgets', p_prd: 7, p_title: 'Team inbox', p_draft: null, p_artifacts: [{ kind: 'plan', content: '# Plan\n\nNo table.\n' }] });
    expect(await readPlanSlices(as('bob'), await versions())).toBeNull();
    vi.restoreAllMocks();
  });
});

describe('the answerable rounds start beside the other reads (PRD 2401 s4)', () => {
  it('are read while the dossier\'s other reads are still pending', async () => {
    const BOBBY = { id: '00000000-0000-4000-8000-0000000000b2', email: 'bobby@example.com' };
    const fake = fakeSupabase({ ada: ADA, bobby: BOBBY }, { [FAKE_WORKSPACE]: 'acme' });
    const pushed = await fake.client('ada').rpc('dossier_push', {
      p_repo: 'acme/widgets', p_prd: 7, p_title: 'Team inbox', p_draft: null, p_artifacts: [{ kind: 'spec', content: SPEC }],
    });
    const id = (pushed.data as { id: string }).id;
    const [round] = fake.seedAsk({ owner: ADA.id, repo: 'acme/widgets' }, [{ created_at: '2026-09-28T10:00:00.000Z', prd: parsePrd(7) }]).rounds;
    assertDefined(round, 'the round');
    fake.seedShare(round.id, BOBBY.id, ADA.id);
    let release = () => {};
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let sharesRead = false;
    const client = fake.client('bobby');
    // The directory's roster waits on the gate: the shares must be read while it does.
    const slow = {
      rpc: (fn: string, args: Record<string, unknown>) => (fn === 'workspace_roster'
        ? gate.then(() => client.rpc(fn as 'workspace_roster', args as never))
        : client.rpc(fn, args)),
      from: (table: string) => {
        if (table === 'ask_shares') sharesRead = true;
        return client.from(table as 'dossiers');
      },
    } as never;
    const reading = readDossier(slow, id, BOBBY.id);
    await vi.waitFor(() => { expect(sharesRead).toBe(true); });
    release();
    expect((await reading)?.answerable).toEqual([round.id]);
  });
});

describe('a PRD\'s shell streams without its approval, send and runners (PRD 2401 s4)', () => {
  const html = async (element: ReactElement, within?: number) => {
    const stop = new AbortController();
    if (within) setTimeout(() => { stop.abort(); }, within);
    return new Response((await prerender(element, { signal: stop.signal, onError: () => {} })).prelude).text();
  };

  it('is sent while the late parts are pending, and replaced by the page with them once they settle', async () => {
    const late = Promise.resolve(['approved']);
    const never = new Promise<string[]>(() => {});
    const page = (parts: string[]) => createElement('p', null, `with ${parts.join(',')}`);
    const check = () => Promise.resolve(createElement('i', null, 'the change check'));
    const element = (pending: Promise<string[]>) => createElement('main', null, createElement(WithLateParts<string[]>, {
      late: pending, shell: createElement('p', null, 'the shell'), live: check, read: demoDossier(Date.parse('2026-09-29T10:00:00Z')), children: page,
    }));
    const sent = await html(element(never), 30);
    expect(sent).toContain('the shell');
    expect(sent).toContain('the change check');
    expect(sent).not.toContain('with ');
    const done = await html(element(late));
    expect(done).toContain('with approved');
  });

  it('leaves out of its shell what a server-born PRD\'s approval says, never the rest', () => {
    const read = demoDossier(Date.parse('2026-09-29T10:00:00Z'));
    const server = { ...read, dossier: { ...read.dossier, birthplace: 'server' as const } };
    expect(approvalView(server, DEMO_VIEWER)).not.toBeNull();
    expect(approvalView(shellOf(server), DEMO_VIEWER)).toBeNull();
    expect(shellOf(server)).toMatchObject({ dossier: { id: server.dossier.id, prd: server.dossier.prd, title: server.dossier.title }, versions: server.versions });
    expect(shellOf(read)).toBe(read);
  });
});

describe('the list\'s scope reads, started beside dossier_list (PRD 2401 s4)', () => {
  const WS = '00000000-0000-4000-8000-0000000000e1';
  const OTHER_WS = '00000000-0000-4000-8000-0000000000e2';

  /** A client that records every table read and rpc, answering the viewer's workspaces and one product. */
  function recording(workspaces: string[] | 'down') {
    const calls: string[] = [];
    const answer = (table: string): { data: unknown; error: { message: string } | null } => {
      if (table === 'workspace_members') return workspaces === 'down' ? { data: null, error: { message: 'down' } } : { data: workspaces.map((workspace_id) => ({ workspace_id })), error: null };
      if (table === 'products') return { data: [{ id: 'p1', name: 'Mobile', workspace_id: WS, key: 'mobile' }, { id: 'p2', name: 'Web', workspace_id: OTHER_WS, key: 'web' }], error: null };
      return { data: [], error: null };
    };
    const chain = (table: string): unknown => new Proxy({}, {
      get: (_, key: string) => (key === 'then'
        ? (resolve: (value: unknown) => unknown) => resolve(answer(table))
        : () => chain(table)),
    });
    const db = {
      from: (table: string) => { calls.push(table); return chain(table); },
    } as never;
    const roster = (workspace: string) => {
      calls.push(`workspace_roster:${workspace}`);
      return Promise.resolve([{ user_id: 'u1', github_login: 'Mo' }]);
    };
    return { db, calls, roster };
  }

  it('reads the products, their dossiers and numbers, and the rosters of the viewer\'s workspaces at once', async () => {
    const { db, calls, roster } = recording([WS, OTHER_WS]);
    const early = startListScope(db, 'u1', 'mo', roster);
    expect(calls).toEqual(['workspace_members']);
    expect(await early.scope.products([WS])).toEqual([{ id: 'p1', name: 'Mobile', workspace_id: WS, key: 'mobile' }]);
    await early.scope.dossierProducts([WS]);
    await early.scope.dossierNumbers([WS, OTHER_WS]);
    expect(await early.roster(WS)).toEqual([{ user_id: 'u1', github_login: 'Mo' }]);
    expect(calls.filter((call) => call === 'products')).toHaveLength(1);
    expect(calls.sort()).toEqual(['dossiers', 'dossiers', 'products', 'workspace_members', `workspace_roster:${OTHER_WS}`, `workspace_roster:${WS}`].sort());
  });

  it('reads no roster without a login', async () => {
    const { db, calls, roster } = recording([WS]);
    const early = startListScope(db, 'u1', null, roster);
    await early.scope.products([WS]);
    expect(calls.some((call) => call.startsWith('workspace_roster'))).toBe(false);
  });

  it('reads as it was, after the list, a workspace it did not read or when the viewer\'s workspaces cannot be read', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    const covering = recording([WS]);
    const early = startListScope(covering.db, 'u1', null, covering.roster);
    await early.scope.products([WS, OTHER_WS]);
    expect(covering.calls.filter((call) => call === 'products')).toHaveLength(2);
    const down = recording('down');
    const none = startListScope(down.db, 'u1', 'mo', down.roster);
    expect(await none.scope.products([WS])).not.toHaveLength(0);
    expect(down.calls.filter((call) => call === 'products')).toHaveLength(1);
    expect(await none.roster(WS)).toEqual([{ user_id: 'u1', github_login: 'Mo' }]);
    quiet.mockRestore();
  });
});

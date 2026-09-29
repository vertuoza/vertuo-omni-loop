import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildGalaxy, demoEvents, DEMO_PROJECTS } from '@omni/galaxy';
import type { DossierListRow, DossierRoundRow } from '../dossier/store';
import { demoDossiers, planetDossier, readDossiers, workspaceDossiers } from './dossiers';
import { withDossiers, type FakeDossier } from './dossiers.fake';
import { ACME, fakeGalaxyDb, PEOPLE, twoWorkspaces, VERTUOZA, type FakeUser } from './galaxy.fake';

const NOW = new Date('2026-09-27T10:00:00Z');
const HOME = 'vertuoza/vertuo-omni-plan';

/** A dossier as dossier_list() lists it: Vertuoza's plan repository's PRD `prd`, unless told otherwise. */
function listed(id: string, prd: number | null, more: Partial<DossierListRow> = {}): DossierListRow {
  return {
    id, workspace_id: VERTUOZA, home_repo: HOME, prd, title: `PRD ${prd ?? 'draft'}`, opened_by: PEOPLE.ada.id,
    created_at: '2026-09-20T09:00:00Z', numbered_at: prd === null ? null : '2026-09-20T10:00:00Z',
    repos: [HOME], latest: {}, asked: 0, answered: 0, last_activity: '2026-09-20T10:00:00Z', ...more,
  };
}

/** A round of a dossier, as dossier_rounds() returns it: answered at `answeredAt`, or still open when null. */
function round(n: number, questions: Array<{ question: string; options?: string[] }>, answers: Record<string, string> | null, answeredAt: string | null, more: Partial<DossierRoundRow> = {}): DossierRoundRow {
  return {
    rule: 'brainstorm', round_id: `round-${n}`, session_id: 'session-1', asked_by: PEOPLE.ada.id, repo: HOME, branch: 'main',
    questions: questions.map((q) => ({ question: q.question, header: 'Q', multiSelect: false, options: (q.options ?? []).map((label) => ({ label, description: '' })) })),
    answers, status: answeredAt ? 'answered' : 'open', answered_via: answeredAt ? 'page' : null, answered_by: answeredAt ? PEOPLE.ada.id : null,
    category: null, category_by: null, prd: null, skill: '/omni:brainstorm', created_at: '2026-09-20T09:05:00Z', answered_at: answeredAt, ...more,
  };
}

const ask = (n: number, question: string, answer: string, at: string, more: Partial<DossierRoundRow> = {}) =>
  round(n, [{ question }], { [question]: answer }, at, more);

describe('planetDossier', () => {
  const row = listed('d-12', 12, {
    latest: {
      spec: { id: 'v-spec-3', version: 3, source: 'kit', created_at: '2026-09-25T08:00:00Z' },
      'before-after': { id: 'v-page-1', version: 1, source: 'github', created_at: '2026-09-21T08:00:00Z' },
    },
    asked: 12, answered: 11,
  });

  it('gives each artifact its latest version and date, and none for an artifact with no version yet', () => {
    const d = planetDossier(row, [], '/prd/d-12');
    expect(d.latest).toEqual({
      'before-after': { version: 1, at: '2026-09-21T08:00:00Z' },
      spec: { version: 3, at: '2026-09-25T08:00:00Z' },
      plan: null,
    });
    expect(d).toMatchObject({ id: 'd-12', url: '/prd/d-12', asked: 12, answered: 11 });
  });

  it('keeps the counts dossier_list() gives: rounds asked and answered, as the Questions tab counts them', () => {
    expect(planetDossier({ ...row, asked: 2, answered: 0 }, [ask(1, 'Why?', 'Because.', '2026-09-22T10:00:00Z')], null)).toMatchObject({ asked: 2, answered: 0 });
  });

  it('lists the last three answered rounds, newest answer first, with each one\'s first question and its answer', () => {
    const rounds = [
      ask(1, 'Which formats first?', 'CSV and Excel', '2026-09-21T10:00:00Z'),
      ask(2, 'Report failed rows how?', 'A downloadable report', '2026-09-24T10:00:00Z'),
      round(3, [{ question: 'Still open?' }], null, null),
      ask(4, 'Run in the background?', 'Yes, with a notification', '2026-09-23T10:00:00Z'),
      ask(5, 'Oldest?', 'Left out', '2026-09-20T10:00:00Z'),
      ask(6, 'Newest?', 'First', '2026-09-26T10:00:00Z'),
      round(7, [{ question: 'Moved to the terminal?' }], null, null, { status: 'abandoned' }),
    ];
    expect(planetDossier(row, rounds, null).last).toEqual([
      { question: 'Newest?', answer: 'First', more: 0, at: '2026-09-26T10:00:00Z' },
      { question: 'Report failed rows how?', answer: 'A downloadable report', more: 0, at: '2026-09-24T10:00:00Z' },
      { question: 'Run in the background?', answer: 'Yes, with a notification', more: 0, at: '2026-09-23T10:00:00Z' },
    ]);
  });

  it('shows an answer without its "(Recommended)" badge, and counts the other questions a round held', () => {
    const r = round(1, [{ question: 'Poll or listen?' }, { question: 'How often?' }, { question: 'Who pays?' }], {
      'Poll or listen?': 'Poll every 2 s (Recommended)', 'How often?': '2 s', 'Who pays?': 'Nobody',
    }, '2026-09-22T10:00:00Z');
    expect(planetDossier(row, [r], null).last).toEqual([{ question: 'Poll or listen?', answer: 'Poll every 2 s', more: 2, at: '2026-09-22T10:00:00Z' }]);
  });

  it('reads an answer to a question the round does not name (an older kit\'s), and skips a round with no answer to show', () => {
    const older = round(1, [], { 'Asked by an older kit?': 'Yes' }, '2026-09-22T10:00:00Z');
    const empty = round(2, [{ question: 'Answered with nothing?' }], {}, '2026-09-23T10:00:00Z');
    expect(planetDossier(row, [older, empty], null).last).toEqual([{ question: 'Asked by an older kit?', answer: 'Yes', more: 0, at: '2026-09-22T10:00:00Z' }]);
  });
});

describe('readDossiers', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  const planets = [12, 13, 14];
  const DOSSIERS: FakeDossier[] = [
    { row: listed('d-12', 12, { asked: 2, answered: 1, latest: { spec: { id: 'v1', version: 1, source: 'kit', created_at: '2026-09-21T08:00:00Z' } } }),
      rounds: [ask(1, 'Which formats first?', 'CSV', '2026-09-21T10:00:00Z'), round(2, [{ question: 'Open?' }], null, null)] },
    { row: listed('d-13', 13, { asked: 0, answered: 0 }), rounds: [] },
    { row: listed('d-draft', null), rounds: [] }, // a draft: no planet has its number
    { row: listed('d-14-core', 14, { home_repo: 'vertuoza/vertuo-core' }), rounds: [] }, // PRD 14 of another repository
    { row: listed('d-99', 99), rounds: [] }, // the plan repository's, but no planet of this galaxy
    { row: listed('d-acme-12', 12, { workspace_id: ACME, home_repo: 'acme/acme-plan' }), rounds: [] },
  ];

  function world(person: FakeUser = PEOPLE.ada, dossiers = DOSSIERS) {
    const galaxy = fakeGalaxyDb(twoWorkspaces(), Object.values(PEOPLE));
    const fake = withDossiers(galaxy, dossiers);
    const db = fake.client(person) as unknown as SupabaseClient;
    return { galaxy, fake, read: (workspace = VERTUOZA, prds = planets) => readDossiers(db, workspace, prds) };
  }

  it('reads each planet\'s dossier: its plan repository\'s PRD of the planet\'s number, with a link to its page', async () => {
    const { read } = world();
    const got = await read();
    expect(Object.keys(got)).toEqual(['12', '13']);
    expect(got).toEqual({
      12: {
        id: 'd-12', url: '/prd/d-12', asked: 2, answered: 1,
        latest: { 'before-after': null, spec: { version: 1, at: '2026-09-21T08:00:00Z' }, plan: null },
        last: [{ question: 'Which formats first?', answer: 'CSV', more: 0, at: '2026-09-21T10:00:00Z' }],
      },
      13: { id: 'd-13', url: '/prd/d-13', asked: 0, answered: 0, latest: { 'before-after': null, spec: null, plan: null }, last: [] },
    });
  });

  it('finds the plan repository from the workspace, in lower case, and reads only the workspace played', async () => {
    const { galaxy, fake, read } = world();
    galaxy.tables.workspaces.find((w) => w.id === VERTUOZA)!.plan_repo = 'Vertuo-Omni-Plan';
    await read();
    expect(galaxy.calls.filter((c) => c.kind === 'from')).toEqual([{ kind: 'from', table: 'workspaces', op: 'select', eq: { id: VERTUOZA } }]);
    expect(fake.calls[0]).toEqual({ kind: 'from', table: 'dossiers', eq: { workspace_id: VERTUOZA, home_repo: HOME } });
  });

  it('passes each dossier to dossier_list() and dossier_rounds(), never asking either for every dossier at once', async () => {
    const { fake, read } = world();
    await read();
    const rpcs = fake.calls.filter((c) => c.kind === 'rpc');
    expect(rpcs).toHaveLength(4);
    for (const call of rpcs) expect(['d-12', 'd-13']).toContain(call.kind === 'rpc' ? call.args.p_dossier : null);
  });

  it('reads nothing more for a galaxy with no planet, or a workspace with no plan repository', async () => {
    const empty = world();
    expect(await empty.read(VERTUOZA, [])).toEqual({});
    expect(empty.fake.calls).toEqual([]);
    const unplanned = world();
    unplanned.galaxy.tables.workspaces.find((w) => w.id === VERTUOZA)!.plan_repo = null;
    expect(await unplanned.read()).toEqual({});
    expect(unplanned.fake.calls).toEqual([]);
  });

  it('reads a member of two workspaces\' dossiers in the one played only', async () => {
    const { read } = world(PEOPLE.both);
    expect(Object.keys(await read(ACME, [12]))).toEqual(['12']);
    expect((await read(ACME, [12]))[12]).toMatchObject({ id: 'd-acme-12' });
  });

  it('leaves out a dossier dossier_list() no longer lists (deleted in between)', async () => {
    const { fake, read } = world();
    fake.state.gone.add('d-13');
    expect(Object.keys(await read())).toEqual(['12']);
  });

  it('is out of reach when the workspace or the dossiers cannot be read, and says so in the log', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const a = world();
    a.galaxy.state.failOn = 'workspaces';
    expect(await a.read()).toBe('unreadable');
    const b = world();
    b.fake.state.failOn = 'dossiers';
    expect(await b.read()).toBe('unreadable');
    expect(console.error).toHaveBeenCalledTimes(2);
  });

  it('keeps the other planets when one planet\'s dossier cannot be read', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { fake, read } = world();
    fake.state.failOn = 'd-12';
    expect(await read()).toEqual({ 12: 'unreadable', 13: expect.objectContaining({ id: 'd-13' }) });
  });
});

describe('workspaceDossiers', () => {
  const DOSSIERS: FakeDossier[] = [
    { row: listed('d-12', 12), rounds: [] },
    { row: listed('d-draft', null), rounds: [] },
    { row: listed('d-acme-12', 12, { workspace_id: ACME, home_repo: 'acme/acme-plan' }), rounds: [] },
  ];

  function world(person: FakeUser) {
    const fake = withDossiers(fakeGalaxyDb(twoWorkspaces(), Object.values(PEOPLE)), DOSSIERS);
    return { fake, db: fake.client(person) as unknown as SupabaseClient };
  }

  it('asks dossier_list() for one workspace by name, and lists that workspace\'s dossiers alone', async () => {
    const { fake, db } = world(PEOPLE.both);
    expect((await workspaceDossiers(db, VERTUOZA)).map((d) => d.id)).toEqual(['d-12', 'd-draft']);
    expect((await workspaceDossiers(db, ACME)).map((d) => d.id)).toEqual(['d-acme-12']);
    expect(fake.calls).toEqual([
      { kind: 'rpc', fn: 'dossier_list', args: { p_workspace: VERTUOZA } },
      { kind: 'rpc', fn: 'dossier_list', args: { p_workspace: ACME } },
    ]);
  });

  it('lists nothing of a workspace its caller is not in', async () => {
    const { db } = world(PEOPLE.wile);
    expect(await workspaceDossiers(db, VERTUOZA)).toEqual([]);
  });

  it('rejects, naming what it read, when the list cannot be read', async () => {
    const { fake, db } = world(PEOPLE.ada);
    fake.state.failOn = 'dossier_list';
    await expect(workspaceDossiers(db, VERTUOZA)).rejects.toThrow(/workspace's dossiers.*out of reach/);
  });
});

describe('demoDossiers', () => {
  const view = buildGalaxy(demoEvents(NOW), { projects: DEMO_PROJECTS, now: NOW, source: 'demo' });
  const prds = view.planets.map((p) => p.prd);

  it('gives some of the demo world\'s planets a dossier, and leaves others without one', () => {
    const demo = demoDossiers(NOW);
    const with_ = Object.keys(demo).map(Number);
    expect(with_.length).toBeGreaterThanOrEqual(3);
    for (const prd of with_) expect(prds).toContain(prd);
    expect(prds.some((prd) => !(prd in demo))).toBe(true);
  });

  it('shows the planet the demo opens on (the one in distress) with a dossier, its last answers and an artifact with no version yet', () => {
    const distress = view.planets.find((p) => p.state === 'distress')!;
    const d = demoDossiers(NOW)[distress.prd];
    expect(d).toBeDefined();
    expect(d.last.length).toBeGreaterThan(0);
    expect(Object.values(d.latest)).toContain(null);
  });

  it('keeps every demo dossier as the tab takes it: at most three answers, never more answered than asked, dated no later than now', () => {
    for (const d of Object.values(demoDossiers(NOW))) {
      expect(d.last.length).toBeLessThanOrEqual(3);
      expect(d.answered).toBeLessThanOrEqual(d.asked);
      for (const a of d.last) expect(Date.parse(a.at)).toBeLessThanOrEqual(NOW.getTime());
      for (const v of Object.values(d.latest)) if (v) expect(Date.parse(v.at)).toBeLessThanOrEqual(NOW.getTime());
    }
  });

  it('links each demo dossier to its page, and to none in a build with no page to open (the artifact)', () => {
    for (const d of Object.values(demoDossiers(NOW))) expect(d.url).toBe(`/prd/${d.id}`);
    for (const d of Object.values(demoDossiers(NOW, { open: false }))) expect(d.url).toBeNull();
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../../supabase/database.types.ts';
import { parsePrd } from 'omni-loop/kit/lib/ids.ts';
import { present } from '../ask/test/test-item';
import type { DossierListRow, DossierRoundRow } from '../dossier/store';
import { readPlanetDossier } from './dossiers';
import { withDossiers, type FakeDossier } from './dossiers.fake';
import { ACME, fakeGalaxyDb, PEOPLE, twoWorkspaces, VERTUOZA, type FakeUser } from './galaxy.fake';

// One planet's dossier, read when the game opens the planet (PRD 1808, s1): the plan repository's
// dossier of the planet's PRD number, as the DOSSIER tab shows it, in at most three database calls, on
// the stubbed database (dossiers.fake.ts, galaxy.fake.ts). No test here calls Supabase.

const HOME = 'demo-org/nimbus-plan';

/** A dossier as dossier_list() lists it: Vertuoza's plan repository's PRD `prd`, unless told otherwise. */
function listed(id: string, prd: number, more: Partial<DossierListRow> = {}): DossierListRow {
  return {
    id, workspace_id: VERTUOZA, home_repo: HOME, prd: parsePrd(prd), title: `PRD ${prd}`, opened_by: PEOPLE.ada.id,
    created_at: '2026-09-20T09:00:00Z', numbered_at: '2026-09-20T10:00:00Z',
    repos: [HOME], latest: {}, asked: 0, answered: 0, last_activity: '2026-09-20T10:00:00Z', ...more,
  };
}

/** A round of one question, answered at `at`, as dossier_rounds() returns it. */
function ask(n: number, question: string, answer: string, at: string): DossierRoundRow {
  return {
    rule: 'brainstorm', round_id: `round-${n}`, session_id: 'session-1', asked_by: PEOPLE.ada.id, repo: HOME, branch: 'main',
    questions: [{ question, header: 'Q', multiSelect: false, options: [] }],
    answers: { [question]: answer }, status: 'answered', answered_via: 'page', answered_by: PEOPLE.ada.id,
    category: null, category_by: null, prd: null, skill: '/omni:brainstorm', created_at: '2026-09-20T09:05:00Z', answered_at: at,
  };
}

describe('readPlanetDossier', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  const DOSSIERS: FakeDossier[] = [
    { row: listed('d-12', 12, { asked: 2, answered: 1 }), rounds: [ask(1, 'Which formats first?', 'CSV', '2026-09-21T10:00:00Z')] },
    { row: listed('d-14-core', 14, { home_repo: 'demo-org/nimbus-core' }), rounds: [] }, // PRD 14 of another repository
    { row: listed('d-acme-12', 12, { workspace_id: ACME, home_repo: 'acme/acme-plan' }), rounds: [] },
  ];

  function world(person: FakeUser = PEOPLE.ada) {
    const galaxy = fakeGalaxyDb(twoWorkspaces(), Object.values(PEOPLE));
    const fake = withDossiers(galaxy, DOSSIERS);
    const db = fake.client(person) as unknown as SupabaseClient<Database>;
    return { galaxy, fake, read: (prd: number, workspace = VERTUOZA) => readPlanetDossier(db, workspace, parsePrd(prd)) };
  }

  it('reads the plan repository\'s PRD of the planet\'s number, as the DOSSIER tab shows it, with a link to its page', async () => {
    const { read } = world();
    expect(await read(12)).toEqual({
      id: 'd-12', url: '/prd/d-12', asked: 2, answered: 1,
      latest: { 'before-after': null, spec: null, plan: null },
      last: [{ question: 'Which formats first?', answer: 'CSV', more: 0, at: '2026-09-21T10:00:00Z' }],
    });
  });

  it('makes three database calls: the dossier with its workspace\'s plan repository, then dossier_list() and dossier_rounds() of that dossier alone', async () => {
    const { galaxy, fake, read } = world();
    await read(12);
    expect(galaxy.calls).toEqual([]);
    expect(fake.calls).toEqual([
      { kind: 'from', table: 'dossiers', eq: { workspace_id: VERTUOZA, prd: 12 } },
      { kind: 'rpc', fn: 'dossier_list', args: { p_dossier: 'd-12' } },
      { kind: 'rpc', fn: 'dossier_rounds', args: { p_dossier: 'd-12' } },
    ]);
  });

  it('gives none for a planet with no dossier, one of another repository, or a workspace with no plan repository', async () => {
    expect(await world().read(13)).toBe('none');
    const other = world();
    expect(await other.read(14)).toBe('none');
    expect(other.fake.calls.filter((c) => c.kind === 'rpc')).toEqual([]);
    const unplanned = world();
    present(unplanned.galaxy.tables.workspaces.find((w) => w.id === VERTUOZA), 'vertuoza').plan_repo = null;
    expect(await unplanned.read(12)).toBe('none');
  });

  it('matches the plan repository in lower case, as the dossier keeps it', async () => {
    const { galaxy, read } = world();
    present(galaxy.tables.workspaces.find((w) => w.id === VERTUOZA), 'vertuoza').plan_repo = 'Nimbus-Plan';
    expect(await read(12)).toMatchObject({ id: 'd-12' });
  });

  it('reads the workspace played only, and nothing of a workspace the person is not in', async () => {
    expect(await world(PEOPLE.both).read(12, ACME)).toMatchObject({ id: 'd-acme-12' });
    expect(await world(PEOPLE.ada).read(12, ACME)).toBe('none');
  });

  it('gives none when dossier_list() no longer lists it (deleted in between)', async () => {
    const { fake, read } = world();
    fake.state.gone.add('d-12');
    expect(await read(12)).toBe('none');
  });

  it('is unreadable when the dossier or its rounds cannot be read, and says so in the log', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const a = world();
    a.fake.state.failOn = 'dossiers';
    expect(await a.read(12)).toBe('unreadable');
    const b = world();
    b.fake.state.failOn = 'dossier_rounds';
    expect(await b.read(12)).toBe('unreadable');
    expect(console.error).toHaveBeenCalledTimes(2);
  });
});

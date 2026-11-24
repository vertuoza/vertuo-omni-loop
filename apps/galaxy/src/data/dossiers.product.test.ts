import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../../supabase/database.types.ts';
import type { DossierListRow } from '../dossier/store';
import { workspaceDossiers } from './dossiers';
import { withDossiers } from './dossiers.fake';
import { fakeGalaxyDb, PEOPLE, twoWorkspaces, VERTUOZA } from './galaxy.fake';
import { parsePrd } from 'omni-loop/kit/lib/ids.ts';

// Bug 3251: a product PRD (PRD 1548, supabase/migrations/20261203100000_product_prd_ids.sql) took the Fleet
// page's PRD count down for the whole workspace, since its dossier row has no home repository, and its
// repositories start with that null, which the dashboard's strict read refused.

const HOME = 'demo-org/nimbus-plan';

/** A PRD as dossier_list() lists it: Vertuoza's plan repository's PRD `prd`. */
const prd = (id: string, n: number | null): DossierListRow => ({
  id, workspace_id: VERTUOZA, home_repo: HOME, prd: n === null ? null : parsePrd(n), title: `PRD ${n ?? 'draft'}`, opened_by: PEOPLE.ada.id,
  created_at: '2026-09-20T09:00:00Z', numbered_at: n === null ? null : '2026-09-20T10:00:00Z',
  repos: [HOME], latest: {}, asked: 0, answered: 0, last_activity: '2026-09-20T10:00:00Z',
});

describe('workspaceDossiers, with a product PRD (bug 3251)', () => {
  it('reads a product PRD\'s row without throwing, and leaves it out: it has no home repository to count it by', async () => {
    // dossier_list() returns a product PRD as it is stored: kind `prd`, no home repository, no PRD number,
    // numbered by its product, its questions answered, and its repositories starting with that null.
    const product = {
      ...prd('d-product', null), kind: 'prd', home_repo: null, repos: [null], numbered_at: '2026-11-20T10:00:00Z',
      title: 'Partner webhooks', asked: 3, answered: 2,
    } as unknown as DossierListRow;
    const fake = withDossiers(fakeGalaxyDb(twoWorkspaces(), Object.values(PEOPLE)), [
      { row: prd('d-12', 12), rounds: [] }, { row: prd('d-draft', null), rounds: [] }, { row: product, rounds: [] },
    ]);
    const db = fake.client(PEOPLE.both) as unknown as SupabaseClient<Database>;
    expect((await workspaceDossiers(db, VERTUOZA)).map((d) => d.id)).toEqual(['d-12', 'd-draft']);
  });
});

import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../../supabase/database.types.ts';
import type { DossierListRow } from '../dossier/store';
import { workspaceDossiers } from './dossiers';
import { withDossiers } from './dossiers.fake';
import { fakeGalaxyDb, PEOPLE, twoWorkspaces, VERTUOZA } from './galaxy.fake';
import { parsePrd } from 'omni-loop/kit/lib/ids.ts';

// Bug 2722: a roadmap made on the Omni page for a product (PRD 2011) took the dashboard down for the whole
// workspace, since its dossier row has a kind and fields the dashboard's strict read did not know.

const HOME = 'demo-org/nimbus-plan';

/** A PRD as dossier_list() lists it: Vertuoza's plan repository's PRD `prd`. */
const prd = (id: string, n: number): DossierListRow => ({
  id, workspace_id: VERTUOZA, home_repo: HOME, prd: parsePrd(n), title: `PRD ${n}`, opened_by: PEOPLE.ada.id,
  created_at: '2026-09-20T09:00:00Z', numbered_at: '2026-09-20T10:00:00Z',
  repos: [HOME], latest: {}, asked: 0, answered: 0, last_activity: '2026-09-20T10:00:00Z',
});

describe('workspaceDossiers, with a product roadmap (bug 2722)', () => {
  it('reads a product roadmap\'s row without throwing, and leaves it out: the dashboard counts PRDs and fixes', async () => {
    // dossier_list() returns a roadmap born on the Omni page as it is stored: kind `roadmap`, no home
    // repository, no PRD number, its roadmap's versions.
    const roadmap = {
      ...prd('d-roadmap', 1), prd: null, numbered_at: null, kind: 'roadmap', home_repo: null, repos: [null], title: 'Mobile launch',
      latest: {
        roadmap: { id: 'v-1', version: 1, source: 'kit', created_at: '2026-11-09T09:00:00Z' },
        'roadmap-prds': { id: 'v-2', version: 1, source: 'kit', created_at: '2026-11-09T09:00:00Z' },
      },
    } as unknown as DossierListRow;
    const fake = withDossiers(fakeGalaxyDb(twoWorkspaces(), Object.values(PEOPLE)), [{ row: prd('d-12', 12), rounds: [] }, { row: roadmap, rounds: [] }]);
    const db = fake.client(PEOPLE.both) as unknown as SupabaseClient<Database>;
    expect((await workspaceDossiers(db, VERTUOZA)).map((d) => d.id)).toEqual(['d-12']);
  });
});

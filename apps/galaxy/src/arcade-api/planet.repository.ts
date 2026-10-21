import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { GalaxyView } from '@omni/galaxy';
import type { PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import type { Database } from '../../../../supabase/database.types.ts';
import type { PlanetDossierRead } from '../arcade/types';
import { readPlanetDossier } from '../data/dossiers';
import { loadGalaxy } from '../data/load-galaxy';

// One planet's details' storage (PRD 1808; ADR-0095), on the client it is given, as the signed-in person,
// so row-level security has the last word: the workspace's galaxy, from the season cache as /play reads
// it (src/data/load-galaxy.ts), and one planet's dossier (src/data/dossiers.ts, readPlanetDossier). It
// holds no rule.

/** What the reads need: the person's client. */
export type PlanetDb = SupabaseClient<Database>;

export interface PlanetRepository {
  /** The workspace played, or null when the person belongs to none. Rejects when it cannot be read. */
  workspace(): Promise<string | null>;
  /** The workspace's galaxy. Rejects when it cannot be read. */
  galaxy(workspace: string): Promise<GalaxyView>;
  /** The planet's dossier by its PRD number, 'none' or 'unreadable'. Never rejects. */
  dossier(workspace: string, prd: PrdNumber): Promise<PlanetDossierRead | 'none'>;
}

/** The repository on a signed-in person's client, in the workspace `workspace()` reads. */
export const planetRepository = (db: PlanetDb, workspace: () => Promise<{ id: string } | null>): PlanetRepository => ({
  workspace: async () => (await workspace())?.id ?? null,
  galaxy: (id) => loadGalaxy(db, id),
  dossier: (id, prd) => readPlanetDossier(db, id, prd),
});

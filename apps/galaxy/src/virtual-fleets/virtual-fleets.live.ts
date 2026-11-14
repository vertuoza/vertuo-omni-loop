import 'server-only';
import { log } from 'omni-loop/kit/lib/log/log.ts';
import { supabaseEnv, supabaseServer } from '../data/supabase-server';
import type { VirtualFleetsDeps } from './virtual-fleets.controller';
import { virtualFleetsRepository, type VirtualFleetsDb } from './virtual-fleets.repository';
import { virtualFleetsService, type VirtualFleetsService } from './virtual-fleets.service';

// The Virtual Fleets' real dependencies (PRD 2842 s1), for /api/virtual-fleets and the Fleet section:
// the rules over the signed-in person's own Supabase session, never a service key (ADR-0051), so
// create_virtual_fleet() decides who may make one. Without Supabase configured (the demo galaxy) the
// route answers 503.

/** The rules as the person `db` acts for. */
export const virtualFleetsServiceAs = (db: VirtualFleetsDb): VirtualFleetsService => virtualFleetsService(virtualFleetsRepository(db));

/** The rules as the page's signed-in person, or null when nobody is signed in. */
async function signedInService(): Promise<VirtualFleetsService | null> {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  return user ? virtualFleetsServiceAs(db) : null;
}

export function virtualFleetsDeps(): VirtualFleetsDeps {
  return {
    service: supabaseEnv() ? signedInService : null,
    log: (message) => { log.error({ event: 'virtual-fleets', outcome: 'failed', message }); },
  };
}

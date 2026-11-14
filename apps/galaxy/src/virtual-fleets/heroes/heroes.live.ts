import 'server-only';
import { log } from 'omni-loop/kit/lib/log/log.ts';
import { supabaseEnv, supabaseServer } from '../../data/supabase-server';
import type { VirtualFleetsDb } from '../virtual-fleets.repository';
import type { HeroesDeps } from './heroes.controller';
import { heroesRepository } from './heroes.repository';
import { heroesService, type HeroesService } from './heroes.service';

// The Heroes tab's real dependencies (PRD 2842 s6), for /api/virtual-fleets/heroes and the Fleet section:
// the rules over the signed-in person's own Supabase session, never a service key (ADR-0051), so
// add_virtual_hero() and remove_virtual_hero() decide who may. Without Supabase configured the route
// answers 503.

/** The rules as the person `db` acts for. */
export const heroesServiceAs = (db: VirtualFleetsDb): HeroesService => heroesService(heroesRepository(db));

async function signedInService(): Promise<HeroesService | null> {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  return user ? heroesServiceAs(db) : null;
}

export function heroesDeps(): HeroesDeps {
  return {
    service: supabaseEnv() ? signedInService : null,
    log: (message) => { log.error({ event: 'virtual-fleets-heroes', outcome: 'failed', message }); },
  };
}

import { PLANET_LOG_LINES, type PlanetDetails, type PlanetRefusal } from './planet.contract';
import { planetRepository, type PlanetDb, type PlanetRepository } from './planet.repository';

// One planet's details' rules (PRD 1808; ADR-0095), on its repository: the planet is found by its key
// in the person's workspace's galaxy, so a planet of another workspace, or a person in none, is missing.
// Its log is the last lines the LOG tab shows. Its dossier is the plan repository's of its PRD number,
// as the DOSSIER tab finds it (src/arcade/scenes/planet.tsx, dossierOf): a number two planets of the
// galaxy share (two repositories' PRD 88) has no dossier, and is not read. The workspace or the galaxy
// out of reach fails the answer; the dossier out of reach is 'unreadable' in it.

/** A service answer: its value, or why it was refused, in plain words, with what was thrown. */
export type Served<T> = { ok: true; value: T } | { ok: false; kind: PlanetRefusal; error: string; cause?: unknown };

export const SIGNED_OUT = 'Sign in first to read a planet.';
export const MISSING = 'No such planet in your galaxy.';
const NOT_READ = 'The planet could not be read. Try again.';

export function planetService(repo: PlanetRepository) {
  return {
    /** The planet keyed `key`: its dossier and the last lines of its log. */
    details: async (key: string): Promise<Served<PlanetDetails>> => {
      let found;
      try {
        const workspace = await repo.workspace();
        if (!workspace) return { ok: false, kind: 'missing', error: MISSING };
        const view = await repo.galaxy(workspace);
        const planet = view.planets.find((p) => p.key === key);
        if (!planet) return { ok: false, kind: 'missing', error: MISSING };
        found = { workspace, planet, twin: view.planets.some((p) => p.prd === planet.prd && p.key !== planet.key) };
      } catch (cause) {
        return { ok: false, kind: 'database', error: NOT_READ, cause };
      }
      const { workspace, planet, twin } = found;
      const dossier = twin ? 'none' : await repo.dossier(workspace, planet.prd);
      return { ok: true, value: { dossier, log: planet.log.slice(0, PLANET_LOG_LINES) } };
    },
  };
}

export type PlanetService = ReturnType<typeof planetService>;

/** The service on a signed-in person's client, in the workspace `workspace()` reads. */
export const planetServiceOf = (db: PlanetDb, workspace: () => Promise<{ id: string } | null>): PlanetService =>
  planetService(planetRepository(db, workspace));

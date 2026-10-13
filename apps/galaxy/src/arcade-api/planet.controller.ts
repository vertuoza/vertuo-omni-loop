import 'server-only';
import { log } from 'vertuo-omni-plan/kit/lib/log/log.ts';
import { viewer } from '../data/viewer';
import { PLANET_REFUSALS, type PlanetRefusal } from './planet.contract';
import { MISSING, planetServiceOf, SIGNED_OUT, type PlanetService } from './planet.service';

// One planet's details, for the game's planet overlay (PRD 1808; ADR-0095), in the shapes of
// src/arcade-api/planet.contract.ts:
//
//   GET /api/arcade/planets/<key>  → 200 { dossier, log }
//
// `<key>` is the last segment of the request's path, read back whole: `vertuoza%2Fvertuo-omni-loop%2312`
// is the planet `vertuoza/vertuo-omni-loop#12`. The session is checked first, as viewer() reads it:
// signed out (or the demo, or no database here), 401 and no service runs. Signed in, the service reads
// as that person, so row-level security decides what comes back: a planet outside their workspace is
// 404. A read that fails is 500, logged.

export type PlanetDeps = {
  /** The service as the signed-in person, or null when nobody is signed in. */
  signedIn: () => Promise<PlanetService | null>;
  /** Logs a failed read: what was thrown. */
  failed: (error: unknown) => void;
};

const NO_STORE = { 'cache-control': 'no-store' };

const reply = (status: number, body: unknown): Response => Response.json(body, { status, headers: NO_STORE });
const refuse = (kind: PlanetRefusal, error: string): Response => reply(PLANET_REFUSALS[kind], { error });

/** The planet's key: the request path's last segment, decoded; null when there is none or it does not decode. */
export function planetKeyOf(request: Request): string | null {
  const segment = new URL(request.url).pathname.split('/').pop() ?? '';
  try {
    const key = decodeURIComponent(segment);
    return key ? key : null;
  } catch {
    return null;
  }
}

/** The handler, on `deps`. */
export function planetHandlers(deps: PlanetDeps) {
  return {
    get: async (request: Request): Promise<Response> => {
      const service = await deps.signedIn();
      if (!service) return refuse('signed-out', SIGNED_OUT);
      const key = planetKeyOf(request);
      if (!key) return refuse('missing', MISSING);
      const read = await service.details(key);
      if (read.ok) return reply(200, read.value);
      if (read.kind === 'database') deps.failed(read.cause);
      return refuse(read.kind, read.error);
    },
  };
}

const live = planetHandlers({
  async signedIn() {
    const seen = await viewer();
    return seen.kind === 'signed-in' ? planetServiceOf(seen.db, seen.workspace) : null;
  },
  failed: (error) => { log.error({ event: 'arcade-planet', outcome: 'failed', status: 500, error }); },
});

/** GET /api/arcade/planets/<key> */
export const getPlanet = (request: Request): Promise<Response> => live.get(request);

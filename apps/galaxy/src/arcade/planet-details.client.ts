import { planetDetailsPath, PlanetDetailsSchema, type PlanetDetails } from '../arcade-api/planet.contract';

// One planet's details from the browser (PRD 1808, s3; ADR-0095): `GET /api/arcade/planets/<key>`, its
// answer parsed with src/arcade-api/planet.contract.ts. The sign-in cookie goes with the request; the
// page builds no Supabase client. Any refusal (401, 404, 500) or an answer of another shape throws: the
// game reads it as the planet's details out of reach, and asks again the next time the planet opens.

/** The browser's fetch, or a stub in a test. */
export type Fetch = (url: string, init: RequestInit) => Promise<Response>;

/** The planet keyed `key`: its dossier and the last lines of its log. Throws when it could not be read. */
export async function fetchPlanetDetails(key: string, fetcher: Fetch = (url, init) => fetch(url, init)): Promise<PlanetDetails> {
  const response = await fetcher(planetDetailsPath(key), { credentials: 'same-origin', headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`The planet's details: ${String(response.status)}`);
  return PlanetDetailsSchema.parse(await response.json());
}

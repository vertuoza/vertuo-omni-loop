// What `GET /api/arcade/planets/<key>` answers (PRD 1808; ADR-0095), as zod schemas both sides share:
// the controller (src/arcade-api/planet.controller.ts) answers these shapes, and the game's fetch parses
// every answer with them. Browser-safe: zod only.
//
//   GET /api/arcade/planets/<key>  → 200 { dossier, log }
//
// `<key>` is the planet's key (`<home>#<n>`, PRD 728), URL-encoded as one path segment. `dossier` is the
// planet's dossier as its DOSSIER tab shows it, 'none' when it has none, 'unreadable' when it could not be
// read; `log` is the last 8 lines of its log, newest first, as the LOG tab shows them. A refusal is
// `{ error }` in plain words: 401 signed out, 404 a planet outside the person's workspace, 500 a read
// that failed.
import { z } from 'zod';

/** How many lines of a planet's log the answer carries: the LOG tab shows these. */
export const PLANET_LOG_LINES = 8;

/** The route of one planet's details. */
export const planetDetailsPath = (key: string): string => `/api/arcade/planets/${encodeURIComponent(key)}`;

const LatestSchema = z.object({ version: z.number(), at: z.string() }).nullable();

/** A planet's dossier, as its DOSSIER tab summarises it (src/arcade/types.ts, PlanetDossier). */
const PlanetDossierSchema = z.object({
  id: z.string(),
  url: z.string().nullable(),
  latest: z.object({ 'before-after': LatestSchema, spec: LatestSchema, plan: LatestSchema }),
  asked: z.number(),
  answered: z.number(),
  last: z.array(z.object({ question: z.string(), answer: z.string(), more: z.number(), at: z.string() })),
});

/** One line of a planet's log (@omni/galaxy's LogLine). */
const LogLineSchema = z.object({
  at: z.string(),
  type: z.string(),
  planet: z.number(),
  text: z.string(),
  contributor: z.string().nullable(),
  team: z.string().nullable(),
});

/** One planet's details: its dossier and the last lines of its log. */
export const PlanetDetailsSchema = z.object({
  dossier: z.union([PlanetDossierSchema, z.literal('none'), z.literal('unreadable')]),
  log: z.array(LogLineSchema).max(PLANET_LOG_LINES),
});
export type PlanetDetails = z.infer<typeof PlanetDetailsSchema>;

/** A refusal, in plain words. */
export const PlanetErrorSchema = z.object({ error: z.string() });

/** Why a read was refused, and its status. */
export const PLANET_REFUSALS = { 'signed-out': 401, missing: 404, database: 500 } as const;
export type PlanetRefusal = keyof typeof PLANET_REFUSALS;

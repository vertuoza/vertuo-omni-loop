// GET /api/arcade/planets/<key> → {dossier, log}: one planet's dossier and the last 8 lines of its log,
// read when the game opens the planet (PRD 1808, src/arcade-api/planet.controller.ts).
export { getPlanet as GET } from '../../../../../src/arcade-api/planet.controller';

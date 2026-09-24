// game/cli/banner.mjs <prd> — print one planet's banner from live GitHub and the season snapshot.
import { existsSync, readFileSync } from 'node:fs';
import { loadProjects } from '../config.mjs';
import { buildSnapshot } from '../sources/github.mjs';
import { derivePlanet } from '../planet-state.mjs';
import { renderBanner } from '../render/banner.mjs';

const prd = Number(process.argv[2]);
if (!Number.isInteger(prd)) { console.error('usage: game:banner <prd>'); process.exit(2); }
const now = new Date();
const config = loadProjects();
const snapshot = await buildSnapshot({ config, now });
const planet = snapshot.planets.find((p) => p.prd === prd);
if (!planet) { console.error(`no PRD #${prd} in the planning repository`); process.exit(1); }
const terraformedPlanets = new Set(snapshot.planets.filter((p) => p.featurePr?.mergedAt).map((p) => p.prd));
const seasonPath = `game/season/${now.toISOString().slice(0, 7)}.json`;
const season = existsSync(seasonPath) ? JSON.parse(readFileSync(seasonPath, 'utf8')) : { individuals: {}, teams: {}, planets: {}, streaks: {}, credits: [] };
console.log(renderBanner(derivePlanet(planet, { config, terraformedPlanets, now }), { season, now }));

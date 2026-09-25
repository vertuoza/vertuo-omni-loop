// game/cli/banner.mjs <prd> — print one planet's banner from live GitHub and this season's ledger.
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY: the repositories, fleets and ledger live there.
import { supabaseFromEnv, loadConfig, supabaseLedger } from '../sources/supabase.mjs';
import { buildSnapshot } from '../sources/github.mjs';
import { derivePlanet } from '../planet-state.mjs';
import { score } from '../economy.mjs';
import { renderBanner } from '../render/banner.mjs';

const prd = Number(process.argv[2]);
if (!Number.isInteger(prd)) { console.error('usage: game:banner <prd>'); process.exit(2); }
const now = new Date();
const rest = supabaseFromEnv();
const [config, ledger] = await Promise.all([loadConfig(rest), supabaseLedger(rest).read()]);
const snapshot = await buildSnapshot({ config, now, prds: [prd] });
const planet = snapshot.planets.find((p) => p.prd === prd);
if (!planet) { console.error(`no PRD #${prd} in the planning repository`); process.exit(1); }
const terraformedPlanets = new Set(snapshot.planets.filter((p) => p.featurePr?.mergedAt).map((p) => p.prd));
const season = score(ledger, { season: now.toISOString().slice(0, 7), now });
console.log(renderBanner(derivePlanet(planet, { config, terraformedPlanets, now }), { season, now }));

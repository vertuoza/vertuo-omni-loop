// game/cli/banner.mjs <prd> --workspace <slug> — print one planet's banner from the workspace's live
// GitHub and this season's ledger. Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY: the workspace,
// its repositories, fleets and ledger live there.
import { loadConfig, supabaseLedger } from '../sources/supabase.mjs';
import { buildSnapshot } from '../sources/github.mjs';
import { derivePlanet } from '../planet-state.mjs';
import { score } from '../economy.mjs';
import { renderBanner } from '../render/banner.mjs';
import { openWorkspace } from './workspace.mjs';

function bannerArgs([prd, ...extra]) {
  if (!/^\d+$/.test(prd ?? '')) throw new Error(prd === undefined ? 'name a PRD by its number' : `"${prd}" is not a PRD number`);
  if (extra.length) throw new Error(`unexpected argument "${extra[0]}"`);
  return { prd: Number(prd) };
}

const { rest, workspace, args: { prd }, github } = await openWorkspace({ usage: 'game:banner <prd> --workspace <slug>', parse: bannerArgs, github: true });
const now = new Date();
const [config, ledger] = await Promise.all([loadConfig(rest, workspace.id), supabaseLedger(rest, workspace.id).read()]);
const snapshot = await buildSnapshot({ config, now, prds: [prd], ...github });
const planet = snapshot.planets.find((p) => p.prd === prd);
if (!planet) { console.error(`no PRD #${prd} in ${github.org}/${github.planRepo}`); process.exit(1); }
const terraformedPlanets = new Set(snapshot.planets.filter((p) => p.featurePr?.mergedAt).map((p) => p.prd));
const season = score(ledger, { season: now.toISOString().slice(0, 7), now });
console.log(renderBanner(derivePlanet(planet, { config, terraformedPlanets, now }), { season, now }));

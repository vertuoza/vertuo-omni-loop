// game/cli/banner.ts <prd> --workspace <slug> — print one planet's banner from the workspace's live
// GitHub and this season's ledger. Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY: the workspace,
// its repositories, fleets and ledger live there.
import { loadConfig, supabaseLedger } from '../sources/supabase.ts';
import { buildSnapshot } from '../sources/github.ts';
import { derivePlanet } from '../planet-state.ts';
import { score } from '../economy.ts';
import { renderBanner } from '../render/banner.ts';
import { openWorkspace } from './workspace.ts';
import { parsePrd, type PrdNumber } from '../../kit/lib/ids.ts';

function bannerArgs([prd, ...extra]: string[]): { prd: PrdNumber } {
  if (prd === undefined) throw new Error('name a PRD by its number');
  if (!/^\d+$/.test(prd)) throw new Error(`"${prd}" is not a PRD number`);
  if (extra.length) throw new Error(`unexpected argument "${extra[0]}"`);
  return { prd: parsePrd(prd) };
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

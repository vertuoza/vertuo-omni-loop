import 'server-only';
import { checkoutRoot, loadKnowledge } from '../data/load-knowledge';
import { supabaseEnv, supabaseServer } from '../data/supabase-server';
import { memberWorkspace } from '../data/workspace';
import type { ChartDeps } from './chart.controller';

// The star chart route's real dependencies (./chart.controller.ts, PRD 1808 s2): the person's own
// Supabase session, read from their cookies and checked with Supabase Auth, and their membership read
// as themselves, as /play reads it (src/data/arcade.ts); the knowledge of the checkout the app is
// deployed from, through the kit's one parser (src/data/load-knowledge.ts). No database here: nobody
// is signed in. No Omni Loop config at or above the app: a build without a knowledge base, 'none'.

const standing: ChartDeps['standing'] = async () => {
  if (!supabaseEnv()) return null;
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  return (await memberWorkspace(db, user.id)) ? 'crew' : 'outsider';
};

const chart: ChartDeps['chart'] = () => (checkoutRoot(process.cwd()) === null ? 'none' : loadKnowledge());

export function chartDeps(): ChartDeps {
  return { standing, chart };
}

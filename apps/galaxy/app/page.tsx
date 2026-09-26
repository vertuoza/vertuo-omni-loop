import { ArcadeClient } from '../src/arcade/ArcadeClient';
import { arcadeFor } from '../src/data/arcade';
import { demoFleets, demoGalaxy } from '../src/data/load-galaxy';
import { arcadeMode } from '../src/data/mode';
import { supabaseEnv, supabaseServer } from '../src/data/supabase-server';

// Rendered per request (it reads the session cookie): signed out, the arcade plays its attract mode
// with the built-in fleets and reads nothing; signed in, the workspace the person joined first, as
// they may read it, under its brand (src/data/arcade.ts). Without Supabase: the demo galaxy in
// development only (or OMNI_LOOP_DEMO=1); any other build is closed, and nobody gets past INSERT
// COIN (src/data/mode.ts).

export default async function Page() {
  const mode = arcadeMode(process.env);
  const env = supabaseEnv();
  if (mode === 'demo') return <ArcadeClient mode="demo" supabase={null} view={demoGalaxy()} fleets={demoFleets()} />;
  if (mode === 'closed' || !env) return <ArcadeClient mode="closed" supabase={null} view={null} fleets={demoFleets()} />;

  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  return <ArcadeClient mode="supabase" supabase={env} {...await arcadeFor(db, user)} />;
}

import 'server-only';
import { ArcadeClient } from '../../src/arcade/ArcadeClient';
import { arcadeFor } from '../../src/data/arcade';
import { demoDossiers } from '../../src/data/dossiers';
import { demoFleets, demoGalaxy } from '../../src/data/load-galaxy';
import { loadKnowledge } from '../../src/data/load-knowledge';
import { serverEnv } from '../../src/env';
import { demoXp } from '../../src/data/xp';
import { supabaseEnv, supabaseServer } from '../../src/data/supabase-server';
import { APP_HOME } from '../../src/switch/switch';

// Rendered per request (it reads the session cookie): signed out, the arcade plays its attract mode
// with no fleet, inviting the visitor to raise their own (PRD 400), and reads nothing; signed in,
// the workspace the person joined first, as they may read it, under its brand (src/data/arcade.ts).
// Without Supabase: the demo galaxy in development only (or OMNI_LOOP_DEMO=1); any other build is
// closed, and nobody gets past INSERT COIN (src/data/mode.ts). The star chart's knowledge goes
// where the galaxy goes, to the crew and the demo only: anyone else's page carries no entry. The
// player's XP and the crew's high scores come with the workspace's data (none at all for anyone
// else: the arcade never reads them in the browser); the demo's guest borrows the demo world's
// highest XP (src/data/xp.ts), and the demo account keeps its scores in the browser. The planets'
// dossiers come the same way: read with the workspace's data for its crew, demo dossiers in the
// demo, each linking to its page at /prd/<id>. Every page hands the arcade the app's home, whoever
// is at it: the arcade leaves for it from SELECT MODE's APP MODE row, after OPEN THE APP?
// (PRD 238).

export default async function Page() {
  const mode = serverEnv().mode;
  const env = supabaseEnv();
  if (mode === 'demo') {
    const now = new Date();
    return <ArcadeClient mode="demo" supabase={null} app={APP_HOME} view={demoGalaxy(now)} fleets={demoFleets()} knowledge={loadKnowledge()} xp={demoXp(now)} dossiers={demoDossiers(now)} />;
  }
  if (mode === 'closed' || !env) return <ArcadeClient mode="closed" supabase={null} app={APP_HOME} view={null} fleets={[]} />;

  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  const data = await arcadeFor(db, user);
  const knowledge = data.session?.crew && !data.problem ? loadKnowledge() : undefined;
  return <ArcadeClient mode="supabase" supabase={env} app={APP_HOME} {...data} scores={data.scores ?? {}} knowledge={knowledge} />;
}

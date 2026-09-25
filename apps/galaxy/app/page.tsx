import type { User } from '@supabase/supabase-js';
import { ArcadeClient } from '../src/arcade/ArcadeClient';
import { demoFleets, demoGalaxy, loadCrew, loadFleets, loadGalaxy, loadMe } from '../src/data/load-galaxy';
import { arcadeMode } from '../src/data/mode';
import { isCrewEmail, supabaseEnv, supabaseServer } from '../src/data/supabase-server';

// Rendered per request (it reads the session cookie): signed out, the arcade gets the fleets and its
// attract mode; signed in with a @vertuoza.com account, the galaxy as that player may read it.
// Without Supabase: the demo galaxy in development only (or OMNI_LOOP_DEMO=1); any other build is
// closed, and nobody gets past INSERT COIN (src/data/mode.ts).

const givenName = (user: User) => {
  const m = user.user_metadata ?? {};
  return String(m.given_name ?? m.full_name ?? m.name ?? user.email?.split('@')[0] ?? '').trim().split(/\s+/)[0] ?? '';
};

// The GitHub login linked to this sign-in, if any: linking it is what makes a visitor a player.
const githubLogin = (user: User) => {
  const d = user.identities?.find((i) => i.provider === 'github')?.identity_data ?? null;
  const login = d?.user_name ?? d?.preferred_username;
  return typeof login === 'string' && login ? login : null;
};

export default async function Page() {
  const mode = arcadeMode(process.env);
  const env = supabaseEnv();
  if (mode === 'demo') return <ArcadeClient mode="demo" supabase={null} view={demoGalaxy()} fleets={demoFleets()} />;
  if (mode === 'closed' || !env) return <ArcadeClient mode="closed" supabase={null} view={null} fleets={demoFleets()} />;

  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  const session = user
    ? { id: user.id, email: user.email ?? '', givenName: givenName(user), crew: isCrewEmail(user.email), github: githubLogin(user) }
    : null;
  try {
    if (!session?.crew) {
      return <ArcadeClient mode="supabase" supabase={env} view={null} fleets={await loadFleets(db)} session={session} />;
    }
    const [view, fleets, me, crew] = await Promise.all([loadGalaxy(db), loadFleets(db), loadMe(db, session.id), loadCrew(db)]);
    return <ArcadeClient mode="supabase" supabase={env} view={view} fleets={fleets} session={session} me={me} crew={crew} />;
  } catch (err) {
    // The database is out of reach: the cabinet still plays its attract mode, and says so.
    console.error(err);
    return <ArcadeClient mode="supabase" supabase={env} view={null} fleets={demoFleets()} session={session} problem="THE GALAXY IS OUT OF REACH. TRY AGAIN SOON." />;
  }
}

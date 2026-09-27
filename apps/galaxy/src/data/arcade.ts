import 'server-only';
import type { GalaxyView } from '@omni/galaxy';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Brand } from '../arcade/brand';
import type { DossiersRead, FleetRow, Player, ScoresRead, Session, XpRead } from '../arcade/types';
import { readDossiers } from './dossiers';
import { demoFleets, loadCrew, loadFleets, loadGalaxy, loadMe } from './load-galaxy';
import { readScores } from './scores';
import { brandOf, memberWorkspace, type Workspace } from './workspace';
import { readXp } from './xp';

// What the page hands the arcade when Supabase is configured, read with the visitor's own session.
//
// - Signed out: nothing is read. The attract mode plays the built-in fleets under the house brand.
// - Signed in: the workspace they joined first (joined by domain once, when they belong to none
//   yet). A member gets its galaxy, fleets, crew and their own player row, and its name and theme as
//   the arcade's brand. One with no workspace is no crew, reads nothing, and meets the outsider
//   screen.
// - A member with GitHub linked also gets their player_xp row in that workspace, by lower-cased
//   login, and each game's crew table (its top five, and their own best): each read on its own, so
//   XP or scores out of reach leave the galaxy shown, and say so.
// - Every member, visitor or player, also gets the planets' dossiers (PRD 216: each planet's PRD in the
//   workspace's plan repository, src/data/dossiers.ts), read on their own after the galaxy in the same
//   way: out of reach, the planet's DOSSIER tab says so and the rest of the planet is unchanged.
// - The database out of reach: the attract mode, the built-in fleets, and a message saying so.

export const OUT_OF_REACH = 'THE GALAXY IS OUT OF REACH. TRY AGAIN SOON.';

export interface ArcadeData {
  view: GalaxyView | null;
  fleets: FleetRow[];
  session: Session | null;
  /** The id of the workspace played in: the one a new player row is written to. */
  workspace: string | null;
  me?: Player | null;
  crew?: Player[];
  /** The player's XP: null for a visitor or a player with no row yet, 'unreadable' when it could not be read. */
  xp?: XpRead;
  /** Each game's crew table, by the game's id: none for a visitor, 'unreadable' when one could not be read. */
  scores?: Record<string, ScoresRead>;
  /** The planets' dossiers, by PRD number: 'unreadable' when they could not be read. */
  dossiers?: DossiersRead;
  brand?: Brand;
  problem?: string;
}

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

/** Who is at the cabinet. `crew`: they belong to a workspace, whatever their email's domain. */
const sessionOf = (user: User, crew: boolean): Session =>
  ({ id: user.id, email: user.email ?? '', givenName: givenName(user), crew, github: githubLogin(user) });

export async function arcadeFor(db: SupabaseClient, user: User | null, now = new Date()): Promise<ArcadeData> {
  if (!user) return { view: null, fleets: demoFleets(), session: null, workspace: null };
  let workspace: Workspace | null = null;
  try {
    workspace = await memberWorkspace(db, user.id);
    if (!workspace) return { view: null, fleets: demoFleets(), session: sessionOf(user, false), workspace: null };
    const id = workspace.id;
    const [view, fleets, me, crew] = await Promise.all([loadGalaxy(db, id, now), loadFleets(db, id), loadMe(db, id, user.id), loadCrew(db, id)]);
    const session = sessionOf(user, true);
    const login = me?.github_login ?? session.github;
    const prds = view.planets.map((p) => p.prd);
    const [xp, scores, dossiers] = await Promise.all([
      login ? readXp(db, id, login) : null,
      login ? readScores(db, id, user.id) : {},
      readDossiers(db, id, prds),
    ]);
    return { view, fleets, session, workspace: id, me, crew, xp, scores, dossiers, brand: brandOf(workspace) };
  } catch (err) {
    // Out of reach: whether they belong to a workspace may be unknown, so nobody is turned away as an
    // outsider; the arcade says the galaxy is out of reach instead.
    console.error(err);
    const known = workspace ? { workspace: workspace.id, brand: brandOf(workspace) } : { workspace: null };
    return { view: null, fleets: demoFleets(), session: sessionOf(user, true), ...known, problem: OUT_OF_REACH };
  }
}

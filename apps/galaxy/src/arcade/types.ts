import type { FleetLook } from '@omni/galaxy';
import type { Hero } from '@omni/sprites';

/** A fleet as the arcade draws it: public.teams, look included. */
export interface FleetRow extends FleetLook { name: string }

/** A signed-in person's row in public.players, in the workspace the arcade plays. */
export interface Player {
  /** The person: the row's `user_id`. */
  id: string;
  display_name: string;
  team: string | null;
  team_since: string | null;
  hero: Hero;
  github_login: string | null;
}

/** What the arcade saves for the signed-in player: a fleet, a name, a hero. */
export type PlayerPatch = Partial<Pick<Player, 'display_name' | 'team' | 'hero'>>;

/**
 * Who is at the cabinet. `crew` is true when they belong to a workspace, whatever their email's
 * domain; false, they meet the outsider screen. `github` is the GitHub login linked to this sign-in,
 * if any: without one the crew member is a visitor, who may look at the galaxy but not play.
 */
export interface Session { id: string; email: string; givenName: string; crew: boolean; github: string | null }

/**
 * Sign-in and saving, behind one interface: Supabase in production, the browser's own storage in the
 * demo galaxy (and the single-file artifact), so the arcade never imports Supabase itself.
 */
export interface Account {
  kind: 'demo' | 'supabase' | 'closed';
  /** Signs in with Google. Supabase leaves the page (and comes back through /auth/callback). */
  signIn(): Promise<Session | void>;
  /** Links GitHub, which makes a visitor a player. Supabase leaves the page; the demo resolves with a made-up login. */
  linkGithub(): Promise<string | void>;
  /** Creates or updates the signed-in player's row; resolves with the row as stored. */
  save(patch: PlayerPatch, current: Player | null): Promise<Player>;
  signOut(): Promise<void>;
  /** The demo's remembered guest; Supabase answers from the server render instead. */
  restore?(): { session: Session | null; me: Player | null };
}

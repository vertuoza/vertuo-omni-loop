import type { FleetLook } from '@omni/galaxy';
import type { Hero } from '@omni/design';

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

/**
 * A player's row in public.player_xp, which the game workflow writes at every poll: their lifetime
 * XP, their level (0 is no level yet: before the first point) and the games they unlocked.
 */
export interface PlayerXp { xp: number; level: number; unlocked: string[] }

/**
 * What the arcade knows of the player's XP: their row; null when they have none (no counted credit
 * yet, or the game workflow never ran); 'unreadable' when it could not be read, and the arcade then
 * shows no level rather than guess one.
 */
export type XpRead = PlayerXp | null | 'unreadable';

/** A line of a game's crew table (public.arcade_scores): a player's best, under their arcade name and hero. */
export interface ScoreLine { id: string; name: string; hero: Hero | null; team: string | null; best: number }

/** A game's crew table: its top five, best first, and the player's own best (null before their first saved game). */
export interface ScoreBoard { top: ScoreLine[]; mine: number | null }

/** What the arcade knows of a game's scores: its board, or 'unreadable' when it could not be read. */
export type ScoresRead = ScoreBoard | 'unreadable';

/** A PRD's artifact, as the planet's DOSSIER tab names it (PRD 216). */
export type DossierArtifactKind = 'before-after' | 'spec' | 'plan';

/** An artifact's latest version: its number (how many versions of its kind there are) and when it was added. */
export interface DossierLatest { version: number; at: string }

/** One of the last answered rounds: its first question and the answer to it, and how many more questions it held. */
export interface DossierAnswer { question: string; answer: string; more: number; at: string }

/**
 * A planet's dossier, as its DOSSIER tab summarises it: each artifact's latest version (null for one
 * with none yet), the rounds asked and answered, and the last three answered, newest first. `url` is
 * the page START opens, `/prd/<id>`; null in a build with no page to open (the single-file artifact).
 */
export interface PlanetDossier {
  id: string;
  url: string | null;
  latest: Record<DossierArtifactKind, DossierLatest | null>;
  asked: number;
  answered: number;
  last: DossierAnswer[];
}

/** What the arcade knows of one planet's dossier: the dossier, or 'unreadable' when it could not be read. */
export type PlanetDossierRead = PlanetDossier | 'unreadable';

/**
 * The planets' dossiers, by PRD number: a planet with none is absent. 'unreadable' when none could be
 * read at all: every DOSSIER tab then says so, and the rest of the planet is unchanged.
 */
export type DossiersRead = Record<number, PlanetDossierRead> | 'unreadable';

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
  /**
   * Sends the signed-in player's score at a finished game; resolves with their best at that game as
   * stored, the higher of the two. Supabase refuses a visitor, a game not unlocked and a score
   * outside 0 to 9,999,999.
   */
  submitScore(game: string, score: number): Promise<number>;
  /** A game's crew table: its top five with names, and the signed-in player's own best. */
  scores(game: string): Promise<ScoreBoard>;
  signOut(): Promise<void>;
  /** The demo's remembered guest; Supabase answers from the server render instead. */
  restore?(): { session: Session | null; me: Player | null };
}

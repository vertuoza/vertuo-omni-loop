import type { GalaxyView } from '@omni/galaxy';
import { validHero, type Hero } from '@omni/design';
import type { User } from '@supabase/supabase-js';
import type { FleetRow, Player } from '../arcade/types';
import { SOLO, type FleetTag } from '../people/types';
import { UNREADABLE, type PartInput, type Read } from './part';

// The hero block (PRD 328), the dashboard's first part: your hero, your name, your fleet, your season
// points and your two places. The hero, the name and the fleet come from your `players` row and the
// workspace's fleets; the points and places from the galaxy (loadGalaxy), this season. Each of those
// two fails on its own: with the galaxy out of reach, the hero and the fleet still show and only the
// figures say so. Without a player row there is no hero block, only the card that sends you to the
// arcade to play; without a GitHub login, the figures say to link it there. A fleet is optional (PRD
// 400): a player row with no fleet is a solo player, and the block reads SOLO for their fleet.

/** A place in a ranking: `#rank of of`. */
export interface Place { rank: number; of: number }

/** Your season, as the galaxy scores it: your points, your place among the individuals (null with no
 * points yet), and your fleet's place among the fleets (null when the season does not know it). */
export interface Score {
  points: number;
  you: Place | null;
  fleet: (Place & { label: string }) | null;
}

/** Your fleet, as the block names it: its chip (PRD 652), its label and mascot in its colour. A player
 * who plays with no fleet (PRD 400), whose player row has no team, reads SOLO. */
export { SOLO, type FleetTag } from '../people/types';

/** A player's fleet, as the block shows it: their fleet, SOLO with none, or null when their fleet is
 * one the workspace no longer knows. */
export type YouFleet = FleetTag | typeof SOLO | null;

export type YouValue =
  | { kind: 'no-player' }
  | { kind: 'player'; hero: Hero; fleet: YouFleet; score: Score | 'unreadable' | 'no-github' };

/** The demo guest's hero, and anyone's whose stored hero cannot be drawn (src/arcade/account-demo.ts). */
export const DEFAULT_HERO: Hero = { v: 1, body: 'girl', skin: 1, hair: 0, suit: 0, cape: 1 };

const lower = (login: string | null | undefined) => (login ? login.toLowerCase() : null);

/** Your season in the galaxy, by login, ignoring case: your points and place, and your fleet's place. */
export function scoreOf(galaxy: Pick<GalaxyView, 'heroes' | 'teams'>, login: string, team: string | null): Score {
  const hero = galaxy.heroes.find((h) => h.name.toLowerCase() === login.toLowerCase());
  const points = hero?.points ?? 0;
  const fleet = team ? galaxy.teams.find((t) => t.name === team) : undefined;
  return {
    points,
    you: hero && points > 0 ? { rank: hero.rank, of: galaxy.heroes.length } : null,
    fleet: fleet ? { label: fleet.label, rank: fleet.rank, of: galaxy.teams.length } : null,
  };
}

/** The GitHub login linked to this sign-in, if any (as src/data/arcade.ts reads it). */
export function linkedLogin(user: Pick<User, 'identities'>): string | null {
  const d = user.identities?.find((i) => i.provider === 'github')?.identity_data ?? null;
  const login = d?.user_name ?? d?.preferred_username;
  return typeof login === 'string' && login ? login : null;
}

/** The account's first name, for a heading when there is no player's name (as src/data/arcade.ts reads it). */
export function firstName(user: Pick<User, 'user_metadata' | 'email'>): string {
  const m = user.user_metadata ?? {};
  return String(m.given_name ?? m.full_name ?? m.name ?? user.email?.split('@')[0] ?? '').trim().split(/\s+/)[0] ?? '';
}

/** Your GitHub login, in lower case: the player row's, else the account's linked identity. */
export const loginOf = (me: Player | null, user: Pick<User, 'identities'>) => lower(me?.github_login) ?? lower(linkedLogin(user));

/** The block's heading: the player's name, else the account's first name. */
export const nameOf = (me: Player | null, user: Pick<User, 'user_metadata' | 'email'>) => me?.display_name?.trim() || firstName(user);

/**
 * The hero block's read. `me` is your player row as load.ts read it: null with none, 'unreadable'
 * when it could not be read. `fleets` reads the workspace's fleets (loadFleets); the galaxy comes
 * from the input, shared with every part that reads it.
 */
export async function loadYou(input: PartInput, me: Read<Player | null>, fleets: () => Promise<FleetRow[]>): Promise<Read<YouValue>> {
  if (me === UNREADABLE) return UNREADABLE;
  if (!me) return { kind: 'no-player' };
  const found = me.team ? (await fleets()).find((f) => f.name === me.team) : undefined;
  const fleet: YouFleet = !me.team ? SOLO : found ? { name: found.name, label: found.label, color: found.color, mascot: found.mascot ?? null } : null;
  const hero = validHero(me.hero) ? me.hero : DEFAULT_HERO;
  if (!input.login) return { kind: 'player', hero, fleet, score: 'no-github' };
  let score: Score | 'unreadable';
  try {
    score = scoreOf(await input.galaxy(), input.login, me.team);
  } catch (error) {
    console.error(`dashboard: your season could not be read (${(error as Error).message})`);
    score = UNREADABLE;
  }
  return { kind: 'player', hero, fleet, score };
}

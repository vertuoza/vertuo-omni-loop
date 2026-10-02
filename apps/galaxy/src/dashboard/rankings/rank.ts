import type { Fleet, GalaxyView, Hero } from '@omni/galaxy';
import type { Player } from '../../arcade/types';
import type { FleetTag } from '../../people/types';
import { at } from 'vertuo-omni-plan/kit/lib/narrow.ts';

// The rankings' pure functions (PRD 328): both tables, this season, as the galaxy ranks them
// (buildGalaxy: by points, then by name). Every fleet the season knows, yours marked; and the
// individuals around you: the top 3, then you with the person just above and just below, and `⋯`
// for the ranks skipped between them. Ranking 1 to 4 shows ranks 1 to 5, with no gap. You rank
// once you have points this season, found by your GitHub login, ignoring case, as the hero block
// finds you (you.ts's scoreOf).

/** Ranks that are skipped, drawn as `⋯`. */
export const GAP = 'gap';
export type Gap = typeof GAP;

/** One hero of the season around you, and whether it is you. */
export interface HeroRow { rank: number; login: string; points: number; you: boolean }
export type WindowRow = HeroRow | Gap;

/** The individuals' rows and gaps; `ranked` says whether you are among them, with points. */
export interface RankWindow { rows: WindowRow[]; ranked: boolean }

/** Always shown: the season's top 3. */
const TOP = 3;
/** Ranking 1 to 4 shows ranks 1 to this, with no gap. */
const CLOSE = 5;

export function rankWindow(heroes: readonly Pick<Hero, 'name' | 'points' | 'rank'>[], login: string | null): RankWindow {
  const ladder = [...heroes].sort((a, b) => a.rank - b.rank);
  const mine = login?.toLowerCase();
  const me = mine ? ladder.findIndex((h) => h.points > 0 && h.name.toLowerCase() === mine) : -1;
  const shown = new Set<number>();
  const show = (from: number, to: number) => {
    for (let i = Math.max(0, from); i <= Math.min(ladder.length - 1, to); i++) shown.add(i);
  };
  show(0, TOP - 1);
  if (me >= 0) {
    if (me < CLOSE - 1) show(0, CLOSE - 1);
    else show(me - 1, me + 1);
  }
  const rows: WindowRow[] = [];
  let last = -1;
  for (const i of [...shown].sort((a, b) => a - b)) {
    if (i > last + 1) rows.push(GAP);
    const h = at(ladder, i, 'the hero shown');
    rows.push({ rank: h.rank, login: h.name, points: h.points, you: i === me });
    last = i;
  }
  return { rows, ranked: me >= 0 };
}

/** One fleet of the season, and whether it is yours. Its colour and mascot (PRD 652: its chip) are
 * carried when the season gives them, as the galaxy's fleets always do. */
export interface FleetRank {
  rank: number; name: string; label: string; points: number; yours: boolean;
  color?: string | null; mascot?: string | null;
}

/** A fleet as rankFleets reads it: its colour and mascot when known. */
export type RankedTeam = Pick<Fleet, 'name' | 'label' | 'points' | 'rank'> & { color?: string | null; mascot?: string | null };

/** Every fleet the season knows, ranked by points, with yours (`players.team`) marked. */
export function rankFleets(teams: readonly RankedTeam[], team: string | null): FleetRank[] {
  return [...teams]
    .sort((a, b) => a.rank - b.rank)
    .map((t) => ({ rank: t.rank, name: t.name, label: t.label, points: t.points, yours: t.name === team, color: t.color, mascot: t.mascot }));
}

/** A ranked fleet as its chip names it. */
export const fleetTagOf = (f: FleetRank): FleetTag => ({ name: f.name, label: f.label, color: f.color ?? null, mascot: f.mascot ?? null });

/** An individual's row as the table shows it: by display name. */
export interface IndividualRow { rank: number; name: string; points: number; you: boolean }

/** What the rankings show: every fleet, the individuals around you, and where you stand among them:
 * ranked, with no points yet this season, or with no GitHub login to find you by. */
export interface RankingsValue {
  fleets: FleetRank[];
  individuals: (IndividualRow | Gap)[];
  you: 'ranked' | 'no-points' | 'no-github';
}

/**
 * Both tables, from the season's galaxy and the workspace's players: each hero is named by the
 * display name of the player whose GitHub login it is (ignoring case), else by that login.
 */
export function rankingsOf(
  galaxy: { teams: readonly RankedTeam[]; heroes: GalaxyView['heroes'] },
  // display_name is widened to null: the crew's rows are read unparsed.
  crew: readonly (Pick<Player, 'github_login'> & { display_name: string | null })[],
  login: string | null,
  team: string | null,
): RankingsValue {
  const names = new Map<string, string>();
  for (const p of crew) {
    const name = p.display_name?.trim();
    const key = p.github_login?.toLowerCase();
    if (key && name && !names.has(key)) names.set(key, name);
  }
  const { rows, ranked } = rankWindow(galaxy.heroes, login);
  return {
    fleets: rankFleets(galaxy.teams, team),
    individuals: rows.map((r) => (r === GAP ? GAP : { rank: r.rank, name: names.get(r.login.toLowerCase()) ?? r.login, points: r.points, you: r.you })),
    you: !login ? 'no-github' : ranked ? 'ranked' : 'no-points',
  };
}

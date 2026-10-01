// @ts-nocheck
// The game's org facts: sectors and their repositories, the fleets, the roster (GitHub login →
// fleet) and the repositories the game reads. All four live in Supabase (public.sectors,
// public.teams, public.players, public.repositories); this module turns their rows into lookups and
// stays pure. The reads are in sources/supabase.ts.
import { FleetRowSchema, RepositoryRowSchema, RosterRowSchema, SectorRowSchema } from '../kit/lib/schema/fleet.ts';

/**
 * @param rows {{ sectors: {name, repos}[], teams: {name, home, label?, color?, ...}[], roster?: {github_login, team}[], repositories?: {full_name, tracked}[] }}
 */
export function configFrom({ sectors = [], teams = [], roster = [], repositories = [] }) {
  const sectorRows = sectors.map((s) => SectorRowSchema.parse(s));
  const teamRows = teams.map((t) => FleetRowSchema.parse(t));
  const sectorMap = Object.fromEntries(sectorRows.map((s) => [s.name, { repos: s.repos ?? [] }]));
  const teamMap = {};
  for (const t of teamRows) {
    if (t.home && !sectorMap[t.home]) throw new Error(`team ${t.name}: home sector "${t.home}" is not a sector`);
    teamMap[t.name] = {
      home: t.home,
      ...(t.label ? { label: t.label } : {}),
      ...(t.color ? { color: t.color } : {}),
      ...(t.motto !== undefined ? { motto: t.motto } : {}),
      ...(t.mascot !== undefined ? { mascot: t.mascot } : {}),
      ...(t.sort !== undefined ? { sort: t.sort } : {}),
      retired: Boolean(t.retired_at),
    };
  }
  // GitHub logins are case-insensitive: the roster is keyed in lower case. A player whose fleet is
  // retired (or unknown) is left out, so their new events carry no fleet until they choose again.
  const rosterMap = {};
  for (const r of roster.map((x) => RosterRowSchema.parse(x))) {
    if (teamMap[r.team] && !teamMap[r.team].retired) rosterMap[r.github_login.toLowerCase()] = r.team;
  }
  const repoSector = new Map();
  for (const [name, { repos }] of Object.entries(sectorMap)) for (const r of repos) repoSector.set(r, name);
  // PRD 728: the game reads the workspace's tracked repositories (Settings → Repositories), owner/name
  // in lower case. A sector may name a repository by its full name or by its bare name.
  const tracked = [...new Set(repositories.map((r) => RepositoryRowSchema.parse(r)).filter((r) => r.tracked).map((r) => r.full_name.toLowerCase()))].sort();
  const sectorOf = (repo) => (repo ? repoSector.get(repo) ?? repoSector.get(String(repo).split('/').pop()) ?? null : null);
  return {
    sectors: sectorMap,
    teams: teamMap,
    roster: rosterMap,
    repos: [...repoSector.keys()],
    tracked,
    sectorOf,
    homeOf: (team) => teamMap[team]?.home ?? null,
    teamOf: (login) => (login ? rosterMap[String(login).toLowerCase()] ?? null : null),
  };
}

// Ledger events + rulebook + calendar + season → credits and rankings (spec §6). Pure.
import { RULEBOOK } from './rulebook.ts';
import { isWorkingTime, tranchesBetween } from './calendar.ts';
import { planetKeyOf, textOf, type GameEvent } from './events.ts';
import type { Credit, PlanetSeason, Season } from './types.ts';

// A rulebook table's number for a key read off an event's data, or undefined.
const lookup = (table: Readonly<Record<string, number>>, key: unknown): number | undefined =>
  (typeof key === 'string' ? table[key] : undefined);

// The set a map holds under a key, put there first when there is none.
function setOf<K, V>(map: Map<K, Set<V>>, key: K): Set<V> {
  const found = map.get(key);
  if (found) return found;
  const made = new Set<V>();
  map.set(key, made);
  return made;
}

function seasonBounds(season: string): { start: Date; end: Date } {
  const [y = NaN, m = NaN] = season.split('-').map(Number);
  return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1)) };
}

export function score(events: readonly GameEvent[], { season, now }: { season: string; now: Date }): Season {
  const { start, end } = seasonBounds(season);
  const inSeason = (at: string): boolean => at.slice(0, 7) === season;
  const sorted = [...events].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  // A planet is keyed by `<home>#<n>` (PRD 728): two repositories' PRD 88 never share an owner, a
  // crew, a terraform or a clawback. Each credit keeps the PRD's number, its home and that key.
  const ownerOf = new Map<string, string | null>();
  for (const e of sorted) if (e.type === 'PLANET_CHARTED') ownerOf.set(planetKeyOf(e), textOf(e.data, 'ownerTeam') ?? null);
  const ownerFor = (e: GameEvent): string | null => textOf(e.data, 'ownerTeam') ?? ownerOf.get(planetKeyOf(e)) ?? null;
  const where = (e: GameEvent) => ({ planet: e.planet, home: e.home ?? null, key: planetKeyOf(e) });

  const credits: Credit[] = [];
  const credit = (e: GameEvent, points: number, reason: string, to: string | null = e.contributor ?? null, team: string | null = e.team ?? null, extra: { crossTeam?: boolean } = {}) => {
    if (points === 0 || !inSeason(e.at)) return;
    credits.push({ at: e.at, to, team, ...where(e), points, reason, clawed: false, ...extra });
  };
  const SETTLE_VERDICTS = new Set<unknown>(['agreed', 'drifted']);

  const securedPoints = new Map<string, { points: number; at: string }>(); // zone key → { points, at } of its ZONE_SECURED
  const streak = new Map<string, number>();        // team → consecutive terraforms
  const expeditions = new Map<string, Set<string>>();   // planet key → Set(login)
  const closers = new Map<string, Set<string>>();       // planet key → Set(login)
  const teamOfLogin = new Map<string, string>();
  const lostPlanets = new Set<string>();   // planet keys whose PLANET_LOST fell within the season
  const lostAtOf = new Map<string, string>();      // planet key → its PLANET_LOST `at`, any season
  const planets: Record<string, PlanetSeason> = {};              // planet key → its season
  const planetOf = (key: string): PlanetSeason => (planets[key] ??= { ownerTeam: ownerOf.get(key) ?? null, terraformed: false, lost: false, earned: 0 });

  for (const e of sorted) {
    if (e.contributor && e.team) teamOfLogin.set(e.contributor, e.team);
    const key = planetKeyOf(e);
    planetOf(key);
    switch (e.type) {
      case 'ZONE_SECURED': {
        const points = RULEBOOK.zoneSecured * (isWorkingTime(new Date(e.at)) ? 1 : RULEBOOK.nightShiftMultiplier);
        securedPoints.set(e.id.replace(/:secured$/, ''), { points, at: e.at });
        if (e.contributor) setOf(expeditions, key).add(e.contributor);
        credit(e, points, 'zone secured');
        break;
      }
      case 'ZONE_REVERTED': {
        // A revert takes back the secure only when that secure was paid in the same season; a
        // secure from an earlier season is already settled history, so the revert debits 0.
        const secured = securedPoints.get(e.id.replace(/:reverted$/, ''));
        if (secured && secured.at.slice(0, 7) === e.at.slice(0, 7)) credit(e, -secured.points, 'zone reverted');
        break;
      }
      case 'WOUND_CLOSED': {
        // F5a: a settle pays woundClose[kind] for either verdict — an honest `drifted` must not
        // score worse than a rubber-stamp `agreed`; the fault line a drift opens still decays the
        // owner until reworked. Any other verdict (e.g. `undetermined`) scores nothing.
        if (e.data.verdict !== undefined && !SETTLE_VERDICTS.has(e.data.verdict)) break;
        const base = lookup(RULEBOOK.woundClose, e.data.kind) ?? 0;
        const crossTeam = Boolean(e.team && ownerFor(e) && e.team !== ownerFor(e));
        if (e.contributor && base) setOf(closers, key).add(e.contributor);
        credit(e, base * (crossTeam ? RULEBOOK.crossTeamMultiplier : 1), `wound closed: ${String(e.data.kind)}`, undefined, undefined, crossTeam ? { crossTeam: true } : {});
        break;
      }
      case 'RESCUE':
        // F5b: the RESCUE is a ledger fact whoever claims; it pays only a claimer from another team.
        if (e.team && e.team !== ownerFor(e)) credit(e, RULEBOOK.rescue, 'rescue');
        break;
      case 'QUESTION_ANSWERED':
        // PRD 1180: an answer pays its answerer, in the season it was answered, with no multiplier.
        // It opens no wound and joins no crew, so threat, decay and the terraform bonus ignore it.
        credit(e, RULEBOOK.questionAnswered, 'question answered');
        break;
      case 'FEATURE_MERGED':
        // A feature PR merged into its default branch pays who merged it, and each person who
        // approved it, in the season of the merge, with no multiplier. Neither joins a crew.
        credit(e, RULEBOOK.featureMerged, 'feature merged');
        break;
      case 'FEATURE_REVIEWED':
        credit(e, RULEBOOK.featureReviewed, 'feature reviewed');
        break;
      case 'PLANET_TERRAFORMED': {
        const team = ownerFor(e);
        const prior = (team ? streak.get(team) : undefined) ?? 0;
        const regions = e.data.class ?? 1;
        const mult = RULEBOOK.classMultiplier(typeof regions === 'number' ? regions : Number.NaN)
          * (e.data.crossSector ? RULEBOOK.crossSectorMultiplier : 1)
          * (1 + Math.min(RULEBOOK.streakCap, RULEBOOK.streakStep * prior));
        if (team) {
          credit(e, RULEBOOK.terraformOwner * mult, 'planet terraformed', null, team);
          if (inSeason(e.at)) streak.set(team, prior + 1); // season streak (§6.1): only this season's terraforms count
        }
        planetOf(key).terraformed = true;
        const crew = expeditions.get(key) ?? new Set<string>();
        for (const login of crew) credit(e, RULEBOOK.terraformExpedition, 'expedition bonus', login, teamOfLogin.get(login) ?? null);
        for (const login of closers.get(key) ?? []) if (!crew.has(login)) credit(e, RULEBOOK.terraformCloser, 'closer bonus', login, teamOfLogin.get(login) ?? null);
        break;
      }
      case 'PLANET_LOST': {
        const owner = ownerFor(e);
        if (owner && inSeason(e.at)) streak.set(owner, 0);
        planetOf(key).lost = true;
        lostAtOf.set(key, e.at);
        if (inSeason(e.at)) lostPlanets.add(key);
        break;
      }
      // These events score nothing: each is named, so a new event type is a choice, not a silence.
      case 'PLANET_CHARTED': case 'REGION_SURVEYED': case 'PLANET_LOCKED': case 'PLANET_UNLOCKED':
      case 'ZONE_OPENED': case 'ZONE_CLAIMED': case 'WOUND_OPENED': case 'DISTRESS':
      case 'PLANET_READY': case 'PLANET_DECOMMISSIONED':
        break;
    }
  }

  // Decay: owner team, per tranche a wound stays open, clipped to the season and to the planet's loss.
  const closedAt = new Map(sorted.filter((e) => e.type === 'WOUND_CLOSED').map((e) => [e.id.replace(/:closed$/, ''), e.at]));
  for (const e of sorted.filter((e) => e.type === 'WOUND_OPENED')) {
    const team = ownerFor(e);
    if (!team) continue;
    const from = new Date(Math.max(new Date(e.at).getTime(), start.getTime()));
    const closed = closedAt.get(e.id.replace(/:opened$/, ''));
    const lostAt = lostAtOf.get(planetKeyOf(e));
    const to = new Date(Math.min(closed ? new Date(closed).getTime() : now.getTime(), end.getTime(), now.getTime(), lostAt ? new Date(lostAt).getTime() : Infinity));
    const tranches = tranchesBetween(from, to, RULEBOOK.trancheMinutes);
    const points = -tranches * (lookup(RULEBOOK.decayPerTranche, e.data.kind) ?? 0);
    if (points !== 0) credits.push({ at: from.toISOString(), to: null, team, ...where(e), points, reason: `decay: ${String(e.data.kind)}`, clawed: false });
  }

  // Clawback: a PLANET_LOST within the season voids every *earned* credit on that planet in the
  // season (including decay debits computed above, so this must run after that loop) — but a
  // planet's decay is a real cost the team already paid, not a refundable credit; abandonment
  // must not pay, so decay credits (reason `decay: …`) are never clawed back.
  for (const c of credits) if (lostPlanets.has(c.key) && !c.reason.startsWith('decay:')) c.clawed = true;

  const individuals: Record<string, number> = {};
  const teams: Record<string, number> = {};
  for (const c of credits) {
    const p = c.clawed ? 0 : c.points;
    if (c.to) individuals[c.to] = (individuals[c.to] ?? 0) + p;
    if (c.team) teams[c.team] = (teams[c.team] ?? 0) + p;
    if (!c.clawed) planetOf(c.key).earned += c.points;
  }
  return { season, generatedAt: now.toISOString(), credits, individuals, teams, planets, streaks: Object.fromEntries(streak) };
}

// Which seasons `game:score` folds, and which one's rankings it posts. With no argument: the
// current season (UTC month); on the 1st–7th also the previous one, and the posted rankings are the
// previous season's final standings. With an explicit season: that one only.
export function seasonsToScore(now: Date, season?: string | null): { seasons: string[]; rankings: string } {
  if (season) return { seasons: [season], rankings: season };
  const current = now.toISOString().slice(0, 7);
  if (now.getUTCDate() > 7) return { seasons: [current], rankings: current };
  const previous = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
  return { seasons: [previous, current], rankings: previous };
}

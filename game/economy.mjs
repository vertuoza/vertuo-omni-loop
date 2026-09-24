// Ledger events + rulebook + calendar + season → credits and rankings (spec §6). Pure.
import { RULEBOOK } from './rulebook.mjs';
import { isWorkingTime, tranchesBetween } from './calendar.mjs';

function seasonBounds(season) {
  const [y, m] = season.split('-').map(Number);
  return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1)) };
}

export function score(events, { season, now }) {
  const { start, end } = seasonBounds(season);
  const inSeason = (at) => at.slice(0, 7) === season;
  const sorted = [...events].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  const ownerOf = new Map();
  for (const e of sorted) if (e.type === 'PLANET_CHARTED') ownerOf.set(e.planet, e.data.ownerTeam ?? null);
  const ownerFor = (e) => e.data.ownerTeam ?? ownerOf.get(e.planet) ?? null;

  const credits = [];
  const credit = (e, points, reason, to = e.contributor ?? null, team = e.team ?? null, extra = {}) => {
    if (points === 0 || !inSeason(e.at)) return;
    credits.push({ at: e.at, to, team, planet: e.planet, points, reason, clawed: false, ...extra });
  };
  const SETTLE_VERDICTS = new Set(['agreed', 'drifted']);

  const securedPoints = new Map(); // zone key → { points, at } of its ZONE_SECURED
  const streak = new Map();        // team → consecutive terraforms
  const expeditions = new Map();   // planet → Set(login)
  const closers = new Map();       // planet → Set(login)
  const teamOfLogin = new Map();
  const lostPlanets = new Set();   // planets whose PLANET_LOST fell within the season
  const lostAtOf = new Map();      // planet → its PLANET_LOST `at`, any season
  const planets = {};
  const planetOf = (prd) => (planets[prd] ??= { ownerTeam: ownerOf.get(prd) ?? null, terraformed: false, lost: false, earned: 0 });

  for (const e of sorted) {
    if (e.contributor && e.team) teamOfLogin.set(e.contributor, e.team);
    planetOf(e.planet);
    switch (e.type) {
      case 'ZONE_SECURED': {
        const points = RULEBOOK.zoneSecured * (isWorkingTime(new Date(e.at)) ? 1 : RULEBOOK.nightShiftMultiplier);
        securedPoints.set(e.id.replace(/:secured$/, ''), { points, at: e.at });
        if (e.contributor) (expeditions.get(e.planet) ?? expeditions.set(e.planet, new Set()).get(e.planet)).add(e.contributor);
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
        const base = RULEBOOK.woundClose[e.data.kind] ?? 0;
        const crossTeam = Boolean(e.team && ownerFor(e) && e.team !== ownerFor(e));
        if (e.contributor && base) (closers.get(e.planet) ?? closers.set(e.planet, new Set()).get(e.planet)).add(e.contributor);
        credit(e, base * (crossTeam ? RULEBOOK.crossTeamMultiplier : 1), `wound closed: ${e.data.kind}`, undefined, undefined, crossTeam ? { crossTeam: true } : {});
        break;
      }
      case 'RESCUE':
        // F5b: the RESCUE is a ledger fact whoever claims; it pays only a claimer from another team.
        if (e.team && e.team !== ownerFor(e)) credit(e, RULEBOOK.rescue, 'rescue');
        break;
      case 'PLANET_TERRAFORMED': {
        const team = ownerFor(e);
        const prior = streak.get(team) ?? 0;
        const mult = RULEBOOK.classMultiplier(e.data.class ?? 1)
          * (e.data.crossSector ? RULEBOOK.crossSectorMultiplier : 1)
          * (1 + Math.min(RULEBOOK.streakCap, RULEBOOK.streakStep * prior));
        if (team) {
          credit(e, RULEBOOK.terraformOwner * mult, 'planet terraformed', null, team);
          if (inSeason(e.at)) streak.set(team, prior + 1); // season streak (§6.1): only this season's terraforms count
        }
        planetOf(e.planet).terraformed = true;
        const crew = expeditions.get(e.planet) ?? new Set();
        for (const login of crew) credit(e, RULEBOOK.terraformExpedition, 'expedition bonus', login, teamOfLogin.get(login) ?? null);
        for (const login of closers.get(e.planet) ?? []) if (!crew.has(login)) credit(e, RULEBOOK.terraformCloser, 'closer bonus', login, teamOfLogin.get(login) ?? null);
        break;
      }
      case 'PLANET_LOST': {
        if (ownerFor(e) && inSeason(e.at)) streak.set(ownerFor(e), 0);
        planetOf(e.planet).lost = true;
        lostAtOf.set(e.planet, e.at);
        if (inSeason(e.at)) lostPlanets.add(e.planet);
        break;
      }
      default:
        break;
    }
  }

  // Decay: owner team, per tranche a wound stays open, clipped to the season and to the planet's loss.
  const closedAt = new Map(sorted.filter((e) => e.type === 'WOUND_CLOSED').map((e) => [e.id.replace(/:closed$/, ''), e.at]));
  for (const e of sorted.filter((e) => e.type === 'WOUND_OPENED')) {
    const team = ownerFor(e);
    if (!team) continue;
    const from = new Date(Math.max(new Date(e.at), start));
    const closed = closedAt.get(e.id.replace(/:opened$/, ''));
    const lostAt = lostAtOf.get(e.planet);
    const to = new Date(Math.min(closed ? new Date(closed) : now, end, now, lostAt ? new Date(lostAt) : Infinity));
    const tranches = tranchesBetween(from, to, RULEBOOK.trancheMinutes);
    const points = -tranches * (RULEBOOK.decayPerTranche[e.data.kind] ?? 0);
    if (points !== 0) credits.push({ at: from.toISOString(), to: null, team, planet: e.planet, points, reason: `decay: ${e.data.kind}`, clawed: false });
  }

  // Clawback: a PLANET_LOST within the season voids every *earned* credit on that planet in the
  // season (including decay debits computed above, so this must run after that loop) — but a
  // planet's decay is a real cost the team already paid, not a refundable credit; abandonment
  // must not pay, so decay credits (reason `decay: …`) are never clawed back.
  for (const c of credits) if (lostPlanets.has(c.planet) && !c.reason.startsWith('decay:')) c.clawed = true;

  const individuals = {};
  const teams = {};
  for (const c of credits) {
    const p = c.clawed ? 0 : c.points;
    if (c.to) individuals[c.to] = (individuals[c.to] ?? 0) + p;
    if (c.team) teams[c.team] = (teams[c.team] ?? 0) + p;
    if (!c.clawed) planetOf(c.planet).earned += c.points;
  }
  return { season, generatedAt: now.toISOString(), credits, individuals, teams, planets, streaks: Object.fromEntries(streak) };
}

// Which seasons `game:score` folds, and which one's rankings it posts. With no argument: the
// current season (UTC month); on the 1st–7th also the previous one, and the posted rankings are the
// previous season's final standings. With an explicit season: that one only.
export function seasonsToScore(now, season) {
  if (season) return { seasons: [season], rankings: season };
  const current = now.toISOString().slice(0, 7);
  if (now.getUTCDate() > 7) return { seasons: [current], rankings: current };
  const previous = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
  return { seasons: [previous, current], rankings: previous };
}

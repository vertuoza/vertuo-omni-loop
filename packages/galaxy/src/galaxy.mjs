// Ledger events → the galaxy the arcade UI draws. Pure, and read-only like the rest of the game:
// the same events come from game/ledger/*.jsonl, from Supabase, or from the demo world. Points
// and rankings are never recomputed here; they come from game/economy.mjs.
import { RULEBOOK } from 'vertuo-omni-plan/game/rulebook.mjs';
import { tranchesBetween } from 'vertuo-omni-plan/game/calendar.mjs';
import { score } from 'vertuo-omni-plan/game/economy.mjs';

const ZONE_ID = /^zone:(.+?):(\d+):(.+):(opened|claimed|secured|reverted)$/;
const FIRE_ID = /^fire:(.+?):(\d+)\/(.+)$/;

export const WOUND_LABEL = Object.freeze({
  transmission: 'Transmission',
  'unconfirmed-ground': 'Unconfirmed ground',
  beacon: 'Beacon',
  'fault-line': 'Fault line',
  'under-fire': 'Zone under fire',
  aftershock: 'Aftershock',
});

export const STATE_LABEL = Object.freeze({
  charted: 'Charted',
  locked: 'Locked',
  terraforming: 'Terraforming',
  distress: 'Distress',
  'awaiting-command': 'Awaiting command',
  terraformed: 'Terraformed',
  aftershock: 'Aftershock',
  lost: 'Lost',
  decommissioned: 'Decommissioned',
});

const woundKey = (id) => id.replace(/:(opened|closed)$/, '');

function logLine(e) {
  const who = e.contributor ? `@${e.contributor}` : null;
  const where = e.region ? ` in ${e.region}` : '';
  const zone = ZONE_ID.exec(e.id)?.[3];
  const kind = WOUND_LABEL[e.data?.kind] ?? e.data?.kind;
  switch (e.type) {
    case 'PLANET_CHARTED': return `Planet charted by @${e.data.captain ?? 'unknown'}`;
    case 'REGION_SURVEYED': return `Region surveyed: ${e.region}`;
    case 'PLANET_LOCKED': return `Locked behind planet #${e.data.blocker}`;
    case 'PLANET_UNLOCKED': return `Unlocked: planet #${e.data.blocker} terraformed`;
    case 'ZONE_OPENED': return `Zone ${zone} opened${where}`;
    case 'ZONE_CLAIMED': return `${who ?? 'Someone'} claimed zone ${zone}${where}`;
    case 'ZONE_SECURED': return `${who ?? 'Someone'} secured zone ${zone}${where}`;
    case 'ZONE_REVERTED': return `Zone ${zone} reverted${where}`;
    case 'WOUND_OPENED': return `Entropy landed: ${kind}${where}`;
    case 'WOUND_CLOSED': return `${who ?? 'Someone'} cleared ${kind}${e.data.verdict ? ` (${e.data.verdict})` : ''}`;
    case 'DISTRESS': return 'Distress call: no claim for 8 working hours';
    case 'RESCUE': return `${who ?? 'Someone'} answered the distress call`;
    case 'PLANET_READY': return 'Every zone secured. Awaiting command';
    case 'PLANET_TERRAFORMED': return 'PLANET TERRAFORMED';
    case 'PLANET_LOST': return e.data.reason === 'closed' ? 'Planet lost: PRD closed mid-terraform' : 'Planet lost: 10 working days of silence';
    case 'PLANET_DECOMMISSIONED': return 'Planet decommissioned';
    default: return e.type;
  }
}

const line = (e) => ({ at: e.at, type: e.type, planet: e.planet, text: logLine(e), contributor: e.contributor ?? null, team: e.team ?? null });

function threatOf(openWounds, inDistress) {
  let s = inDistress ? RULEBOOK.threatWeights.distress : 0;
  for (const w of openWounds) s += RULEBOOK.threatWeights[w.kind] * (1 + w.ageTranches / 6);
  let level = 1;
  RULEBOOK.threatBands.forEach((band, i) => { if (s >= band) level = i + 1; });
  return level;
}

function derive(prd, events, { sectorOf, now }) {
  const p = {
    prd, title: `PRD #${prd}`, captain: null, ownerTeam: null, chartedAt: null,
    regions: [], blockers: new Set(), zones: new Map(), wounds: new Map(), distress: new Map(), rescues: new Set(),
    ready: false, terraformedAt: null, lostAt: null, lostReason: null, decommissioned: false,
    expeditions: new Set(), rescuers: new Map(),
  };
  const zoneOf = (region, id) => {
    const key = `${region}:${id}`;
    if (!p.zones.has(key)) p.zones.set(key, { id, region, wave: null, state: 'open', contributor: null, team: null, at: null });
    return p.zones.get(key);
  };
  for (const e of events) {
    switch (e.type) {
      case 'PLANET_CHARTED':
        p.title = e.data.title ?? p.title; p.captain = e.data.captain ?? null; p.ownerTeam = e.data.ownerTeam ?? null; p.chartedAt = e.at;
        break;
      case 'REGION_SURVEYED': if (!p.regions.includes(e.region)) p.regions.push(e.region); break;
      case 'PLANET_LOCKED': p.blockers.add(e.data.blocker); break;
      case 'PLANET_UNLOCKED': p.blockers.delete(e.data.blocker); break;
      case 'ZONE_OPENED': case 'ZONE_CLAIMED': case 'ZONE_SECURED': case 'ZONE_REVERTED': {
        const [, region, , id, step] = ZONE_ID.exec(e.id) ?? [];
        if (!region) break;
        const z = zoneOf(region, id);
        if (e.data.wave !== undefined) z.wave = e.data.wave;
        z.at = e.at;
        if (step === 'claimed') { z.state = 'claimed'; z.contributor = e.contributor ?? null; z.team = e.team ?? null; }
        if (step === 'secured') { z.state = 'secured'; z.contributor = e.contributor ?? z.contributor; z.team = e.team ?? z.team; }
        if (step === 'reverted') z.state = 'open';
        if ((step === 'claimed' || step === 'secured') && e.contributor) p.expeditions.add(e.contributor);
        break;
      }
      case 'WOUND_OPENED':
        p.wounds.set(woundKey(e.id), { id: woundKey(e.id), kind: e.data.kind, rank: e.data.rank ?? null, region: e.region ?? null, openedAt: e.at, closedAt: null, closedBy: null });
        break;
      case 'WOUND_CLOSED': {
        const w = p.wounds.get(woundKey(e.id));
        if (w) { w.closedAt = e.at; w.closedBy = e.contributor ?? null; }
        if (e.contributor && e.team && p.ownerTeam && e.team !== p.ownerTeam) p.rescuers.set(e.contributor, e.team);
        break;
      }
      case 'DISTRESS': p.distress.set(e.id.replace(':distress:', ':'), e.at); break;
      case 'RESCUE':
        p.rescues.add(e.id.replace(':rescue:', ':'));
        if (e.contributor && e.team !== p.ownerTeam) p.rescuers.set(e.contributor, e.team ?? null);
        break;
      case 'PLANET_READY': p.ready = true; break;
      case 'PLANET_TERRAFORMED': p.terraformedAt = e.at; break;
      case 'PLANET_LOST': p.lostAt = e.at; p.lostReason = e.data.reason ?? null; break;
      case 'PLANET_DECOMMISSIONED': p.decommissioned = true; break;
      default: break;
    }
  }

  // A zone whose sub-PR carries `omni:needs-fix` shows as under fire while that wound is open.
  for (const w of p.wounds.values()) {
    const m = FIRE_ID.exec(w.id);
    if (m && !w.closedAt) { const z = p.zones.get(`${m[1]}:${m[3]}`); if (z && z.state !== 'secured') z.state = 'under-fire'; }
  }

  const zones = [...p.zones.values()].sort((a, b) => (a.wave ?? 99) - (b.wave ?? 99) || a.region.localeCompare(b.region) || a.id.localeCompare(b.id, 'en', { numeric: true }));
  const openWounds = [...p.wounds.values()].filter((w) => !w.closedAt).map((w) => ({
    ...w,
    ageTranches: tranchesBetween(new Date(w.openedAt), now, RULEBOOK.trancheMinutes),
    ageHours: Math.max(0, Math.round((now - new Date(w.openedAt)) / 3600000)),
    decayPerTranche: RULEBOOK.decayPerTranche[w.kind] ?? 0,
  })).sort((a, b) => b.decayPerTranche - a.decayPerTranche || a.openedAt.localeCompare(b.openedAt));
  const unanswered = [...p.distress.entries()].filter(([k]) => !p.rescues.has(k)).map(([, at]) => at).sort();
  const secured = zones.filter((z) => z.state === 'secured').length;

  let state;
  if (p.decommissioned) state = 'decommissioned';
  else if (p.lostAt) state = 'lost';
  else if (p.terraformedAt) state = openWounds.some((w) => w.kind === 'aftershock') ? 'aftershock' : 'terraformed';
  else if (p.blockers.size) state = 'locked';
  else if (p.ready) state = 'awaiting-command';
  else if (unanswered.length) state = 'distress';
  else if (zones.length) state = 'terraforming';
  else state = 'charted';

  const sectors = [...new Set(p.regions.map(sectorOf).filter(Boolean))];
  return {
    prd, title: p.title, captain: p.captain, ownerTeam: p.ownerTeam, state,
    regions: p.regions, sectors, crossSector: sectors.length > 1, class: Math.max(1, Math.min(4, p.regions.length)),
    blockers: [...p.blockers].sort((a, b) => a - b),
    zones, secured, progress: state === 'terraformed' || state === 'aftershock' ? 1 : zones.length ? secured / zones.length : 0,
    openWounds, closedWounds: [...p.wounds.values()].filter((w) => w.closedAt).length,
    threat: threatOf(openWounds, state === 'distress'),
    distressSince: state === 'distress' ? unanswered.at(-1) : null,
    expeditions: [...p.expeditions].sort(),
    rescuers: [...p.rescuers.entries()].map(([login, team]) => ({ login, team })),
    chartedAt: p.chartedAt, terraformedAt: p.terraformedAt, lostAt: p.lostAt, lostReason: p.lostReason,
    lastEventAt: events.at(-1)?.at ?? null,
    log: events.slice(-40).reverse().map(line),
  };
}

// A fleet's look, with plain defaults for a fleet that has none (a new row, or an old config).
export function lookOf(name, fleet = {}) {
  return {
    home: fleet.home ?? null,
    label: fleet.label ?? name.toUpperCase().slice(0, 12),
    color: fleet.color ?? '#cfd4e6',
    motto: fleet.motto ?? '',
    mascot: fleet.mascot ?? null,
    sort: fleet.sort ?? 0,
    retired: Boolean(fleet.retired),
  };
}

/**
 * @param events ledger events (any order)
 * @param o { projects: { sectors: {name: {repos}}, teams: {name: {home, label, color, motto, mascot, sort, retired}} }, now: Date, source: string }
 */
export function buildGalaxy(events, { projects, now = new Date(), source = 'ledger' }) {
  const sorted = [...events].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  const repoSector = new Map();
  for (const [name, { repos }] of Object.entries(projects.sectors)) for (const r of repos) repoSector.set(r, name);
  const sectorOf = (repo) => repoSector.get(repo) ?? null;

  const byPlanet = new Map();
  for (const e of sorted) (byPlanet.get(e.planet) ?? byPlanet.set(e.planet, []).get(e.planet)).push(e);
  const season = now.toISOString().slice(0, 7);
  const season_ = score(sorted, { season, now });

  const planets = [...byPlanet.entries()].map(([prd, evs]) => {
    const planet = derive(prd, evs, { sectorOf, now });
    // Home sector: where most of its regions live, else its owning fleet's home.
    const counts = new Map();
    for (const r of planet.regions) { const s = sectorOf(r); if (s) counts.set(s, (counts.get(s) ?? 0) + 1); }
    const home = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0]
      ?? projects.teams[planet.ownerTeam]?.home ?? Object.keys(projects.sectors)[0] ?? null;
    return { ...planet, sector: home, earned: Math.round(season_.planets[prd]?.earned ?? 0) };
  }).sort((a, b) => a.prd - b.prd);

  const loginTeam = new Map();
  for (const e of sorted) if (e.contributor && e.team) loginTeam.set(e.contributor, e.team);

  const rank = (entries) => entries.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name)).map((x, i) => ({ ...x, rank: i + 1 }));
  // A retired fleet stays in the view only while this season still remembers it.
  const teams = rank(Object.entries(projects.teams).map(([name, fleet]) => {
    const owned = planets.filter((p) => p.ownerTeam === name);
    return {
      name, ...lookOf(name, fleet), points: Math.round(season_.teams[name] ?? 0),
      planets: owned.length,
      terraformed: owned.filter((p) => p.state === 'terraformed' || p.state === 'aftershock').length,
      inDistress: owned.filter((p) => p.state === 'distress').length,
      openWounds: owned.reduce((n, p) => n + p.openWounds.length, 0),
      streak: season_.streaks[name] ?? 0,
      members: [...loginTeam.entries()].filter(([, t]) => t === name).map(([l]) => l).sort(),
    };
  }).filter((t) => !t.retired || t.points || t.planets || t.members.length));
  const heroes = rank(Object.entries(season_.individuals).map(([name, points]) => ({ name, team: loginTeam.get(name) ?? null, points: Math.round(points) })));

  return {
    generatedAt: now.toISOString(),
    season,
    source,
    sectors: Object.entries(projects.sectors).map(([name, { repos }]) => ({
      name, repos, fleets: Object.entries(projects.teams).filter(([, t]) => t.home === name && !t.retired).map(([t]) => t),
    })),
    teams,
    heroes,
    planets,
    feed: sorted.slice(-30).reverse().map(line),
    totals: {
      planets: planets.length,
      terraformed: planets.filter((p) => p.state === 'terraformed' || p.state === 'aftershock').length,
      openWounds: planets.reduce((n, p) => n + p.openWounds.length, 0),
      inDistress: planets.filter((p) => p.state === 'distress').length,
      events: sorted.length,
    },
    rules: {
      zoneSecured: RULEBOOK.zoneSecured,
      woundClose: RULEBOOK.woundClose,
      decayPerTranche: RULEBOOK.decayPerTranche,
      trancheHours: RULEBOOK.trancheMinutes / 60,
      rescue: RULEBOOK.rescue,
      terraformOwner: RULEBOOK.terraformOwner,
      terraformExpedition: RULEBOOK.terraformExpedition,
      terraformCloser: RULEBOOK.terraformCloser,
      crossTeamMultiplier: RULEBOOK.crossTeamMultiplier,
      nightShiftMultiplier: RULEBOOK.nightShiftMultiplier,
      distressAfterHours: RULEBOOK.distressAfterWorkingMinutes / 60,
      lostAfterDays: RULEBOOK.lostAfterWorkingMinutes / 60 / 9,
      classMultipliers: [1, 2, 3, 4].map((n) => RULEBOOK.classMultiplier(n)),
    },
  };
}

// A world snapshot → the full set of game events it implies. The ledger keeps the new ones (spec §7.1).
import { RULEBOOK } from './rulebook.mjs';
import { addWorkingMinutes } from './calendar.mjs';
import { makeEvent, planetKey } from './events.mjs';
import { derivePlanet, distressEpisodes } from './planet-state.mjs';

const iso = (d) => d.toISOString().replace('.000Z', 'Z');

// F4: an event that fails validation (a malformed timestamp that slipped through) is skipped and
// reported through `onSkip({ id, message })`; one bad fact never stops the rest of the poll. A planet
// whose state cannot be derived at all is reported the same way, under the id `planet:<key>`. Every id
// names the PRD by its key, `<home>#<n>` (PRD 728; the number alone for a snapshot with no home).
export function projectEvents(snapshot, { config, now, onSkip = () => {} }) {
  // A planet is named by its key, `<home>#<n>` (PRD 728): a blocker is the PRD of that number in the same home.
  const terraformedAt = new Map(snapshot.planets.filter((p) => p.featurePr?.mergedAt).map((p) => [planetKey(p.home, p.prd), p.featurePr.mergedAt]));
  const terraformedPlanets = new Set(terraformedAt.keys());
  const events = [];
  // Logins are case-insensitive; the roster is keyed in lower case.
  const teamOf = (login) => snapshot.teams[login] ?? snapshot.teams[String(login).toLowerCase()];
  // Controller ruling: EventSchema accepts `contributor` as a string or absent, never `null`.
  // When a login is null/undefined (e.g. an unclaimed zone's author, a wound's closedBy),
  // omit both `contributor` and `team` instead of passing `null`.
  const push = (fields) => {
    const { contributor, ...rest } = fields;
    try {
      events.push(makeEvent({
        ...rest,
        ...(contributor ? { contributor, ...(teamOf(contributor) ? { team: teamOf(contributor) } : {}) } : {}),
      }));
    } catch (err) {
      onSkip({ id: fields.id, message: err.issues ? err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') : err.message });
    }
  };

  for (const planet of snapshot.planets) {
    const prd = planet.prd;
    const key = planetKey(planet.home, prd);
    const on = { planet: prd, ...(planet.home ? { home: planet.home } : {}) }; // every event names its home
    let state;
    try {
      state = derivePlanet(planet, { config, terraformedPlanets, now });
    } catch (err) {
      onSkip({ id: `planet:${key}`, message: err.message });
      continue;
    }
    push({ id: `planet:${key}:charted`, at: planet.issue.createdAt, type: 'PLANET_CHARTED', ...on, data: { captain: planet.captain, ownerTeam: planet.ownerTeam, title: planet.title } });

    for (const r of planet.regions) {
      push({ id: `region:${r.repo}:${key}:surveyed`, at: r.surveyedAt, type: 'REGION_SURVEYED', ...on, region: r.repo });
      for (const blocker of r.blockedBy) {
        push({ id: `planet:${key}:locked:${blocker}`, at: r.surveyedAt, type: 'PLANET_LOCKED', ...on, data: { blocker } });
        if (terraformedAt.has(planetKey(planet.home, blocker))) push({ id: `planet:${key}:unlocked:${blocker}`, at: terraformedAt.get(planetKey(planet.home, blocker)), type: 'PLANET_UNLOCKED', ...on, data: { blocker } });
      }
    }

    for (const z of state.zones) {
      const zoneKey = `zone:${z.repo}:${key}:${z.id}`;
      const base = { ...on, region: z.repo };
      if (z.openedAt) push({ id: `${zoneKey}:opened`, at: z.openedAt, type: 'ZONE_OPENED', ...base, data: { wave: z.wave } });
      if (z.claimedAt) push({ id: `${zoneKey}:claimed`, at: z.claimedAt, type: 'ZONE_CLAIMED', ...base, contributor: z.author, data: { pr: prNumber(planet, z.id, z.repo) } });
      if (z.securedAt) push({ id: `${zoneKey}:secured`, at: z.securedAt, type: 'ZONE_SECURED', ...base, contributor: z.author, data: { pr: prNumber(planet, z.id, z.repo) } });
      if (z.revertedAt) push({ id: `${zoneKey}:reverted`, at: z.revertedAt, type: 'ZONE_REVERTED', ...base, contributor: z.author, data: { pr: prNumber(planet, z.id, z.repo) } });
    }

    // F5b: one DISTRESS per planet-level idle episode, and a RESCUE for the claim that answered it.
    // The RESCUE is always emitted; the economy pays it only when the claimer is from another team.
    for (const ep of distressEpisodes(state.zones, now)) {
      push({ id: `planet:${key}:distress:${ep.start}`, at: ep.distressAt, type: 'DISTRESS', ...on });
      if (ep.rescue) push({ id: `planet:${key}:rescue:${ep.start}`, at: ep.rescue.at, type: 'RESCUE', ...on, region: ep.rescue.repo, contributor: ep.rescue.author, data: { pr: prNumber(planet, ep.rescue.zone, ep.rescue.repo), zone: ep.rescue.zone } });
    }

    for (const w of state.wounds) {
      const data = { kind: w.kind, ...(w.rank ? { rank: w.rank } : {}) };
      push({ id: `${w.id}:opened`, at: w.openedAt, type: 'WOUND_OPENED', ...on, region: w.repo, data });
      if (w.closedAt) push({ id: `${w.id}:closed`, at: w.closedAt, type: 'WOUND_CLOSED', ...on, region: w.repo, contributor: w.closedBy, data: { ...data, ...(w.verdict ? { verdict: w.verdict } : {}) } });
    }

    const fp = planet.featurePr;
    if (fp?.readyAt && state.zones.length && state.zones.every((z) => z.state === 'secured')) push({ id: `planet:${key}:ready`, at: fp.readyAt, type: 'PLANET_READY', ...on });
    if (fp?.mergedAt) push({ id: `planet:${key}:terraformed`, at: fp.mergedAt, type: 'PLANET_TERRAFORMED', ...on, data: { ownerTeam: planet.ownerTeam, class: state.class, crossSector: state.crossSector } });
    if (state.state === 'lost') {
      const at = planet.issue.closedAt ?? iso(addWorkingMinutes(new Date(state.lastActivityAt), RULEBOOK.lostAfterWorkingMinutes));
      push({ id: `planet:${key}:lost`, at, type: 'PLANET_LOST', ...on, data: { ownerTeam: planet.ownerTeam, reason: planet.issue.closedAt ? 'closed' : 'silence' } });
    }
    if (state.state === 'decommissioned') push({ id: `planet:${key}:decommissioned`, at: planet.issue.closedAt, type: 'PLANET_DECOMMISSIONED', ...on });
  }
  return events.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
}

function prNumber(planet, zoneId, repo) {
  return planet.zones.find((z) => z.id === zoneId && (!repo || z.repo === repo))?.pr?.number ?? null;
}

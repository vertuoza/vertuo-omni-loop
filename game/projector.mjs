// A world snapshot → the full set of game events it implies. The ledger keeps the new ones (spec §7.1).
import { RULEBOOK } from './rulebook.mjs';
import { addWorkingMinutes } from './calendar.mjs';
import { makeEvent } from './events.mjs';
import { derivePlanet, distressEpisodes } from './planet-state.mjs';

const iso = (d) => d.toISOString().replace('.000Z', 'Z');

// F4: an event that fails validation (a malformed timestamp that slipped through) is skipped and
// reported through `onSkip({ id, message })`; one bad fact never stops the rest of the poll. A planet
// whose state cannot be derived at all is reported the same way, under the id `planet:<prd>`.
export function projectEvents(snapshot, { config, now, onSkip = () => {} }) {
  const terraformedAt = new Map(snapshot.planets.filter((p) => p.featurePr?.mergedAt).map((p) => [p.prd, p.featurePr.mergedAt]));
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
    let state;
    try {
      state = derivePlanet(planet, { config, terraformedPlanets, now });
    } catch (err) {
      onSkip({ id: `planet:${prd}`, message: err.message });
      continue;
    }
    push({ id: `planet:${prd}:charted`, at: planet.issue.createdAt, type: 'PLANET_CHARTED', planet: prd, data: { captain: planet.captain, ownerTeam: planet.ownerTeam, title: planet.title } });

    for (const r of planet.regions) {
      push({ id: `region:${r.repo}:${prd}:surveyed`, at: r.surveyedAt, type: 'REGION_SURVEYED', planet: prd, region: r.repo });
      for (const blocker of r.blockedBy) {
        push({ id: `planet:${prd}:locked:${blocker}`, at: r.surveyedAt, type: 'PLANET_LOCKED', planet: prd, data: { blocker } });
        if (terraformedAt.has(blocker)) push({ id: `planet:${prd}:unlocked:${blocker}`, at: terraformedAt.get(blocker), type: 'PLANET_UNLOCKED', planet: prd, data: { blocker } });
      }
    }

    for (const z of state.zones) {
      const key = `zone:${z.repo}:${prd}:${z.id}`;
      const base = { planet: prd, region: z.repo };
      if (z.openedAt) push({ id: `${key}:opened`, at: z.openedAt, type: 'ZONE_OPENED', ...base, data: { wave: z.wave } });
      if (z.claimedAt) push({ id: `${key}:claimed`, at: z.claimedAt, type: 'ZONE_CLAIMED', ...base, contributor: z.author, data: { pr: prNumber(planet, z.id, z.repo) } });
      if (z.securedAt) push({ id: `${key}:secured`, at: z.securedAt, type: 'ZONE_SECURED', ...base, contributor: z.author, data: { pr: prNumber(planet, z.id, z.repo) } });
      if (z.revertedAt) push({ id: `${key}:reverted`, at: z.revertedAt, type: 'ZONE_REVERTED', ...base, contributor: z.author, data: { pr: prNumber(planet, z.id, z.repo) } });
    }

    // F5b: one DISTRESS per planet-level idle episode, and a RESCUE for the claim that answered it.
    // The RESCUE is always emitted; the economy pays it only when the claimer is from another team.
    for (const ep of distressEpisodes(state.zones, now)) {
      push({ id: `planet:${prd}:distress:${ep.start}`, at: ep.distressAt, type: 'DISTRESS', planet: prd });
      if (ep.rescue) push({ id: `planet:${prd}:rescue:${ep.start}`, at: ep.rescue.at, type: 'RESCUE', planet: prd, region: ep.rescue.repo, contributor: ep.rescue.author, data: { pr: prNumber(planet, ep.rescue.zone, ep.rescue.repo), zone: ep.rescue.zone } });
    }

    for (const w of state.wounds) {
      const data = { kind: w.kind, ...(w.rank ? { rank: w.rank } : {}) };
      push({ id: `${w.id}:opened`, at: w.openedAt, type: 'WOUND_OPENED', planet: prd, region: w.repo, data });
      if (w.closedAt) push({ id: `${w.id}:closed`, at: w.closedAt, type: 'WOUND_CLOSED', planet: prd, region: w.repo, contributor: w.closedBy, data: { ...data, ...(w.verdict ? { verdict: w.verdict } : {}) } });
    }

    const fp = planet.featurePr;
    if (fp?.readyAt && state.zones.length && state.zones.every((z) => z.state === 'secured')) push({ id: `planet:${prd}:ready`, at: fp.readyAt, type: 'PLANET_READY', planet: prd });
    if (fp?.mergedAt) push({ id: `planet:${prd}:terraformed`, at: fp.mergedAt, type: 'PLANET_TERRAFORMED', planet: prd, data: { ownerTeam: planet.ownerTeam, class: state.class, crossSector: state.crossSector } });
    if (state.state === 'lost') {
      const at = planet.issue.closedAt ?? iso(addWorkingMinutes(new Date(state.lastActivityAt), RULEBOOK.lostAfterWorkingMinutes));
      push({ id: `planet:${prd}:lost`, at, type: 'PLANET_LOST', planet: prd, data: { ownerTeam: planet.ownerTeam, reason: planet.issue.closedAt ? 'closed' : 'silence' } });
    }
    if (state.state === 'decommissioned') push({ id: `planet:${prd}:decommissioned`, at: planet.issue.closedAt, type: 'PLANET_DECOMMISSIONED', planet: prd });
  }
  return events.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
}

function prNumber(planet, zoneId, repo) {
  return planet.zones.find((z) => z.id === zoneId && (!repo || z.repo === repo))?.pr?.number ?? null;
}

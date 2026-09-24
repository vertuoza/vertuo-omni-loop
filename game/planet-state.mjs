// A snapshot planet → derived state. Nothing here is stored; it is recomputed every time (spec §5).
import { RULEBOOK } from './rulebook.mjs';
import { addWorkingMinutes, tranchesBetween } from './calendar.mjs';

export const WOUND_KIND_BY_RANK = Object.freeze({ medium: 'transmission', high: 'unconfirmed-ground', 'human-action': 'beacon' });

const iso = (d) => d.toISOString().replace('.000Z', 'Z');
const maxIso = (...xs) => xs.filter(Boolean).sort().at(-1) ?? null;

export function deriveZones(planet) {
  const byId = new Map(planet.zones.map((z) => [z.id, z]));
  return planet.zones.map((z) => {
    const blockers = z.blockedBy.map((id) => byId.get(id)).filter(Boolean);
    const allMerged = blockers.every((b) => b.pr?.mergedAt);
    // F3: a zone opens against its own region's feature PR (falling back to the planet's aggregate).
    const regionFp = planet.regions.find((r) => r.repo === z.repo)?.featurePr ?? planet.featurePr;
    const openedAt = allMerged && planet.featurePr
      ? maxIso(regionFp?.createdAt ?? planet.featurePr.createdAt, ...blockers.map((b) => b.pr.mergedAt))
      : null;
    let state = 'sealed';
    if (z.pr?.mergedAt && !z.pr.revertedAt) state = 'secured';
    else if (z.pr?.labels.includes('pr:needs-fix')) state = 'under-fire';
    else if (z.pr && !z.pr.mergedAt) state = 'claimed';
    else if (allMerged && planet.featurePr) state = 'open';
    return {
      id: z.id, repo: z.repo, wave: z.wave, state, openedAt,
      claimedAt: z.pr?.createdAt ?? null, securedAt: z.pr?.mergedAt ?? null,
      revertedAt: z.pr?.revertedAt ?? null, author: z.pr?.author ?? null,
    };
  });
}

export function deriveWounds(planet, now) {
  const wounds = [];
  for (const z of planet.zones) {
    // F1: the label history (`pr.needsFix`) comes off the sub-PR's timeline. A snapshot without it
    // (a failed timeline read) falls back to "labelled since the sub-PR was opened, still labelled".
    const fire = z.pr?.needsFix ?? (z.pr?.labels.includes('pr:needs-fix') ? { labeledAt: z.pr.createdAt, unlabeledAt: null } : null);
    if (fire) {
      const closedAt = fire.unlabeledAt ?? z.pr.mergedAt ?? null;
      wounds.push({ id: `fire:${z.repo}:${planet.prd}/${z.id}`, kind: 'under-fire', repo: z.repo, openedAt: fire.labeledAt, closedAt, closedBy: closedAt ? z.pr.author : null });
    }
  }
  for (const item of planet.outbox) {
    const base = { id: `outbox:${item.repo}:${planet.prd}/${item.id}`, kind: WOUND_KIND_BY_RANK[item.rank], rank: item.rank, repo: item.repo, openedAt: item.raisedAt };
    if (!item.settled) wounds.push({ ...base, closedAt: null, closedBy: null });
    else {
      wounds.push({ ...base, closedAt: item.settled.at, closedBy: item.settled.by, verdict: item.settled.verdict });
      if (item.settled.verdict === 'drifted') {
        wounds.push({ id: `fault:${item.repo}:${planet.prd}/${item.id}`, kind: 'fault-line', repo: item.repo, openedAt: item.settled.at, closedAt: item.settled.reworkMergedAt ?? null, closedBy: item.settled.reworkMergedAt ? item.settled.reworkBy ?? null : null });
      }
    }
  }
  const mergedAt = planet.featurePr?.mergedAt;
  if (mergedAt) {
    const windowEnd = new Date(new Date(mergedAt).getTime() + RULEBOOK.aftershockWindowDays * 86400000);
    for (const b of planet.bugs) {
      if (new Date(b.createdAt) >= new Date(mergedAt) && new Date(b.createdAt) <= windowEnd) {
        wounds.push({ id: `bug:${b.repo}#${b.number}`, kind: 'aftershock', repo: b.repo, openedAt: b.createdAt, closedAt: b.closedAt, closedBy: b.closedBy });
      }
    }
  }
  return wounds;
}

function distressSince(zones, now) {
  const times = zones
    .filter((z) => z.state === 'open' && z.openedAt)
    .map((z) => addWorkingMinutes(new Date(z.openedAt), RULEBOOK.distressAfterWorkingMinutes))
    .filter((t) => t <= now);
  return times.length ? iso(new Date(Math.min(...times.map((t) => t.getTime())))) : null;
}

function lastActivity(planet) {
  return maxIso(
    planet.issue.createdAt, planet.featurePr?.createdAt, planet.featurePr?.lastActivityAt, planet.featurePr?.mergedAt,
    ...planet.zones.flatMap((z) => [z.pr?.createdAt, z.pr?.mergedAt, z.pr?.needsFix?.labeledAt, z.pr?.needsFix?.unlabeledAt]),
    ...planet.outbox.flatMap((i) => [i.raisedAt, i.settled?.at, i.settled?.reworkMergedAt]),
    ...planet.regions.map((r) => r.surveyedAt),
  );
}

function threatOf(wounds, inDistress, now) {
  let score = inDistress ? RULEBOOK.threatWeights.distress : 0;
  for (const w of wounds.filter((w) => !w.closedAt)) {
    const age = tranchesBetween(new Date(w.openedAt), now, RULEBOOK.trancheMinutes);
    score += RULEBOOK.threatWeights[w.kind] * (1 + age / 6);
  }
  let level = 1;
  RULEBOOK.threatBands.forEach((band, i) => { if (score >= band) level = i + 1; });
  return level;
}

export function derivePlanet(planet, { config, terraformedPlanets, now }) {
  const zones = deriveZones(planet);
  const wounds = deriveWounds(planet, now);
  const regions = planet.regions.map((r) => r.repo);
  const sectors = new Set(regions.map((r) => config.sectorOf(r)));
  const anyClaimed = planet.zones.some((z) => z.pr);
  const merged = Boolean(planet.featurePr?.mergedAt);
  const last = lastActivity(planet);
  const silentLost = !merged && anyClaimed && addWorkingMinutes(new Date(last), RULEBOOK.lostAfterWorkingMinutes) <= now;
  const distress = distressSince(zones, now);
  const blocked = planet.regions.some((r) => r.blockedBy.some((prd) => !terraformedPlanets.has(prd)));

  let state;
  if (planet.issue.closedAt && !merged) state = anyClaimed ? 'lost' : 'decommissioned';
  else if (silentLost) state = 'lost';
  else if (merged) state = wounds.some((w) => w.kind === 'aftershock' && !w.closedAt) ? 'aftershock' : 'terraformed';
  else if (!planet.featurePr) state = blocked ? 'locked' : 'charted';
  else if (blocked) state = 'locked';
  else if (zones.length && zones.every((z) => z.state === 'secured') && planet.featurePr.readyAt) state = 'awaiting-command';
  else if (distress) state = 'distress';
  else state = 'terraforming';

  return {
    prd: planet.prd, title: planet.title, captain: planet.captain, ownerTeam: planet.ownerTeam,
    state, regions, class: regions.length, crossSector: sectors.size > 1,
    zones, wounds, distressSince: distress, lastActivityAt: last,
    threat: threatOf(wounds, state === 'distress', now),
  };
}

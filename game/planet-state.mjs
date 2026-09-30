// A snapshot planet → derived state. Nothing here is stored; it is recomputed every time (spec §5).
import { RULEBOOK } from './rulebook.mjs';
import { addWorkingMinutes, tranchesBetween } from './calendar.mjs';
import { planetKey } from './events.mjs';

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
    else if (z.pr?.labels.includes('omni:needs-fix')) state = 'under-fire';
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
  const key = planetKey(planet.home, planet.prd); // PRD 728: a wound names its PRD by its home
  const wounds = [];
  for (const z of planet.zones) {
    // F1: the label history (`pr.needsFix`) comes off the sub-PR's timeline. A snapshot without it
    // (a failed timeline read) falls back to "labelled since the sub-PR was opened, still labelled".
    const fire = z.pr?.needsFix ?? (z.pr?.labels.includes('omni:needs-fix') ? { labeledAt: z.pr.createdAt, unlabeledAt: null } : null);
    if (fire) {
      const closedAt = fire.unlabeledAt ?? z.pr.mergedAt ?? null;
      wounds.push({ id: `fire:${z.repo}:${key}/${z.id}`, kind: 'under-fire', repo: z.repo, openedAt: fire.labeledAt, closedAt, closedBy: closedAt ? z.pr.author : null });
    }
  }
  for (const item of planet.outbox) {
    const base = { id: `outbox:${item.repo}:${key}/${item.id}`, kind: WOUND_KIND_BY_RANK[item.rank], rank: item.rank, repo: item.repo, openedAt: item.raisedAt };
    if (!item.settled) wounds.push({ ...base, closedAt: null, closedBy: null });
    else {
      wounds.push({ ...base, closedAt: item.settled.at, closedBy: item.settled.by, verdict: item.settled.verdict });
      if (item.settled.verdict === 'drifted') {
        wounds.push({ id: `fault:${item.repo}:${key}/${item.id}`, kind: 'fault-line', repo: item.repo, openedAt: item.settled.at, closedAt: item.settled.reworkMergedAt ?? null, closedBy: item.settled.reworkMergedAt ? item.settled.reworkBy ?? null : null });
      }
    }
  }
  const mergedAt = planet.featurePr?.mergedAt;
  if (mergedAt) {
    const windowEnd = new Date(new Date(mergedAt).getTime() + RULEBOOK.aftershockWindowDays * 86400000);
    for (const b of planet.bugs) {
      if (new Date(b.createdAt) >= new Date(mergedAt) && new Date(b.createdAt) <= windowEnd) {
        // F5c: an aftershock closes only when its bug closed AND a merged PR fixed it (`fixedBy`).
        const fixed = Boolean(b.closedAt && b.fixedBy);
        wounds.push({ id: planet.home ? `bug:${key}:${b.repo}#${b.number}` : `bug:${b.repo}#${b.number}`, kind: 'aftershock', repo: b.repo, openedAt: b.createdAt, closedAt: fixed ? b.closedAt : null, closedBy: fixed ? b.fixedBy : null });
      }
    }
  }
  return wounds;
}

// F5b: distress is planet-level (spec §5.1). The idle clock starts at the later of the latest claim
// anywhere on the planet and the earliest openedAt of a zone open at that moment; a planet with ≥1
// open zone and no claim for 8 working hours is in distress. One episode per idle stretch:
// `{ start, distressAt, rescue }`, where `rescue` is the first claim after distressAt (null while
// nobody has answered). A zone is open from its openedAt until its claim. Zones are derived zones
// (`openedAt`, `claimedAt`, `id`, `repo`, `author`).
export function distressEpisodes(zones, now) {
  const ms = (t) => new Date(t).getTime();
  const openable = zones.filter((z) => z.openedAt && (!z.claimedAt || ms(z.claimedAt) > ms(z.openedAt)));
  const claims = zones.filter((z) => z.claimedAt).sort((a, b) => ms(a.claimedAt) - ms(b.claimedAt) || a.id.localeCompare(b.id));
  const openAt = (t) => openable.filter((z) => ms(z.openedAt) <= t && (!z.claimedAt || ms(z.claimedAt) > t));
  const episodes = [];
  let t = Math.min(...openable.map((z) => ms(z.openedAt)));
  while (Number.isFinite(t)) {
    const open = openAt(t);
    if (!open.length) { // nothing open right now: jump to the next zone that opens
      t = Math.min(...openable.map((z) => ms(z.openedAt)).filter((o) => o > t));
      continue;
    }
    const lastClaim = claims.filter((c) => ms(c.claimedAt) <= t).at(-1);
    const start = Math.max(lastClaim ? ms(lastClaim.claimedAt) : -Infinity, Math.min(...open.map((z) => ms(z.openedAt))));
    const distressAt = addWorkingMinutes(new Date(start), RULEBOOK.distressAfterWorkingMinutes);
    const next = claims.find((c) => ms(c.claimedAt) > start);
    if (distressAt <= now && (!next || ms(next.claimedAt) > distressAt.getTime())) {
      episodes.push({
        start: iso(new Date(start)), distressAt: iso(distressAt),
        rescue: next ? { at: next.claimedAt, zone: next.id, repo: next.repo, author: next.author } : null,
      });
    }
    if (!next) break;
    t = ms(next.claimedAt);
  }
  return episodes;
}

function distressSince(zones, now) {
  const current = distressEpisodes(zones, now).at(-1);
  return current && !current.rescue ? current.distressAt : null;
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
  // A repository that no sector names counts as a sector of its own (PRD 728).
  const sectors = new Set(regions.map((r) => config.sectorOf(r) ?? `repo:${r}`));
  const anyClaimed = planet.zones.some((z) => z.pr);
  const merged = Boolean(planet.featurePr?.mergedAt);
  const last = lastActivity(planet);
  const silentLost = !merged && anyClaimed && addWorkingMinutes(new Date(last), RULEBOOK.lostAfterWorkingMinutes) <= now;
  const distress = distressSince(zones, now);
  // `terraformedPlanets` holds planet keys (`<home>#<n>`, PRD 728): a blocker is the PRD of that number
  // in the same home. A set of bare numbers (game:banner) still reads.
  const blocked = planet.regions.some((r) => r.blockedBy.some((prd) => !terraformedPlanets.has(planetKey(planet.home, prd)) && !terraformedPlanets.has(prd)));

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
    prd: planet.prd, home: planet.home ?? null, key: planetKey(planet.home, planet.prd),
    title: planet.title, captain: planet.captain, ownerTeam: planet.ownerTeam,
    state, regions, class: regions.length, crossSector: sectors.size > 1,
    zones, wounds, distressSince: distress, lastActivityAt: last,
    threat: threatOf(wounds, state === 'distress', now),
  };
}

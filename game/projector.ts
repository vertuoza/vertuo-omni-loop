// A world snapshot → the full set of game events it implies. The ledger keeps the new ones (spec §7.1).
import { RULEBOOK } from './rulebook.ts';
import { addWorkingMinutes } from './calendar.ts';
import { z } from 'zod';
import { makeEvent, NO_PLANET, planetKey, type EventType, type GameEvent } from './events.ts';
import { derivePlanet, distressEpisodes } from './planet-state.ts';
import type { GameConfig } from './config.ts';
import type { DerivedPlanet, Snapshot, SnapshotPlanet } from './types.ts';
import type { PrdNumber, PrNumber } from '../kit/lib/ids.ts';

/** One fact that could not become an event, and why. */
export type Skip = { id: string; message: string };

/**
 * One answered ask round (PRD 1180), as public.game_answered_rounds() returns it: the PRD by the
 * brainstorm or the delivery rule (null when none claims it), its home in lower case (that PRD's, else
 * the round's repository), the answerer's lower-case GitHub login.
 */
export type AnsweredRound = { roundId: string; answeredAt: string; prd: PrdNumber | null; home: string; login: string };

// An event's fields before validation: what the projector builds, `contributor` possibly unset.
type Fields = {
  id: string;
  at: string | null | undefined;
  type: EventType;
  planet: number;
  home?: string;
  region?: string;
  contributor?: string | null;
  data?: Record<string, unknown>;
};
type Push = (fields: Fields) => void;
type At = { planet: SnapshotPlanet; state: DerivedPlanet; key: string; on: { planet: number; home?: string } };

// What a thrown value says: a schema's issues, field by field, else its message.
function why(err: unknown): string {
  if (err instanceof z.ZodError) return err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
  return err instanceof Error ? err.message : String(err);
}

const iso = (d: Date): string => d.toISOString().replace('.000Z', 'Z');

// F4: an event that fails validation (a malformed timestamp that slipped through) is skipped and
// reported through `onSkip({ id, message })`; one bad fact never stops the rest of the poll. A planet
// whose state cannot be derived at all is reported the same way, under the id `planet:<key>`. Every id
// names the PRD by its key, `<home>#<n>` (PRD 728; the number alone for a snapshot with no home).
// `answers` are the workspace's answered rounds (PRD 1180): each becomes one QUESTION_ANSWERED, on its
// PRD's planet, or on planet 0 when no PRD claims it.
export function projectEvents(
  snapshot: Snapshot,
  { config, now, answers = [], onSkip = () => {} }: { config: Pick<GameConfig, 'sectorOf'>; now: Date; answers?: readonly AnsweredRound[]; onSkip?: (skip: Skip) => void },
): GameEvent[] {
  // A planet is named by its key, `<home>#<n>` (PRD 728): a blocker is the PRD of that number in the same home.
  const terraformedAt = new Map(snapshot.planets.flatMap((p) => (p.featurePr?.mergedAt ? [[planetKey(p.home, p.prd), p.featurePr.mergedAt] as const] : [])));
  const terraformedPlanets = new Set(terraformedAt.keys());
  const events: GameEvent[] = [];
  const push = pusher(events, snapshot.teams, onSkip);

  for (const planet of snapshot.planets) {
    const key = planetKey(planet.home, planet.prd);
    let state: DerivedPlanet;
    try {
      state = derivePlanet(planet, { config, terraformedPlanets, now });
    } catch (err) {
      onSkip({ id: `planet:${key}`, message: err instanceof Error ? err.message : String(err) });
      continue;
    }
    const at: At = { planet, state, key, on: { planet: planet.prd, ...(planet.home ? { home: planet.home } : {}) } }; // every event names its home
    push({ id: `planet:${key}:charted`, at: planet.issue.createdAt, type: 'PLANET_CHARTED', ...at.on, data: { captain: planet.captain, ownerTeam: planet.ownerTeam, title: planet.title } });
    regionEvents(push, at, terraformedAt);
    zoneEvents(push, at);
    distressEvents(push, at, now);
    woundEvents(push, at);
    finishEvents(push, at);
    mergeEvents(push, at);
    endEvents(push, at);
  }
  answerEvents(push, answers);
  return events.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
}

/**
 * A GitHub login as the ledger names a player (PRD 1180): letters, digits and inner hyphens, at
 * most 39 characters, in any case, as GitHub issues them (`Serghok`). No `@`, no dot.
 */
const LOGIN = /^[a-z0-9](?:[a-z0-9-]{0,38})$/i;

// Validates and keeps one event, or reports it skipped. An event credited to a name that is no
// GitHub login is skipped too (PRD 1180): the ledger keeps an event's first copy forever, so it waits
// for a poll that reads the name right rather than crediting no player.
function pusher(events: GameEvent[], teams: Readonly<Record<string, string>>, onSkip: (skip: Skip) => void): Push {
  // Logins are case-insensitive; the roster is keyed in lower case.
  const teamOf = (login: string): string | undefined => teams[login] ?? teams[login.toLowerCase()];
  // Controller ruling: EventSchema accepts `contributor` as a string or absent, never `null`.
  // When a login is null/undefined (e.g. an unclaimed zone's author, a wound's closedBy),
  // omit both `contributor` and `team` instead of passing `null`.
  return (fields: Fields) => {
    const { contributor, ...rest } = fields;
    if (contributor && !LOGIN.test(contributor)) {
      onSkip({ id: fields.id, message: `contributor ${JSON.stringify(contributor)} is not a GitHub login` });
      return;
    }
    try {
      events.push(makeEvent({
        ...rest,
        ...(contributor ? { contributor, ...(teamOf(contributor) ? { team: teamOf(contributor) } : {}) } : {}),
      }));
    } catch (err) {
      onSkip({ id: fields.id, message: why(err) });
    }
  };
}

function regionEvents(push: Push, { planet, key, on }: At, terraformedAt: ReadonlyMap<string, string>): void {
  for (const r of planet.regions) {
    push({ id: `region:${r.repo}:${key}:surveyed`, at: r.surveyedAt, type: 'REGION_SURVEYED', ...on, region: r.repo });
    for (const blocker of r.blockedBy) {
      push({ id: `planet:${key}:locked:${blocker}`, at: r.surveyedAt, type: 'PLANET_LOCKED', ...on, data: { blocker } });
      if (terraformedAt.has(planetKey(planet.home, blocker))) push({ id: `planet:${key}:unlocked:${blocker}`, at: terraformedAt.get(planetKey(planet.home, blocker)), type: 'PLANET_UNLOCKED', ...on, data: { blocker } });
    }
  }
}

function zoneEvents(push: Push, { planet, state, key, on }: At): void {
  for (const z of state.zones) {
    const zoneKey = `zone:${z.repo}:${key}:${z.id}`;
    const base = { ...on, region: z.repo };
    if (z.openedAt) push({ id: `${zoneKey}:opened`, at: z.openedAt, type: 'ZONE_OPENED', ...base, data: { wave: z.wave } });
    if (z.claimedAt) push({ id: `${zoneKey}:claimed`, at: z.claimedAt, type: 'ZONE_CLAIMED', ...base, contributor: z.author, data: { pr: prNumber(planet, z.id, z.repo) } });
    if (z.securedAt) push({ id: `${zoneKey}:secured`, at: z.securedAt, type: 'ZONE_SECURED', ...base, contributor: z.author, data: { pr: prNumber(planet, z.id, z.repo) } });
    if (z.revertedAt) push({ id: `${zoneKey}:reverted`, at: z.revertedAt, type: 'ZONE_REVERTED', ...base, contributor: z.author, data: { pr: prNumber(planet, z.id, z.repo) } });
  }
}

// F5b: one DISTRESS per planet-level idle episode, and a RESCUE for the claim that answered it.
// The RESCUE is always emitted; the economy pays it only when the claimer is from another team.
function distressEvents(push: Push, { planet, state, key, on }: At, now: Date): void {
  for (const ep of distressEpisodes(state.zones, now)) {
    push({ id: `planet:${key}:distress:${ep.start}`, at: ep.distressAt, type: 'DISTRESS', ...on });
    if (ep.rescue) push({ id: `planet:${key}:rescue:${ep.start}`, at: ep.rescue.at, type: 'RESCUE', ...on, region: ep.rescue.repo, contributor: ep.rescue.author, data: { pr: prNumber(planet, ep.rescue.zone, ep.rescue.repo), zone: ep.rescue.zone } });
  }
}

function woundEvents(push: Push, { state, on }: At): void {
  for (const w of state.wounds) {
    const data = { kind: w.kind, ...(w.rank ? { rank: w.rank } : {}) };
    push({ id: `${w.id}:opened`, at: w.openedAt, type: 'WOUND_OPENED', ...on, region: w.repo, data });
    if (w.closedAt) push({ id: `${w.id}:closed`, at: w.closedAt, type: 'WOUND_CLOSED', ...on, region: w.repo, contributor: w.closedBy, data: { ...data, ...(w.verdict ? { verdict: w.verdict } : {}) } });
  }
}

// A planet built: ready once its feature PR is and every zone is secured, terraformed once it merged.
function finishEvents(push: Push, { planet, state, key, on }: At): void {
  const fp = planet.featurePr;
  if (fp?.readyAt && state.zones.length && state.zones.every((z) => z.state === 'secured')) push({ id: `planet:${key}:ready`, at: fp.readyAt, type: 'PLANET_READY', ...on });
  if (fp?.mergedAt) push({ id: `planet:${key}:terraformed`, at: fp.mergedAt, type: 'PLANET_TERRAFORMED', ...on, data: { ownerTeam: planet.ownerTeam, class: state.class, crossSector: state.crossSector } });
}

// Each region's feature PR merged into its default branch: one FEATURE_MERGED for who merged it, one
// FEATURE_REVIEWED per person who approved it. Each id names the region's PR and the person, so a
// merge pays once, however many polls see it.
function mergeEvents(push: Push, { planet, key, on }: At): void {
  for (const r of planet.regions) {
    const fp = r.featurePr;
    if (!fp?.mergedAt) continue;
    const pr = `merge:${fp.repo}#${fp.number}:${key}`;
    if (fp.mergedBy) push({ id: `${pr}:merged`, at: fp.mergedAt, type: 'FEATURE_MERGED', ...on, region: fp.repo, contributor: fp.mergedBy, data: { pr: fp.number } });
    for (const login of fp.approvedBy ?? []) push({ id: `${pr}:approved:${login}`, at: fp.mergedAt, type: 'FEATURE_REVIEWED', ...on, region: fp.repo, contributor: login, data: { pr: fp.number } });
  }
}

// A planet given up: lost, or decommissioned.
function endEvents(push: Push, { planet, state, key, on }: At): void {
  if (state.state === 'lost') {
    const at = planet.issue.closedAt ?? iso(addWorkingMinutes(new Date(state.lastActivityAt ?? 0), RULEBOOK.lostAfterWorkingMinutes));
    push({ id: `planet:${key}:lost`, at, type: 'PLANET_LOST', ...on, data: { ownerTeam: planet.ownerTeam, reason: planet.issue.closedAt ? 'closed' : 'silence' } });
  }
  if (state.state === 'decommissioned') push({ id: `planet:${key}:decommissioned`, at: planet.issue.closedAt, type: 'PLANET_DECOMMISSIONED', ...on });
}

// PRD 1180: one QUESTION_ANSWERED per answered round, whether or not its PRD is charted (its repository
// may be untracked), on planet 0 when no PRD claims it. Its id names the round alone, so however many
// polls see it, the ledger keeps one.
function answerEvents(push: Push, answers: readonly AnsweredRound[]): void {
  for (const a of answers) {
    push({ id: `ask:${a.roundId}:answered`, at: a.answeredAt, type: 'QUESTION_ANSWERED', planet: a.prd ?? NO_PLANET, home: a.home, contributor: a.login });
  }
}

function prNumber(planet: SnapshotPlanet, zoneId: string, repo: string): PrNumber | null {
  return planet.zones.find((z) => z.id === zoneId && (!repo || z.repo === repo))?.pr?.number ?? null;
}

import { describe, it, expect } from 'vitest';
import { configFrom } from './config.mjs';
import { derivePlanet, distressEpisodes } from './planet-state.mjs';

const config = configFrom({
  sectors: [{ name: 'ai', repos: ['ai-repo'] }, { name: 'core', repos: ['core-repo'] }],
  teams: [{ name: 'beaver', home: 'core' }, { name: 'octopod', home: 'ai' }],
});

// Wed 2026-09-23. Brussels = UTC+2.
const NOW = new Date('2026-09-23T14:00:00Z');
const ctx = (terraformed = []) => ({ config, terraformedPlanets: new Set(terraformed), now: NOW });

function planet(over = {}) {
  return {
    prd: 2332, title: 'Generic Import Engine', captain: 'pm', ownerTeam: 'beaver',
    issue: { createdAt: '2026-09-01T08:00:00Z', closedAt: null },
    regions: [{ repo: 'core-repo', blockedBy: [], surveyedAt: '2026-09-02T08:00:00Z' }],
    featurePr: { repo: 'core-repo', number: 500, createdAt: '2026-09-21T08:00:00Z', readyAt: null, mergedAt: null, lastActivityAt: '2026-09-23T08:00:00Z' },
    zones: [
      { id: 's1', repo: 'core-repo', wave: 1, blockedBy: [], pr: { number: 501, author: 'alice', createdAt: '2026-09-21T09:00:00Z', labels: ['omni:sub'], mergedAt: '2026-09-21T12:00:00Z', revertedAt: null } },
      { id: 's2', repo: 'core-repo', wave: 2, blockedBy: ['s1'], pr: null },
    ],
    outbox: [], bugs: [],
    ...over,
  };
}

describe('derivePlanet', () => {
  it('is charted with no feature PR, and unsurveyed with no regions', () => {
    const p = derivePlanet(planet({ featurePr: null, regions: [], zones: [] }), ctx());
    expect(p.state).toBe('charted');
    expect(p.class).toBe(0);
  });

  it('is locked while a blocked-by planet is not terraformed', () => {
    const p = derivePlanet(planet({ regions: [{ repo: 'core-repo', blockedBy: [2300], surveyedAt: '2026-09-02T08:00:00Z' }] }), ctx());
    expect(p.state).toBe('locked');
    // Same default zones/NOW as the "is in distress" test below (s2 opened Mon 12:00Z, 8 working
    // hours elapse by Tue 11:00Z, well before NOW = Wed 14:00Z), so once unblocked this planet is
    // in distress, not merely "terraforming" (see task-4-report.md for the recount).
    expect(derivePlanet(planet({ regions: [{ repo: 'core-repo', blockedBy: [2300], surveyedAt: '2026-09-02T08:00:00Z' }] }), ctx([2300])).state).toBe('distress');
  });

  it('derives zone states from blockers and labels', () => {
    const p = derivePlanet(planet(), ctx());
    expect(p.zones.map((z) => [z.id, z.state])).toEqual([['s1', 'secured'], ['s2', 'open']]);
    expect(p.zones[1].openedAt).toBe('2026-09-21T12:00:00Z'); // when s1 merged
    const sealed = derivePlanet(planet({ zones: [
      { id: 's1', repo: 'core-repo', wave: 1, blockedBy: [], pr: null },
      { id: 's2', repo: 'core-repo', wave: 2, blockedBy: ['s1'], pr: null },
    ] }), ctx());
    expect(sealed.zones.map((z) => z.state)).toEqual(['open', 'sealed']);
    expect(sealed.zones[0].openedAt).toBe('2026-09-21T08:00:00Z'); // feature PR created
  });

  it('opens a zone at its own region\'s feature PR creation (F3)', () => {
    const p = derivePlanet(planet({
      regions: [
        { repo: 'core-repo', blockedBy: [], surveyedAt: '2026-09-02T08:00:00Z', featurePr: { repo: 'core-repo', number: 500, createdAt: '2026-09-21T08:00:00Z', readyAt: null, mergedAt: null, lastActivityAt: '2026-09-23T08:00:00Z' } },
        { repo: 'ai-repo', blockedBy: [], surveyedAt: '2026-09-02T08:00:00Z', featurePr: { repo: 'ai-repo', number: 700, createdAt: '2026-09-22T08:00:00Z', readyAt: null, mergedAt: null, lastActivityAt: '2026-09-23T08:00:00Z' } },
      ],
      zones: [
        { id: 's1', repo: 'core-repo', wave: 1, blockedBy: [], pr: null },
        { id: 's1', repo: 'ai-repo', wave: 1, blockedBy: [], pr: null },
      ],
    }), ctx());
    expect(p.zones.map((z) => [z.repo, z.openedAt])).toEqual([['core-repo', '2026-09-21T08:00:00Z'], ['ai-repo', '2026-09-22T08:00:00Z']]);
  });

  it('marks a claimed zone, and an under-fire zone as a wound', () => {
    const p = derivePlanet(planet({ zones: [
      { id: 's1', repo: 'core-repo', wave: 1, blockedBy: [], pr: { number: 501, author: 'alice', createdAt: '2026-09-22T09:00:00Z', labels: ['omni:sub', 'omni:in-progress'], mergedAt: null, revertedAt: null } },
      { id: 's2', repo: 'core-repo', wave: 1, blockedBy: [], pr: { number: 502, author: 'bob', createdAt: '2026-09-22T09:00:00Z', labels: ['omni:sub', 'omni:needs-fix'], mergedAt: null, revertedAt: null } },
    ] }), ctx());
    expect(p.zones.map((z) => z.state)).toEqual(['claimed', 'under-fire']);
    // F1: the id must not collide with the zone's own ZONE_OPENED id; with no label history the
    // wound opens at the sub-PR's creation.
    expect(p.wounds).toEqual([{ id: 'fire:core-repo:2332/s2', kind: 'under-fire', repo: 'core-repo', openedAt: '2026-09-22T09:00:00Z', closedAt: null, closedBy: null }]);
  });

  it('opens an under-fire wound when omni:needs-fix is labelled and closes it when the label goes or the sub-PR merges (F1)', () => {
    const sub = (number, over) => ({ number, author: 'bob', createdAt: '2026-09-22T09:00:00Z', labels: ['omni:sub'], mergedAt: null, revertedAt: null, ...over });
    const p = derivePlanet(planet({ zones: [
      { id: 's1', repo: 'core-repo', wave: 1, blockedBy: [], pr: sub(501, { labels: ['omni:sub', 'omni:needs-fix'], needsFix: { labeledAt: '2026-09-22T10:00:00Z', unlabeledAt: null } }) },
      { id: 's2', repo: 'core-repo', wave: 1, blockedBy: [], pr: sub(502, { needsFix: { labeledAt: '2026-09-22T10:00:00Z', unlabeledAt: '2026-09-22T15:00:00Z' } }) },
      { id: 's3', repo: 'core-repo', wave: 1, blockedBy: [], pr: sub(503, { mergedAt: '2026-09-23T08:00:00Z', needsFix: { labeledAt: '2026-09-22T10:00:00Z', unlabeledAt: null } }) },
      { id: 's4', repo: 'core-repo', wave: 1, blockedBy: [], pr: sub(504, { needsFix: null }) },
    ] }), ctx());
    expect(p.wounds).toEqual([
      { id: 'fire:core-repo:2332/s1', kind: 'under-fire', repo: 'core-repo', openedAt: '2026-09-22T10:00:00Z', closedAt: null, closedBy: null },
      { id: 'fire:core-repo:2332/s2', kind: 'under-fire', repo: 'core-repo', openedAt: '2026-09-22T10:00:00Z', closedAt: '2026-09-22T15:00:00Z', closedBy: 'bob' },
      { id: 'fire:core-repo:2332/s3', kind: 'under-fire', repo: 'core-repo', openedAt: '2026-09-22T10:00:00Z', closedAt: '2026-09-23T08:00:00Z', closedBy: 'bob' },
    ]);
  });

  it('turns outbox items into wounds by rank, a drifted settle into a fault line', () => {
    const p = derivePlanet(planet({ outbox: [
      { id: 's1-01-a', repo: 'core-repo', rank: 'medium', raisedAt: '2026-09-21T10:00:00Z', settled: null },
      { id: 's1-02-b', repo: 'core-repo', rank: 'human-action', raisedAt: '2026-09-21T10:00:00Z', settled: { verdict: 'agreed', at: '2026-09-22T10:00:00Z', by: 'pm', reworkMergedAt: null } },
      { id: 's1-03-c', repo: 'core-repo', rank: 'high', raisedAt: '2026-09-21T10:00:00Z', settled: { verdict: 'drifted', at: '2026-09-22T11:00:00Z', by: 'pm', reworkMergedAt: null } },
    ] }), ctx());
    expect(p.wounds).toEqual([
      { id: 'outbox:core-repo:2332/s1-01-a', kind: 'transmission', rank: 'medium', repo: 'core-repo', openedAt: '2026-09-21T10:00:00Z', closedAt: null, closedBy: null },
      { id: 'outbox:core-repo:2332/s1-02-b', kind: 'beacon', rank: 'human-action', repo: 'core-repo', openedAt: '2026-09-21T10:00:00Z', closedAt: '2026-09-22T10:00:00Z', closedBy: 'pm', verdict: 'agreed' },
      { id: 'outbox:core-repo:2332/s1-03-c', kind: 'unconfirmed-ground', rank: 'high', repo: 'core-repo', openedAt: '2026-09-21T10:00:00Z', closedAt: '2026-09-22T11:00:00Z', closedBy: 'pm', verdict: 'drifted' },
      { id: 'fault:core-repo:2332/s1-03-c', kind: 'fault-line', repo: 'core-repo', openedAt: '2026-09-22T11:00:00Z', closedAt: null, closedBy: null },
    ]);
  });

  it('credits a fault line to the author of the rework sub-PR (F6)', () => {
    const p = derivePlanet(planet({ outbox: [
      { id: 's1-03-c', repo: 'core-repo', rank: 'high', raisedAt: '2026-09-21T10:00:00Z', settled: { verdict: 'drifted', at: '2026-09-22T11:00:00Z', by: 'pm', reworkMergedAt: '2026-09-22T15:00:00Z', reworkBy: 'carol' } },
    ] }), ctx());
    expect(p.wounds.find((w) => w.kind === 'fault-line')).toEqual({ id: 'fault:core-repo:2332/s1-03-c', kind: 'fault-line', repo: 'core-repo', openedAt: '2026-09-22T11:00:00Z', closedAt: '2026-09-22T15:00:00Z', closedBy: 'carol' });
  });

  it('is in distress after 8 idle working hours on an open zone', () => {
    // s2 opened Mon 2026-09-21 12:00Z (14:00 local); 8 working hours later = Tue 13:00 local = 11:00Z
    const p = derivePlanet(planet(), ctx());
    expect(p.state).toBe('distress');
    expect(p.distressSince).toBe('2026-09-22T11:00:00Z');
    const early = derivePlanet(planet(), { ...ctx(), now: new Date('2026-09-22T10:00:00Z') });
    expect(early.state).toBe('terraforming');
  });

  it('keeps the distress clock planet-level: a claim anywhere on the planet restarts it (F5b)', () => {
    // s2 opens Mon 12:00Z. bob claims s3 Tue 08:00Z (10:00 local), before s2's 8 working hours run
    // out (Tue 11:00Z), so the idle clock restarts there: Tue 10:00 → 18:00 local = Tue 16:00Z.
    const p = derivePlanet(planet({ zones: [
      { id: 's1', repo: 'core-repo', wave: 1, blockedBy: [], pr: { number: 501, author: 'alice', createdAt: '2026-09-21T09:00:00Z', labels: ['omni:sub'], mergedAt: '2026-09-21T12:00:00Z', revertedAt: null } },
      { id: 's2', repo: 'core-repo', wave: 2, blockedBy: ['s1'], pr: null },
      { id: 's3', repo: 'core-repo', wave: 2, blockedBy: ['s1'], pr: { number: 503, author: 'bob', createdAt: '2026-09-22T08:00:00Z', labels: ['omni:sub', 'omni:in-progress'], mergedAt: null, revertedAt: null } },
    ] }), ctx());
    expect(p.state).toBe('distress');
    expect(p.distressSince).toBe('2026-09-22T16:00:00Z');
  });

  it('lists distress episodes with the claim that answered each (F5b)', () => {
    const zones = [
      { id: 's2', repo: 'core-repo', openedAt: '2026-09-21T12:00:00Z', claimedAt: '2026-09-23T09:00:00Z', author: 'bob' },
      { id: 's3', repo: 'core-repo', openedAt: '2026-09-21T12:00:00Z', claimedAt: null, author: null },
    ];
    expect(distressEpisodes(zones, NOW)).toEqual([
      { start: '2026-09-21T12:00:00Z', distressAt: '2026-09-22T11:00:00Z', rescue: { at: '2026-09-23T09:00:00Z', zone: 's2', repo: 'core-repo', author: 'bob' } },
    ]);
    // s3 is still open after bob's claim: a new idle clock starts at the claim (Wed 11:00 local), and
    // its 8 working hours have not run out by NOW.
    expect(distressEpisodes(zones, new Date('2026-09-24T12:00:00Z'))).toEqual([
      { start: '2026-09-21T12:00:00Z', distressAt: '2026-09-22T11:00:00Z', rescue: { at: '2026-09-23T09:00:00Z', zone: 's2', repo: 'core-repo', author: 'bob' } },
      { start: '2026-09-23T09:00:00Z', distressAt: '2026-09-24T08:00:00Z', rescue: null },
    ]);
  });

  it('awaits command when every zone is secured and the PR is ready', () => {
    const p = derivePlanet(planet({
      featurePr: { repo: 'core-repo', number: 500, createdAt: '2026-09-21T08:00:00Z', readyAt: '2026-09-22T08:00:00Z', mergedAt: null, lastActivityAt: '2026-09-23T08:00:00Z' },
      zones: [{ id: 's1', repo: 'core-repo', wave: 1, blockedBy: [], pr: { number: 501, author: 'alice', createdAt: '2026-09-21T09:00:00Z', labels: ['omni:sub'], mergedAt: '2026-09-21T12:00:00Z', revertedAt: null } }],
    }), ctx());
    expect(p.state).toBe('awaiting-command');
  });

  it('is terraformed when the feature PR merged, aftershock with a bug inside 14 days', () => {
    const merged = { repo: 'core-repo', number: 500, createdAt: '2026-09-21T08:00:00Z', readyAt: '2026-09-22T08:00:00Z', mergedAt: '2026-09-22T12:00:00Z', lastActivityAt: '2026-09-22T12:00:00Z' };
    expect(derivePlanet(planet({ featurePr: merged }), ctx()).state).toBe('terraformed');
    const shaken = derivePlanet(planet({ featurePr: merged, bugs: [{ repo: 'core-repo', number: 600, createdAt: '2026-09-23T09:00:00Z', closedAt: null, closedBy: null }] }), ctx());
    expect(shaken.state).toBe('aftershock');
    expect(shaken.wounds).toEqual([{ id: 'bug:core-repo#600', kind: 'aftershock', repo: 'core-repo', openedAt: '2026-09-23T09:00:00Z', closedAt: null, closedBy: null }]);
    const late = derivePlanet(planet({ featurePr: merged, bugs: [{ repo: 'core-repo', number: 601, createdAt: '2026-10-20T09:00:00Z', closedAt: null, closedBy: null }] }), { ...ctx(), now: new Date('2026-10-21T09:00:00Z') });
    expect(late.state).toBe('terraformed');
    expect(late.wounds).toEqual([]);
  });

  it('keeps an aftershock open when its bug was closed without a merged fix (F5c)', () => {
    const merged = { repo: 'core-repo', number: 500, createdAt: '2026-09-21T08:00:00Z', readyAt: '2026-09-22T08:00:00Z', mergedAt: '2026-09-22T12:00:00Z', lastActivityAt: '2026-09-22T12:00:00Z' };
    const p = derivePlanet(planet({ featurePr: merged, bugs: [
      { repo: 'core-repo', number: 600, createdAt: '2026-09-23T09:00:00Z', closedAt: '2026-09-23T11:00:00Z', closedBy: 'pm', fixedBy: null },
      { repo: 'core-repo', number: 601, createdAt: '2026-09-23T09:00:00Z', closedAt: '2026-09-23T12:00:00Z', closedBy: 'pm', fixedBy: 'dave' },
    ] }), ctx());
    expect(p.wounds.map((w) => [w.id, w.closedAt, w.closedBy])).toEqual([
      ['bug:core-repo#600', null, null],
      ['bug:core-repo#601', '2026-09-23T12:00:00Z', 'dave'],
    ]);
    expect(p.state).toBe('aftershock');
  });

  it('is lost when closed after a claim and unmerged, decommissioned when closed before any claim', () => {
    const closed = { createdAt: '2026-09-01T08:00:00Z', closedAt: '2026-09-23T10:00:00Z' };
    expect(derivePlanet(planet({ issue: closed }), ctx()).state).toBe('lost');
    expect(derivePlanet(planet({ issue: closed, zones: [{ id: 's1', repo: 'core-repo', wave: 1, blockedBy: [], pr: null }] }), ctx()).state).toBe('decommissioned');
  });

  it('is lost after 10 working days of silence', () => {
    const p = derivePlanet(planet(), { ...ctx(), now: new Date('2026-10-20T10:00:00Z') });
    expect(p.state).toBe('lost');
  });

  it('computes class and cross-sector from regions', () => {
    const p = derivePlanet(planet({ regions: [
      { repo: 'core-repo', blockedBy: [], surveyedAt: '2026-09-02T08:00:00Z' },
      { repo: 'ai-repo', blockedBy: [], surveyedAt: '2026-09-02T08:00:00Z' },
    ] }), ctx());
    expect(p.class).toBe(2);
    expect(p.crossSector).toBe(true);
  });

  it('rates threat from open wounds', () => {
    expect(derivePlanet(planet({ zones: [] }), ctx()).threat).toBe(1);
    const p = derivePlanet(planet({ outbox: [
      { id: 'a', repo: 'core-repo', rank: 'human-action', raisedAt: '2026-09-21T10:00:00Z', settled: null },
      { id: 'b', repo: 'core-repo', rank: 'high', raisedAt: '2026-09-21T10:00:00Z', settled: null },
    ] }), ctx());
    expect(p.threat).toBeGreaterThanOrEqual(3);
  });
});

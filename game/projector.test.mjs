import { describe, it, expect } from 'vitest';
import { parseProjects } from './config.mjs';
import { projectEvents } from './projector.mjs';

const config = parseProjects(`
sectors:
  core: { repos: [core-repo] }
teams:
  beaver: { home: core }
  octopod: { home: core }
`);
const NOW = new Date('2026-09-23T14:00:00Z');

function snapshot(planetOver = {}) {
  return {
    at: NOW.toISOString(),
    teams: { alice: 'octopod', pm: 'beaver' },
    planets: [{
      prd: 2332, title: 'Generic Import Engine', captain: 'pm', ownerTeam: 'beaver',
      issue: { createdAt: '2026-09-01T08:00:00Z', closedAt: null },
      regions: [{ repo: 'core-repo', blockedBy: [], surveyedAt: '2026-09-02T08:00:00Z' }],
      featurePr: { repo: 'core-repo', number: 500, createdAt: '2026-09-21T08:00:00Z', readyAt: null, mergedAt: null, lastActivityAt: '2026-09-23T08:00:00Z' },
      zones: [
        { id: 's1', repo: 'core-repo', wave: 1, blockedBy: [], pr: { number: 501, author: 'alice', createdAt: '2026-09-21T09:00:00Z', labels: ['pr:sub'], mergedAt: '2026-09-21T12:00:00Z', revertedAt: null } },
        { id: 's2', repo: 'core-repo', wave: 2, blockedBy: ['s1'], pr: null },
      ],
      outbox: [{ id: 's1-01-a', repo: 'core-repo', rank: 'high', raisedAt: '2026-09-21T10:00:00Z', settled: { verdict: 'agreed', at: '2026-09-22T10:00:00Z', by: 'pm', reworkMergedAt: null } }],
      bugs: [],
      ...planetOver,
    }],
  };
}

const ids = (events) => events.map((e) => e.id).sort();

describe('projectEvents', () => {
  it('emits the planet, region, zone and wound history with teams attached', () => {
    const events = projectEvents(snapshot(), { config, now: NOW });
    expect(ids(events)).toEqual([
      'outbox:core-repo:2332/s1-01-a:closed', 'outbox:core-repo:2332/s1-01-a:opened',
      'planet:2332:charted', 'region:core-repo:2332:surveyed',
      'zone:core-repo:2332:s1:claimed', 'zone:core-repo:2332:s1:opened', 'zone:core-repo:2332:s1:secured',
      'zone:core-repo:2332:s2:distress', 'zone:core-repo:2332:s2:opened',
    ]);
    const secured = events.find((e) => e.id === 'zone:core-repo:2332:s1:secured');
    expect(secured).toMatchObject({ type: 'ZONE_SECURED', at: '2026-09-21T12:00:00Z', planet: 2332, region: 'core-repo', contributor: 'alice', team: 'octopod' });
    const closed = events.find((e) => e.id === 'outbox:core-repo:2332/s1-01-a:closed');
    expect(closed).toMatchObject({ type: 'WOUND_CLOSED', contributor: 'pm', team: 'beaver', data: { kind: 'unconfirmed-ground', rank: 'high', verdict: 'agreed' } });
    expect(events.find((e) => e.type === 'DISTRESS').at).toBe('2026-09-22T11:00:00Z');
  });

  it('emits a rescue when a claim follows a distress', () => {
    const events = projectEvents(snapshot({ zones: [
      { id: 's1', repo: 'core-repo', wave: 1, blockedBy: [], pr: { number: 501, author: 'alice', createdAt: '2026-09-21T09:00:00Z', labels: ['pr:sub'], mergedAt: '2026-09-21T12:00:00Z', revertedAt: null } },
      { id: 's2', repo: 'core-repo', wave: 2, blockedBy: ['s1'], pr: { number: 502, author: 'alice', createdAt: '2026-09-23T09:00:00Z', labels: ['pr:sub', 'pr:in-progress'], mergedAt: null, revertedAt: null } },
    ] }), { config, now: NOW });
    expect(events.find((e) => e.type === 'RESCUE')).toMatchObject({ id: 'zone:core-repo:2332:s2:rescue', contributor: 'alice', at: '2026-09-23T09:00:00Z' });
    expect(events.find((e) => e.type === 'DISTRESS')).toBeTruthy();
  });

  it('emits no distress when the claim came within 8 working hours', () => {
    const events = projectEvents(snapshot({ zones: [
      { id: 's1', repo: 'core-repo', wave: 1, blockedBy: [], pr: { number: 501, author: 'alice', createdAt: '2026-09-21T09:00:00Z', labels: ['pr:sub'], mergedAt: '2026-09-21T12:00:00Z', revertedAt: null } },
      { id: 's2', repo: 'core-repo', wave: 2, blockedBy: ['s1'], pr: { number: 502, author: 'alice', createdAt: '2026-09-21T13:00:00Z', labels: ['pr:sub', 'pr:in-progress'], mergedAt: null, revertedAt: null } },
    ] }), { config, now: NOW });
    expect(events.some((e) => e.type === 'DISTRESS' || e.type === 'RESCUE')).toBe(false);
  });

  it('emits ready, terraformed, lost and decommissioned at the right times', () => {
    const merged = { repo: 'core-repo', number: 500, createdAt: '2026-09-21T08:00:00Z', readyAt: '2026-09-22T08:00:00Z', mergedAt: '2026-09-22T12:00:00Z', lastActivityAt: '2026-09-22T12:00:00Z' };
    const oneZone = [{ id: 's1', repo: 'core-repo', wave: 1, blockedBy: [], pr: { number: 501, author: 'alice', createdAt: '2026-09-21T09:00:00Z', labels: ['pr:sub'], mergedAt: '2026-09-21T12:00:00Z', revertedAt: null } }];
    const done = projectEvents(snapshot({ featurePr: merged, zones: oneZone }), { config, now: NOW });
    expect(done.find((e) => e.type === 'PLANET_READY')).toMatchObject({ at: '2026-09-22T08:00:00Z' });
    expect(done.find((e) => e.type === 'PLANET_TERRAFORMED')).toMatchObject({ at: '2026-09-22T12:00:00Z', data: { ownerTeam: 'beaver', class: 1, crossSector: false } });

    const closed = projectEvents(snapshot({ issue: { createdAt: '2026-09-01T08:00:00Z', closedAt: '2026-09-23T10:00:00Z' } }), { config, now: NOW });
    expect(closed.find((e) => e.type === 'PLANET_LOST')).toMatchObject({ at: '2026-09-23T10:00:00Z', data: { reason: 'closed' } });

    const silent = projectEvents(snapshot(), { config, now: new Date('2026-10-20T10:00:00Z') });
    expect(silent.find((e) => e.type === 'PLANET_LOST')).toMatchObject({ data: { reason: 'silence' } });

    const decom = projectEvents(snapshot({ issue: { createdAt: '2026-09-01T08:00:00Z', closedAt: '2026-09-23T10:00:00Z' }, zones: [{ id: 's1', repo: 'core-repo', wave: 1, blockedBy: [], pr: null }] }), { config, now: NOW });
    expect(decom.some((e) => e.type === 'PLANET_DECOMMISSIONED')).toBe(true);
    expect(decom.some((e) => e.type === 'PLANET_LOST')).toBe(false);
  });

  it('emits locked and unlocked against a blocker planet', () => {
    const s = snapshot({ regions: [{ repo: 'core-repo', blockedBy: [2300], surveyedAt: '2026-09-02T08:00:00Z' }] });
    s.planets.push({
      prd: 2300, title: 'Blocker', captain: 'pm', ownerTeam: 'beaver',
      issue: { createdAt: '2026-08-01T08:00:00Z', closedAt: '2026-09-10T08:00:00Z' },
      regions: [{ repo: 'core-repo', blockedBy: [], surveyedAt: '2026-08-02T08:00:00Z' }],
      featurePr: { repo: 'core-repo', number: 400, createdAt: '2026-08-05T08:00:00Z', readyAt: '2026-09-09T08:00:00Z', mergedAt: '2026-09-10T08:00:00Z', lastActivityAt: '2026-09-10T08:00:00Z' },
      zones: [{ id: 's1', repo: 'core-repo', wave: 1, blockedBy: [], pr: { number: 401, author: 'alice', createdAt: '2026-08-06T08:00:00Z', labels: ['pr:sub'], mergedAt: '2026-08-07T08:00:00Z', revertedAt: null } }],
      outbox: [], bugs: [],
    });
    const events = projectEvents(s, { config, now: NOW });
    expect(events.find((e) => e.id === 'planet:2332:locked:2300')).toMatchObject({ at: '2026-09-02T08:00:00Z' });
    expect(events.find((e) => e.id === 'planet:2332:unlocked:2300')).toMatchObject({ at: '2026-09-10T08:00:00Z' });
  });

  it('gives every event of a rich snapshot a unique id (F1)', () => {
    const s = snapshot({
      zones: [
        { id: 's1', repo: 'core-repo', wave: 1, blockedBy: [], pr: { number: 501, author: 'alice', createdAt: '2026-09-21T09:00:00Z', labels: ['pr:sub'], mergedAt: '2026-09-21T12:00:00Z', revertedAt: null, needsFix: { labeledAt: '2026-09-21T10:00:00Z', unlabeledAt: '2026-09-21T11:00:00Z' } } },
        { id: 's2', repo: 'core-repo', wave: 2, blockedBy: ['s1'], pr: { number: 502, author: 'alice', createdAt: '2026-09-21T13:00:00Z', labels: ['pr:sub', 'pr:needs-fix'], mergedAt: null, revertedAt: null, needsFix: { labeledAt: '2026-09-21T14:00:00Z', unlabeledAt: null } } },
        { id: 's3', repo: 'core-repo', wave: 2, blockedBy: ['s1'], pr: null },
      ],
      outbox: [
        { id: 's1-01-a', repo: 'core-repo', rank: 'high', raisedAt: '2026-09-21T10:00:00Z', settled: { verdict: 'agreed', at: '2026-09-22T10:00:00Z', by: 'pm', reworkMergedAt: null, reworkBy: null } },
        { id: 's1-02-b', repo: 'core-repo', rank: 'medium', raisedAt: '2026-09-21T10:00:00Z', settled: { verdict: 'drifted', at: '2026-09-22T10:00:00Z', by: 'pm', reworkMergedAt: '2026-09-22T15:00:00Z', reworkBy: 'alice' } },
        { id: 's1-03-c', repo: 'core-repo', rank: 'human-action', raisedAt: '2026-09-21T10:00:00Z', settled: null },
      ],
    });
    s.planets.push({
      prd: 2300, title: 'Shipped', captain: 'pm', ownerTeam: 'beaver',
      issue: { createdAt: '2026-08-01T08:00:00Z', closedAt: '2026-09-10T08:00:00Z' },
      regions: [{ repo: 'core-repo', blockedBy: [], surveyedAt: '2026-08-02T08:00:00Z' }],
      featurePr: { repo: 'core-repo', number: 400, createdAt: '2026-08-05T08:00:00Z', readyAt: '2026-09-09T08:00:00Z', mergedAt: '2026-09-10T08:00:00Z', lastActivityAt: '2026-09-10T08:00:00Z' },
      zones: [{ id: 's1', repo: 'core-repo', wave: 1, blockedBy: [], pr: { number: 401, author: 'alice', createdAt: '2026-08-06T08:00:00Z', labels: ['pr:sub'], mergedAt: '2026-08-07T08:00:00Z', revertedAt: null } }],
      outbox: [], bugs: [{ repo: 'core-repo', number: 600, createdAt: '2026-09-11T08:00:00Z', closedAt: '2026-09-12T08:00:00Z', closedBy: 'alice', fixedBy: 'alice' }],
    });
    const all = projectEvents(s, { config, now: NOW }).map((e) => e.id);
    expect(all.length).toBeGreaterThan(20);
    expect(new Set(all).size).toBe(all.length);
  });

  it('skips an event it cannot build, reports it through onSkip, and still projects the rest (F4)', () => {
    const s = snapshot();
    s.planets.push({
      prd: 2400, title: 'Broken', captain: null, ownerTeam: null,
      issue: { createdAt: 'not-a-date', closedAt: null },
      regions: [], featurePr: null, zones: [], outbox: [], bugs: [],
    });
    const skipped = [];
    const events = projectEvents(s, { config, now: NOW, onSkip: (err) => skipped.push(err) });
    expect(events.some((e) => e.id === 'planet:2332:charted')).toBe(true);
    expect(events.some((e) => e.planet === 2400)).toBe(false);
    expect(skipped).toEqual([{ id: 'planet:2400:charted', message: expect.stringMatching(/^at: /) }]);
    expect(() => projectEvents(s, { config, now: NOW })).not.toThrow();
  });

  it('is idempotent: the same snapshot yields the same ids and timestamps', () => {
    const a = projectEvents(snapshot(), { config, now: NOW });
    const b = projectEvents(snapshot(), { config, now: NOW });
    expect(a).toEqual(b);
  });
});

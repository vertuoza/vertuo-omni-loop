import { describe, it, expect } from 'vitest';
import { configFrom } from './config.ts';
import { projectEvents, type AnsweredRound, type Skip } from './projector.ts';
import type { GameEvent } from './events.ts';
import type { Snapshot, SnapshotPlanet } from './types.ts';
import { present } from './test/present.ts';
import { parsePrd } from '../kit/lib/ids.ts';

const config = configFrom({
  sectors: [{ name: 'core', repos: ['core-repo'] }],
  teams: [{ name: 'beaver', home: 'core' }, { name: 'octopod', home: 'core' }],
});
const NOW = new Date('2026-09-23T14:00:00Z');

function snapshot(planetOver: Record<string, unknown> = {}): Snapshot {
  return {
    at: NOW.toISOString(),
    teams: { alice: 'octopod', pm: 'beaver' },
    planets: [{
      prd: 2332, title: 'Generic Import Engine', captain: 'pm', ownerTeam: 'beaver',
      issue: { createdAt: '2026-09-01T08:00:00Z', closedAt: null },
      regions: [{ repo: 'core-repo', blockedBy: [], surveyedAt: '2026-09-02T08:00:00Z' }],
      featurePr: { repo: 'core-repo', number: 500, createdAt: '2026-09-21T08:00:00Z', readyAt: null, mergedAt: null, lastActivityAt: '2026-09-23T08:00:00Z' },
      zones: [
        { id: 's1', repo: 'core-repo', wave: 1, blockedBy: [], pr: { number: 501, author: 'alice', createdAt: '2026-09-21T09:00:00Z', labels: ['omni:sub'], mergedAt: '2026-09-21T12:00:00Z', revertedAt: null } },
        { id: 's2', repo: 'core-repo', wave: 2, blockedBy: ['s1'], pr: null },
      ],
      outbox: [{ id: 's1-01-a', repo: 'core-repo', rank: 'high', raisedAt: '2026-09-21T10:00:00Z', settled: { verdict: 'agreed', at: '2026-09-22T10:00:00Z', by: 'pm', reworkMergedAt: null } }],
      bugs: [],
      ...planetOver,
    }],
  } as unknown as Snapshot;
}

const ids = (events: GameEvent[]) => events.map((e) => e.id).sort();

describe('projectEvents', () => {
  it('emits the planet, region, zone and wound history with teams attached', () => {
    const events = projectEvents(snapshot(), { config, now: NOW });
    expect(ids(events)).toEqual([
      'outbox:core-repo:2332/s1-01-a:closed', 'outbox:core-repo:2332/s1-01-a:opened',
      'planet:2332:distress:2026-09-21T12:00:00Z', 'planet:2332:charted', 'region:core-repo:2332:surveyed',
      'zone:core-repo:2332:s1:claimed', 'zone:core-repo:2332:s1:opened', 'zone:core-repo:2332:s1:secured',
      'zone:core-repo:2332:s2:opened',
    ].sort());
    const secured = events.find((e) => e.id === 'zone:core-repo:2332:s1:secured');
    expect(secured).toMatchObject({ type: 'ZONE_SECURED', at: '2026-09-21T12:00:00Z', planet: 2332, region: 'core-repo', contributor: 'alice', team: 'octopod' });
    const closed = events.find((e) => e.id === 'outbox:core-repo:2332/s1-01-a:closed');
    expect(closed).toMatchObject({ type: 'WOUND_CLOSED', contributor: 'pm', team: 'beaver', data: { kind: 'unconfirmed-ground', rank: 'high', verdict: 'agreed' } });
    expect(present(events.find((e) => e.type === 'DISTRESS'), 'the event').at).toBe('2026-09-22T11:00:00Z');
  });

  it('emits a rescue when a claim follows a distress', () => {
    const events = projectEvents(snapshot({ zones: [
      { id: 's1', repo: 'core-repo', wave: 1, blockedBy: [], pr: { number: 501, author: 'alice', createdAt: '2026-09-21T09:00:00Z', labels: ['omni:sub'], mergedAt: '2026-09-21T12:00:00Z', revertedAt: null } },
      { id: 's2', repo: 'core-repo', wave: 2, blockedBy: ['s1'], pr: { number: 502, author: 'alice', createdAt: '2026-09-23T09:00:00Z', labels: ['omni:sub', 'omni:in-progress'], mergedAt: null, revertedAt: null } },
    ] }), { config, now: NOW });
    expect(events.find((e) => e.type === 'RESCUE')).toMatchObject({ id: 'planet:2332:rescue:2026-09-21T12:00:00Z', region: 'core-repo', contributor: 'alice', at: '2026-09-23T09:00:00Z', data: { pr: 502, zone: 's2' } });
    expect(events.find((e) => e.type === 'DISTRESS')).toMatchObject({ id: 'planet:2332:distress:2026-09-21T12:00:00Z', at: '2026-09-22T11:00:00Z' });
  });

  it('emits one distress per planet episode, however many zones are idle (F5b)', () => {
    const events = projectEvents(snapshot({ zones: [
      { id: 's1', repo: 'core-repo', wave: 1, blockedBy: [], pr: { number: 501, author: 'alice', createdAt: '2026-09-21T09:00:00Z', labels: ['omni:sub'], mergedAt: '2026-09-21T12:00:00Z', revertedAt: null } },
      { id: 's2', repo: 'core-repo', wave: 2, blockedBy: ['s1'], pr: null },
      { id: 's3', repo: 'core-repo', wave: 2, blockedBy: ['s1'], pr: null },
    ] }), { config, now: NOW });
    expect(events.filter((e) => e.type === 'DISTRESS').map((e) => e.id)).toEqual(['planet:2332:distress:2026-09-21T12:00:00Z']);
  });

  it('emits no distress when the claim came within 8 working hours', () => {
    const events = projectEvents(snapshot({ zones: [
      { id: 's1', repo: 'core-repo', wave: 1, blockedBy: [], pr: { number: 501, author: 'alice', createdAt: '2026-09-21T09:00:00Z', labels: ['omni:sub'], mergedAt: '2026-09-21T12:00:00Z', revertedAt: null } },
      { id: 's2', repo: 'core-repo', wave: 2, blockedBy: ['s1'], pr: { number: 502, author: 'alice', createdAt: '2026-09-21T13:00:00Z', labels: ['omni:sub', 'omni:in-progress'], mergedAt: null, revertedAt: null } },
    ] }), { config, now: NOW });
    expect(events.some((e) => e.type === 'DISTRESS' || e.type === 'RESCUE')).toBe(false);
  });

  it('emits ready, terraformed, lost and decommissioned at the right times', () => {
    const merged = { repo: 'core-repo', number: 500, createdAt: '2026-09-21T08:00:00Z', readyAt: '2026-09-22T08:00:00Z', mergedAt: '2026-09-22T12:00:00Z', lastActivityAt: '2026-09-22T12:00:00Z' };
    const oneZone = [{ id: 's1', repo: 'core-repo', wave: 1, blockedBy: [], pr: { number: 501, author: 'alice', createdAt: '2026-09-21T09:00:00Z', labels: ['omni:sub'], mergedAt: '2026-09-21T12:00:00Z', revertedAt: null } }];
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

  it('emits a silence loss only while the planet is still silent at now (revival)', () => {
    // s1 claimed 2026-08-03, then nothing for well over 10 working days, then the label on s1's
    // sub-PR comes off on 2026-09-22 (delivery activity): the planet revived, so no PLANET_LOST.
    const zones = [{ id: 's1', repo: 'core-repo', wave: 1, blockedBy: [], pr: { number: 501, author: 'alice', createdAt: '2026-08-03T09:00:00Z', labels: ['omni:sub'], mergedAt: null, revertedAt: null, needsFix: { labeledAt: '2026-08-03T10:00:00Z', unlabeledAt: '2026-09-22T10:00:00Z' } } }];
    const quiet = { issue: { createdAt: '2026-08-01T08:00:00Z', closedAt: null }, regions: [{ repo: 'core-repo', blockedBy: [], surveyedAt: '2026-08-01T08:00:00Z' }], featurePr: { repo: 'core-repo', number: 500, createdAt: '2026-08-03T08:00:00Z', readyAt: null, mergedAt: null, lastActivityAt: '2026-08-03T09:00:00Z' }, outbox: [], zones };
    expect(projectEvents(snapshot(quiet), { config, now: NOW }).some((e) => e.type === 'PLANET_LOST')).toBe(false);
    // Silent again from 2026-09-22 10:00Z: lost ten working days later, not at the old August gap.
    const later = projectEvents(snapshot(quiet), { config, now: new Date('2026-10-20T10:00:00Z') }).find((e) => e.type === 'PLANET_LOST');
    expect(later).toMatchObject({ at: '2026-10-06T10:00:00Z', data: { reason: 'silence' } });
  });

  it('emits locked and unlocked against a blocker planet', () => {
    const s = snapshot({ regions: [{ repo: 'core-repo', blockedBy: [2300], surveyedAt: '2026-09-02T08:00:00Z' }] });
    s.planets.push({
      prd: 2300, title: 'Blocker', captain: 'pm', ownerTeam: 'beaver',
      issue: { createdAt: '2026-08-01T08:00:00Z', closedAt: '2026-09-10T08:00:00Z' },
      regions: [{ repo: 'core-repo', blockedBy: [], surveyedAt: '2026-08-02T08:00:00Z' }],
      featurePr: { repo: 'core-repo', number: 400, createdAt: '2026-08-05T08:00:00Z', readyAt: '2026-09-09T08:00:00Z', mergedAt: '2026-09-10T08:00:00Z', lastActivityAt: '2026-09-10T08:00:00Z' },
      zones: [{ id: 's1', repo: 'core-repo', wave: 1, blockedBy: [], pr: { number: 401, author: 'alice', createdAt: '2026-08-06T08:00:00Z', labels: ['omni:sub'], mergedAt: '2026-08-07T08:00:00Z', revertedAt: null } }],
      outbox: [], bugs: [],
    } as unknown as SnapshotPlanet);
    const events = projectEvents(s, { config, now: NOW });
    expect(events.find((e) => e.id === 'planet:2332:locked:2300')).toMatchObject({ at: '2026-09-02T08:00:00Z' });
    expect(events.find((e) => e.id === 'planet:2332:unlocked:2300')).toMatchObject({ at: '2026-09-10T08:00:00Z' });
  });

  it('gives every event of a rich snapshot a unique id (F1)', () => {
    const s = snapshot({
      zones: [
        { id: 's1', repo: 'core-repo', wave: 1, blockedBy: [], pr: { number: 501, author: 'alice', createdAt: '2026-09-21T09:00:00Z', labels: ['omni:sub'], mergedAt: '2026-09-21T12:00:00Z', revertedAt: null, needsFix: { labeledAt: '2026-09-21T10:00:00Z', unlabeledAt: '2026-09-21T11:00:00Z' } } },
        { id: 's2', repo: 'core-repo', wave: 2, blockedBy: ['s1'], pr: { number: 502, author: 'alice', createdAt: '2026-09-21T13:00:00Z', labels: ['omni:sub', 'omni:needs-fix'], mergedAt: null, revertedAt: null, needsFix: { labeledAt: '2026-09-21T14:00:00Z', unlabeledAt: null } } },
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
      zones: [{ id: 's1', repo: 'core-repo', wave: 1, blockedBy: [], pr: { number: 401, author: 'alice', createdAt: '2026-08-06T08:00:00Z', labels: ['omni:sub'], mergedAt: '2026-08-07T08:00:00Z', revertedAt: null } }],
      outbox: [], bugs: [{ repo: 'core-repo', number: 600, createdAt: '2026-09-11T08:00:00Z', closedAt: '2026-09-12T08:00:00Z', closedBy: 'alice', fixedBy: 'alice' }],
    } as unknown as SnapshotPlanet);
    const all = projectEvents(s, { config, now: NOW }).map((e) => e.id);
    expect(all.length).toBeGreaterThan(20);
    expect(new Set(all).size).toBe(all.length);
  });

  it('skips an event it cannot build, reports it through onSkip, and still projects the rest (F4)', () => {
    const s = snapshot();
    s.planets.push({
      prd: parsePrd(2400), title: 'Broken', captain: null, ownerTeam: null,
      issue: { createdAt: 'not-a-date', closedAt: null },
      regions: [], featurePr: null, zones: [], outbox: [], bugs: [],
    });
    const skipped: Skip[] = [];
    const events = projectEvents(s, { config, now: NOW, onSkip: (err) => skipped.push(err) });
    expect(events.some((e) => e.id === 'planet:2332:charted')).toBe(true);
    expect(events.some((e) => e.planet === 2400)).toBe(false);
    const aBadTime: unknown = expect.stringMatching(/^at: /);
    expect(skipped).toEqual([{ id: 'planet:2400:charted', message: aBadTime }]);
    expect(() => projectEvents(s, { config, now: NOW })).not.toThrow();
  });

  describe('a contributor that is not a GitHub login (PRD 1180)', () => {
    const settledBy = (by: string) => snapshot({ outbox: [{ id: 's1-01-a', repo: 'core-repo', rank: 'high', raisedAt: '2026-09-21T10:00:00Z', settled: { verdict: 'agreed', at: '2026-09-22T10:00:00Z', by, reworkMergedAt: null } }] });
    it.each(['@pm', 'clement.noterdaem', 'Pierre', '-pm', 'a'.repeat(40), 'p m'])('skips the event credited to %j with a warning naming it', (name) => {
      const skipped: Skip[] = [];
      const events = projectEvents(settledBy(name), { config, now: NOW, onSkip: (s) => skipped.push(s) });
      expect(events.some((e) => e.type === 'WOUND_CLOSED')).toBe(false);
      expect(events.some((e) => e.id === 'planet:2332:charted')).toBe(true);
      expect(skipped).toEqual([{ id: expect.stringMatching(/:closed$/) as unknown as string, message: `contributor ${JSON.stringify(name)} is not a GitHub login` }]);
    });

    it('writes it, under the same id, on the first poll after the name is fixed', () => {
      const before = projectEvents(settledBy('@pm'), { config, now: NOW, onSkip: () => {} });
      const after = projectEvents(settledBy('pm'), { config, now: NOW });
      const closed = after.find((e) => e.type === 'WOUND_CLOSED');
      expect(closed).toMatchObject({ contributor: 'pm', team: 'beaver' });
      expect(before.some((e) => e.id === closed?.id)).toBe(false);
      expect(after.filter((e) => e.id !== closed?.id)).toEqual(before);
    });

    it('keeps every login GitHub can issue', () => {
      for (const login of ['pm', 'paul-w', 'a1', 'a'.repeat(39)]) {
        const skipped: Skip[] = [];
        projectEvents(settledBy(login), { config, now: NOW, onSkip: (s) => skipped.push(s) });
        expect(skipped).toEqual([]);
      }
    });

    it('skips an answered round whose login is not a GitHub login', () => {
      const s: Snapshot = { ...snapshot(), planets: [{ ...snapshot().planets[0], home: 'acme/plan' } as unknown as SnapshotPlanet] };
      const skipped: Skip[] = [];
      const events = projectEvents(s, { config, now: NOW, onSkip: (k) => skipped.push(k), answers: [{ roundId: 'r1', answeredAt: '2026-09-22T09:30:00Z', prd: parsePrd(2332), home: 'acme/plan', login: '@alice' }] });
      expect(events.some((e) => e.type === 'QUESTION_ANSWERED')).toBe(false);
      expect(skipped).toEqual([{ id: 'ask:r1:answered', message: 'contributor "@alice" is not a GitHub login' }]);
    });
  });

  it('names the right sub-PR when two regions share a slice id (F3)', () => {
    const events = projectEvents(snapshot({ zones: [
      { id: 's1', repo: 'core-repo', wave: 1, blockedBy: [], pr: { number: 501, author: 'alice', createdAt: '2026-09-21T09:00:00Z', labels: ['omni:sub'], mergedAt: '2026-09-21T12:00:00Z', revertedAt: null } },
      { id: 's1', repo: 'ai-repo', wave: 1, blockedBy: [], pr: { number: 701, author: 'alice', createdAt: '2026-09-21T09:00:00Z', labels: ['omni:sub'], mergedAt: '2026-09-21T13:00:00Z', revertedAt: null } },
    ] }), { config, now: NOW });
    expect(present(events.find((e) => e.id === 'zone:ai-repo:2332:s1:secured'), 'the event').data.pr).toBe(701);
  });

  describe('a PRD named by its home (PRD 728)', () => {
    type Over = { ownerTeam?: string; blockedBy?: number[]; mergedAt?: string; author?: string };
    const homed = (home: string, over: Over = {}): SnapshotPlanet => ({
      ...snapshot().planets[0], prd: 88, home, ownerTeam: over.ownerTeam ?? 'beaver',
      regions: [{ repo: home, blockedBy: over.blockedBy ?? [], surveyedAt: '2026-09-02T08:00:00Z' }],
      featurePr: { repo: home, number: 500, createdAt: '2026-09-21T08:00:00Z', readyAt: '2026-09-22T08:00:00Z', mergedAt: over.mergedAt ?? null, lastActivityAt: '2026-09-22T12:00:00Z' },
      zones: [{ id: 's1', repo: home, wave: 1, blockedBy: [], pr: { number: 501, author: over.author ?? 'alice', createdAt: '2026-09-21T09:00:00Z', labels: ['omni:sub'], mergedAt: '2026-09-21T12:00:00Z', revertedAt: null } }],
      outbox: [{ id: 's1-01-a', repo: home, rank: 'high', raisedAt: '2026-09-21T10:00:00Z', settled: { verdict: 'agreed', at: '2026-09-22T10:00:00Z', by: 'pm', reworkMergedAt: null } }],
    }) as unknown as SnapshotPlanet;

    it('names every event by its home, and stamps each with it', () => {
      const events = projectEvents({ ...snapshot(), planets: [homed('acme/plan', { mergedAt: '2026-09-22T12:00:00Z' })] }, { config, now: NOW });
      expect(ids(events)).toEqual([
        'outbox:acme/plan:acme/plan#88/s1-01-a:closed', 'outbox:acme/plan:acme/plan#88/s1-01-a:opened',
        'planet:acme/plan#88:charted', 'planet:acme/plan#88:ready', 'planet:acme/plan#88:terraformed',
        'region:acme/plan:acme/plan#88:surveyed',
        'zone:acme/plan:acme/plan#88:s1:claimed', 'zone:acme/plan:acme/plan#88:s1:opened', 'zone:acme/plan:acme/plan#88:s1:secured',
      ].sort());
      expect(events.every((e) => e.home === 'acme/plan' && e.planet === 88)).toBe(true);
    });

    it('keeps two homes\' PRD 88 apart: no shared id, and a blocker is the one of its own home', () => {
      const events = projectEvents({ ...snapshot(), planets: [
        homed('acme/plan', { mergedAt: '2026-09-22T12:00:00Z' }),
        homed('acme/tools', { author: 'bob', ownerTeam: 'octopod' }),
        { ...homed('acme/tools'), prd: 90, zones: [], outbox: [], featurePr: null, regions: [{ repo: 'acme/tools', blockedBy: [88], surveyedAt: '2026-09-02T08:00:00Z' }] } as unknown as SnapshotPlanet,
      ] }, { config, now: NOW });
      const all = events.map((e) => e.id);
      expect(new Set(all).size).toBe(all.length);
      expect(events.filter((e) => e.type === 'PLANET_TERRAFORMED').map((e) => e.home)).toEqual(['acme/plan']);
      // acme/tools#90 waits for acme/tools#88, which has not merged: acme/plan#88's terraform does not unlock it.
      expect(all).toContain('planet:acme/tools#90:locked:88');
      expect(all.some((id) => id.startsWith('planet:acme/tools#90:unlocked'))).toBe(false);
    });
  });

  describe('an answered round (PRD 1180)', () => {
    const homed = (home: string): Snapshot => ({ ...snapshot(), planets: [{ ...snapshot().planets[0], home } as unknown as SnapshotPlanet] });
    const round = (over: Partial<AnsweredRound> = {}): AnsweredRound => ({
      roundId: '00000000-0000-4000-8000-0000000000a1', answeredAt: '2026-09-22T09:30:00Z', prd: parsePrd(2332), home: 'acme/plan', login: 'alice', ...over,
    });
    const answers = (events: GameEvent[]) => events.filter((e) => e.type === 'QUESTION_ANSWERED');

    it('becomes one QUESTION_ANSWERED, dated when it was answered, crediting its answerer and fleet', () => {
      const events = projectEvents(homed('acme/plan'), { config, now: NOW, answers: [round(), round({ roundId: 'r2', login: 'pm', answeredAt: '2026-09-23T08:00:00Z' })] });
      expect(answers(events)).toEqual([
        { id: 'ask:00000000-0000-4000-8000-0000000000a1:answered', at: '2026-09-22T09:30:00Z', type: 'QUESTION_ANSWERED', planet: 2332, home: 'acme/plan', contributor: 'alice', team: 'octopod', data: {} },
        { id: 'ask:r2:answered', at: '2026-09-23T08:00:00Z', type: 'QUESTION_ANSWERED', planet: 2332, home: 'acme/plan', contributor: 'pm', team: 'beaver', data: {} },
      ]);
    });

    it('keeps the same id on every poll, so the ledger pays it once', () => {
      const poll = () => answers(projectEvents(homed('acme/plan'), { config, now: NOW, answers: [round()] }));
      expect(poll()).toEqual(poll());
      expect(poll().map((e) => e.id)).toEqual(['ask:00000000-0000-4000-8000-0000000000a1:answered']);
    });

    it('writes nothing yet for a round whose planet is not charted in this poll', () => {
      const skipped: Skip[] = [];
      const events = projectEvents(homed('acme/plan'), { config, now: NOW, onSkip: (s) => skipped.push(s), answers: [
        round({ prd: parsePrd(9999) }),
        round({ home: 'acme/tools' }), // the same number in another home is another planet
      ] });
      expect(answers(events)).toEqual([]);
      expect(skipped).toEqual([]);
    });

    it('skips a round it cannot build and still projects the rest', () => {
      const skipped: Skip[] = [];
      const events = projectEvents(homed('acme/plan'), { config, now: NOW, onSkip: (s) => skipped.push(s), answers: [round({ answeredAt: 'yesterday' }), round({ roundId: 'r2' })] });
      expect(answers(events).map((e) => e.id)).toEqual(['ask:r2:answered']);
      expect(skipped.map((s) => s.id)).toEqual(['ask:00000000-0000-4000-8000-0000000000a1:answered']);
    });

    it('leaves the other events of the poll as they were', () => {
      const without = projectEvents(homed('acme/plan'), { config, now: NOW });
      const withAnswers = projectEvents(homed('acme/plan'), { config, now: NOW, answers: [round()] });
      expect(withAnswers.filter((e) => e.type !== 'QUESTION_ANSWERED')).toEqual(without);
    });
  });

  it('is idempotent: the same snapshot yields the same ids and timestamps', () => {
    const a = projectEvents(snapshot(), { config, now: NOW });
    const b = projectEvents(snapshot(), { config, now: NOW });
    expect(a).toEqual(b);
  });
});

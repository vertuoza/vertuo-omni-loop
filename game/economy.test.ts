import { describe, it, expect } from 'vitest';
import { score, seasonsToScore } from './economy.ts';
import type { EventType, GameEvent } from './events.ts';
import { present } from './test/present.ts';

const NOW = new Date('2026-09-30T16:00:00Z');
const E = (id: string, at: string, type: EventType, over: Partial<GameEvent> = {}): GameEvent => ({ id, at, type, planet: 2332, data: {}, ...over });
const charted = E('planet:2332:charted', '2026-09-01T08:00:00Z', 'PLANET_CHARTED', { data: { ownerTeam: 'beaver', captain: 'pm' } });

describe('score', () => {
  it('credits a secured zone to its author and team, night shift ×1.5', () => {
    const s = score([
      charted,
      E('z1:secured', '2026-09-21T12:00:00Z', 'ZONE_SECURED', { contributor: 'alice', team: 'octopod' }), // 14:00 local, working
      E('z2:secured', '2026-09-21T20:00:00Z', 'ZONE_SECURED', { contributor: 'alice', team: 'octopod' }), // 22:00 local, night
    ], { season: '2026-09', now: NOW });
    expect(s.individuals).toEqual({ alice: 25 });
    expect(s.teams).toEqual({ octopod: 25 });
  });

  it('takes back a reverted zone', () => {
    const s = score([
      charted,
      E('zone:r:2332:s1:secured', '2026-09-21T12:00:00Z', 'ZONE_SECURED', { contributor: 'alice', team: 'octopod' }),
      E('zone:r:2332:s1:reverted', '2026-09-22T12:00:00Z', 'ZONE_REVERTED', { contributor: 'alice', team: 'octopod' }),
    ], { season: '2026-09', now: NOW });
    expect(s.individuals).toEqual({ alice: 0 });
  });

  it('pays wound closure by kind, ×1.5 cross-team, and the same for a drifted settle as an agreed one (F5a)', () => {
    const s = score([
      charted,
      E('w1:opened', '2026-09-21T10:00:00Z', 'WOUND_OPENED', { data: { kind: 'beacon', rank: 'human-action' } }),
      E('w1:closed', '2026-09-21T11:00:00Z', 'WOUND_CLOSED', { contributor: 'pm', team: 'beaver', data: { kind: 'beacon', rank: 'human-action', verdict: 'agreed' } }),
      E('w2:opened', '2026-09-21T10:00:00Z', 'WOUND_OPENED', { data: { kind: 'unconfirmed-ground', rank: 'high' } }),
      E('w2:closed', '2026-09-21T11:00:00Z', 'WOUND_CLOSED', { contributor: 'eve', team: 'octopod', data: { kind: 'unconfirmed-ground', rank: 'high', verdict: 'agreed' } }),
      E('w3:opened', '2026-09-21T10:00:00Z', 'WOUND_OPENED', { data: { kind: 'unconfirmed-ground', rank: 'high' } }),
      E('w3:closed', '2026-09-21T11:00:00Z', 'WOUND_CLOSED', { contributor: 'pm', team: 'beaver', data: { kind: 'unconfirmed-ground', rank: 'high', verdict: 'drifted' } }),
    ], { season: '2026-09', now: NOW });
    // Was pm 25 (drifted scored 0); an honest drift now pays like an agreement: 25 + 15.
    expect(s.individuals).toEqual({ pm: 40, eve: 22.5 });
    expect(s.teams).toEqual({ beaver: 40, octopod: 22.5 });
    expect(s.credits.find((c) => c.to === 'eve')).toMatchObject({ crossTeam: true });
    expect(present(s.credits.find((c) => c.to === 'pm'), 'the credit').crossTeam).toBeUndefined();
  });

  it('pays nothing for a settle verdict other than agreed or drifted (F5a)', () => {
    const s = score([
      charted,
      E('w1:opened', '2026-09-21T10:00:00Z', 'WOUND_OPENED', { data: { kind: 'beacon', rank: 'human-action' } }),
      E('w1:closed', '2026-09-21T11:00:00Z', 'WOUND_CLOSED', { contributor: 'pm', team: 'beaver', data: { kind: 'beacon', rank: 'human-action', verdict: 'undetermined' } }),
    ], { season: '2026-09', now: NOW });
    expect(s.individuals).toEqual({});
  });

  it('pays a rescue only to a claimer from another team (F5b)', () => {
    const s = score([
      charted,
      E('planet:2332:rescue:a', '2026-09-22T12:00:00Z', 'RESCUE', { contributor: 'bob', team: 'cia' }),
      E('planet:2332:rescue:b', '2026-09-23T12:00:00Z', 'RESCUE', { contributor: 'pm', team: 'beaver' }),
    ], { season: '2026-09', now: NOW });
    expect(s.individuals).toEqual({ bob: 20 });
    expect(s.teams).toEqual({ cia: 20 });
  });

  it('debits a revert only when the zone was secured in the same season', () => {
    const s = score([
      charted,
      E('zone:r:2332:s1:secured', '2026-08-28T12:00:00Z', 'ZONE_SECURED', { contributor: 'alice', team: 'octopod' }),
      E('zone:r:2332:s1:reverted', '2026-09-02T12:00:00Z', 'ZONE_REVERTED', { contributor: 'alice', team: 'octopod' }),
    ], { season: '2026-09', now: NOW });
    expect(s.individuals).toEqual({});
    expect(s.credits).toEqual([]);
  });

  it('decays the owner team per 4 working hours, clipped to the season, and not over a weekend', () => {
    const s = score([
      charted,
      // Fri 2026-09-25 17:00 local → Mon 10:00 local: 2 working hours → 0 tranches
      E('w1:opened', '2026-09-25T15:00:00Z', 'WOUND_OPENED', { data: { kind: 'beacon', rank: 'human-action' } }),
      E('w1:closed', '2026-09-28T08:00:00Z', 'WOUND_CLOSED', { contributor: 'pm', team: 'beaver', data: { kind: 'beacon', rank: 'human-action', verdict: 'agreed' } }),
      // Mon 2026-09-21 09:00 local, still open at NOW (Wed 30th 18:00 local): 8 working days × 9h = 72h → 18 tranches × 5
      E('w2:opened', '2026-09-21T07:00:00Z', 'WOUND_OPENED', { data: { kind: 'beacon', rank: 'human-action' } }),
    ], { season: '2026-09', now: NOW });
    expect(s.teams).toEqual({ beaver: 25 - 90 });
  });

  it('pays the terraform bonus with class, cross-sector and streak, to owner, expedition and closers', () => {
    const s = score([
      charted,
      E('zone:r:2332:s1:secured', '2026-09-21T12:00:00Z', 'ZONE_SECURED', { contributor: 'alice', team: 'octopod' }),
      E('w1:opened', '2026-09-21T10:00:00Z', 'WOUND_OPENED', { data: { kind: 'transmission', rank: 'medium' } }),
      E('w1:closed', '2026-09-21T11:00:00Z', 'WOUND_CLOSED', { contributor: 'pm', team: 'beaver', data: { kind: 'transmission', rank: 'medium', verdict: 'agreed' } }),
      E('planet:2332:terraformed', '2026-09-22T12:00:00Z', 'PLANET_TERRAFORMED', { data: { ownerTeam: 'beaver', class: 2, crossSector: true } }),
    ], { season: '2026-09', now: NOW });
    // owner: 100 × 1.5 × 1.25 = 187.5 ; alice: 10 + 50 ; pm: 5 + 25
    expect(s.teams).toEqual({ beaver: 187.5 + 30, octopod: 60 });
    expect(s.individuals).toEqual({ alice: 60, pm: 30 });
    expect(s.planets[2332]).toMatchObject({ ownerTeam: 'beaver', terraformed: true, lost: false });
  });

  it('raises the streak by 10% per consecutive terraform and resets it on a loss', () => {
    const t = (prd: number, at: string) => E(`planet:${prd}:terraformed`, at, 'PLANET_TERRAFORMED', { planet: prd, data: { ownerTeam: 'beaver', class: 1, crossSector: false } });
    const c = (prd: number) => E(`planet:${prd}:charted`, '2026-08-01T08:00:00Z', 'PLANET_CHARTED', { planet: prd, data: { ownerTeam: 'beaver' } });
    const s = score([
      c(1), c(2), c(3), c(4),
      t(1, '2026-08-20T10:00:00Z'), // previous season: the streak resets at season start, so it no longer counts
      t(2, '2026-09-10T10:00:00Z'), // prior streak 0 → 100 (was 110 when streaks crossed seasons)
      E('planet:3:lost', '2026-09-15T10:00:00Z', 'PLANET_LOST', { planet: 3, data: { ownerTeam: 'beaver', reason: 'closed' } }),
      t(4, '2026-09-20T10:00:00Z'), // prior streak 0 → 100
    ], { season: '2026-09', now: NOW });
    expect(s.teams).toEqual({ beaver: 200 });
    expect(s.streaks).toEqual({ beaver: 1 });
  });

  it('claws back everything earned on a lost planet in the season', () => {
    const s = score([
      charted,
      E('zone:r:2332:s1:secured', '2026-09-21T12:00:00Z', 'ZONE_SECURED', { contributor: 'alice', team: 'octopod' }),
      E('zone:r:2332:s2:rescue', '2026-09-22T12:00:00Z', 'RESCUE', { contributor: 'bob', team: 'cia' }),
      E('planet:2332:lost', '2026-09-25T12:00:00Z', 'PLANET_LOST', { data: { ownerTeam: 'beaver', reason: 'closed' } }),
    ], { season: '2026-09', now: NOW });
    expect(s.individuals).toEqual({ alice: 0, bob: 0 });
    expect(s.teams).toEqual({ octopod: 0, cia: 0 });
    expect(s.credits.filter((c) => c.clawed)).toHaveLength(2);
    expect(present(s.planets[2332], 'planet 2332').lost).toBe(true);
  });

  it('a lost planet keeps the decay it accrued', () => {
    const s = score([
      charted,
      // Mon 2026-09-21 09:00 local, never closed; planet lost Wed 2026-09-23 18:00 local:
      // Mon–Wed × 9h = 27h working → 6 tranches × 5 = −30, decay stops accruing at the loss.
      E('w1:opened', '2026-09-21T07:00:00Z', 'WOUND_OPENED', { data: { kind: 'beacon', rank: 'human-action' } }),
      E('planet:2332:lost', '2026-09-23T16:00:00Z', 'PLANET_LOST', { data: { ownerTeam: 'beaver', reason: 'closed' } }),
    ], { season: '2026-09', now: NOW });
    expect(s.teams).toEqual({ beaver: -30 });
    const decayCredit = s.credits.find((c) => c.reason.startsWith('decay:'));
    expect(decayCredit).toMatchObject({ points: -30, clawed: false });
  });

  it('claws back earned credits on a lost planet but keeps its decay', () => {
    const s = score([
      charted,
      E('zone:r:2332:s1:secured', '2026-09-21T12:00:00Z', 'ZONE_SECURED', { contributor: 'alice', team: 'octopod' }),
      E('w1:opened', '2026-09-21T07:00:00Z', 'WOUND_OPENED', { data: { kind: 'beacon', rank: 'human-action' } }),
      E('planet:2332:lost', '2026-09-23T16:00:00Z', 'PLANET_LOST', { data: { ownerTeam: 'beaver', reason: 'closed' } }),
    ], { season: '2026-09', now: NOW });
    expect(s.individuals).toEqual({ alice: 0 });
    expect(s.teams).toEqual({ octopod: 0, beaver: -30 });
  });

  it('keeps two homes\' PRD 88 apart: no shared owner, clawback, terraform or expedition (PRD 728)', () => {
    const A = { planet: 88, home: 'acme/plan' };
    const B = { planet: 88, home: 'acme/tools' };
    const s = score([
      E('planet:acme/plan#88:charted', '2026-09-01T08:00:00Z', 'PLANET_CHARTED', { ...A, data: { ownerTeam: 'beaver' } }),
      E('planet:acme/tools#88:charted', '2026-09-01T08:00:00Z', 'PLANET_CHARTED', { ...B, data: { ownerTeam: 'octopod' } }),
      E('zone:acme/plan:acme/plan#88:s1:secured', '2026-09-21T12:00:00Z', 'ZONE_SECURED', { ...A, contributor: 'alice', team: 'octopod' }),
      E('zone:acme/tools:acme/tools#88:s1:secured', '2026-09-21T12:00:00Z', 'ZONE_SECURED', { ...B, contributor: 'bob', team: 'beaver' }),
      E('planet:acme/plan#88:terraformed', '2026-09-22T12:00:00Z', 'PLANET_TERRAFORMED', { ...A, data: { class: 1 } }),
      E('planet:acme/tools#88:lost', '2026-09-23T12:00:00Z', 'PLANET_LOST', { ...B, data: { reason: 'closed' } }),
    ], { season: '2026-09', now: NOW });
    // acme/plan#88: alice's zone and expedition bonus, beaver's terraform. acme/tools#88: lost, bob's zone clawed.
    expect(s.individuals).toEqual({ alice: 60, bob: 0 });
    expect(s.teams).toEqual({ octopod: 60, beaver: 100 });
    expect(s.planets['acme/plan#88']).toMatchObject({ ownerTeam: 'beaver', terraformed: true, lost: false });
    expect(s.planets['acme/tools#88']).toMatchObject({ ownerTeam: 'octopod', terraformed: false, lost: true });
    expect(s.credits.find((c) => c.to === 'alice' && c.reason === 'zone secured')).toMatchObject({ planet: 88, home: 'acme/plan', key: 'acme/plan#88' });
  });

  describe('an answered question (PRD 1180)', () => {
    const answered = (round: string, at: string, contributor = 'alice', team = 'octopod') =>
      E(`ask:${round}:answered`, at, 'QUESTION_ANSWERED', { contributor, team });

    it('pays its answerer 2, in the season it was answered, with no multiplier at night', () => {
      const s = score([
        charted,
        answered('r1', '2026-09-21T12:00:00Z'),
        answered('r2', '2026-09-21T21:00:00Z'), // 23:00 in Brussels: no night shift
        answered('r3', '2026-08-31T21:00:00Z'), // the previous season
      ], { season: '2026-09', now: NOW });
      expect(s.individuals).toEqual({ alice: 4 });
      expect(s.teams).toEqual({ octopod: 4 });
      expect(s.credits.map((c) => c.reason)).toEqual(['question answered', 'question answered']);
      expect(score([charted, answered('r3', '2026-08-31T21:00:00Z')], { season: '2026-08', now: NOW }).individuals).toEqual({ alice: 2 });
    });

    it('pays an answer no PRD claims (planet 0) and adds no planet to the season', () => {
      const s = score([charted, E('ask:r1:answered', '2026-09-21T12:00:00Z', 'QUESTION_ANSWERED', { planet: 0, contributor: 'alice', team: 'octopod' })], { season: '2026-09', now: NOW });
      expect(s.individuals).toEqual({ alice: 2 });
      expect(Object.keys(s.planets)).toEqual(['2332']);
    });

    it('changes no threat, decay, terraform or streak number', () => {
      const delivery = [
        charted,
        E('zone:r:2332:s1:secured', '2026-09-21T12:00:00Z', 'ZONE_SECURED', { contributor: 'alice', team: 'octopod' }),
        E('w1:opened', '2026-09-21T07:00:00Z', 'WOUND_OPENED', { data: { kind: 'beacon', rank: 'human-action' } }),
        E('w1:closed', '2026-09-23T11:00:00Z', 'WOUND_CLOSED', { contributor: 'pm', team: 'beaver', data: { kind: 'beacon', rank: 'human-action', verdict: 'agreed' } }),
        E('w2:opened', '2026-09-24T07:00:00Z', 'WOUND_OPENED', { data: { kind: 'transmission', rank: 'medium' } }),
        E('planet:2332:terraformed', '2026-09-25T12:00:00Z', 'PLANET_TERRAFORMED', { data: { ownerTeam: 'beaver', class: 2, crossSector: true } }),
      ];
      const before = score(delivery, { season: '2026-09', now: NOW });
      const after = score([...delivery, answered('r1', '2026-09-22T09:00:00Z', 'eve', 'cia'), answered('r2', '2026-09-24T09:00:00Z', 'pm', 'beaver')], { season: '2026-09', now: NOW });
      const notAnswers = after.credits.filter((c) => c.reason !== 'question answered');
      expect(notAnswers).toEqual(before.credits);
      expect(after.streaks).toEqual(before.streaks);
      expect(after.planets[2332]).toMatchObject({ terraformed: true, lost: false });
      // An answerer is no expedition and no closer: the terraform pays the same crew.
      expect(after.credits.filter((c) => c.reason === 'question answered').map((c) => [c.to, c.points])).toEqual([['eve', 2], ['pm', 2]]);
    });
  });

  describe('a merged feature PR', () => {
    it('pays its merger 30 and each approver 10, in the season of the merge, outside the crew', () => {
      const terraformed = E('planet:2332:terraformed', '2026-09-25T21:00:00Z', 'PLANET_TERRAFORMED', { data: { ownerTeam: 'beaver', class: 1 } });
      const merged = E('merge:r#500:2332:merged', '2026-09-25T21:00:00Z', 'FEATURE_MERGED', { contributor: 'pm', team: 'beaver' });
      const approved = E('merge:r#500:2332:approved:eve', '2026-09-25T21:00:00Z', 'FEATURE_REVIEWED', { contributor: 'eve', team: 'cia' });
      const before = score([charted, terraformed], { season: '2026-09', now: NOW });
      const s = score([charted, terraformed, merged, approved], { season: '2026-09', now: NOW });
      expect(s.individuals).toEqual({ pm: 30, eve: 10 }); // 23:00 in Brussels: no night shift
      expect(s.credits.filter((c) => c.reason.startsWith('feature ')).map((c) => [c.to, c.reason])).toEqual([['eve', 'feature reviewed'], ['pm', 'feature merged']]);
      expect(s.streaks).toEqual(before.streaks);
      expect(score([charted, merged, approved], { season: '2026-10', now: NOW }).individuals).toEqual({});
    });
  });

  it('ignores credits outside the season month', () => {
    const s = score([
      charted,
      E('z1:secured', '2026-08-21T12:00:00Z', 'ZONE_SECURED', { contributor: 'alice', team: 'octopod' }),
    ], { season: '2026-09', now: NOW });
    expect(s.individuals).toEqual({});
  });
});

describe('seasonsToScore', () => {
  it('scores the current season, and in the first 7 days also the previous one, whose final standings are posted', () => {
    expect(seasonsToScore(new Date('2026-09-24T10:00:00Z'))).toEqual({ seasons: ['2026-09'], rankings: '2026-09' });
    expect(seasonsToScore(new Date('2026-10-07T23:00:00Z'))).toEqual({ seasons: ['2026-09', '2026-10'], rankings: '2026-09' });
    expect(seasonsToScore(new Date('2026-10-08T00:00:00Z'))).toEqual({ seasons: ['2026-10'], rankings: '2026-10' });
    expect(seasonsToScore(new Date('2027-01-03T10:00:00Z'))).toEqual({ seasons: ['2026-12', '2027-01'], rankings: '2026-12' });
  });

  it('scores only the season it is given', () => {
    expect(seasonsToScore(new Date('2026-10-02T10:00:00Z'), '2026-08')).toEqual({ seasons: ['2026-08'], rankings: '2026-08' });
  });
});

import { describe, it, expect } from 'vitest';
import { score } from './economy.mjs';

const NOW = new Date('2026-09-30T16:00:00Z');
const E = (id, at, type, over = {}) => ({ id, at, type, planet: 2332, data: {}, ...over });
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

  it('pays wound closure by kind, ×1.5 cross-team, 0 for a drifted settle', () => {
    const s = score([
      charted,
      E('w1:opened', '2026-09-21T10:00:00Z', 'WOUND_OPENED', { data: { kind: 'beacon', rank: 'human-action' } }),
      E('w1:closed', '2026-09-21T11:00:00Z', 'WOUND_CLOSED', { contributor: 'pm', team: 'beaver', data: { kind: 'beacon', rank: 'human-action', verdict: 'agreed' } }),
      E('w2:opened', '2026-09-21T10:00:00Z', 'WOUND_OPENED', { data: { kind: 'unconfirmed-ground', rank: 'high' } }),
      E('w2:closed', '2026-09-21T11:00:00Z', 'WOUND_CLOSED', { contributor: 'eve', team: 'octopod', data: { kind: 'unconfirmed-ground', rank: 'high', verdict: 'agreed' } }),
      E('w3:opened', '2026-09-21T10:00:00Z', 'WOUND_OPENED', { data: { kind: 'unconfirmed-ground', rank: 'high' } }),
      E('w3:closed', '2026-09-21T11:00:00Z', 'WOUND_CLOSED', { contributor: 'pm', team: 'beaver', data: { kind: 'unconfirmed-ground', rank: 'high', verdict: 'drifted' } }),
    ], { season: '2026-09', now: NOW });
    expect(s.individuals).toEqual({ pm: 25, eve: 22.5 });
    expect(s.teams).toEqual({ beaver: 25, octopod: 22.5 });
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
    const t = (prd, at) => E(`planet:${prd}:terraformed`, at, 'PLANET_TERRAFORMED', { planet: prd, data: { ownerTeam: 'beaver', class: 1, crossSector: false } });
    const c = (prd) => E(`planet:${prd}:charted`, '2026-08-01T08:00:00Z', 'PLANET_CHARTED', { planet: prd, data: { ownerTeam: 'beaver' } });
    const s = score([
      c(1), c(2), c(3), c(4),
      t(1, '2026-08-20T10:00:00Z'), // previous season, still counts for the streak
      t(2, '2026-09-10T10:00:00Z'), // prior streak 1 → 110
      E('planet:3:lost', '2026-09-15T10:00:00Z', 'PLANET_LOST', { planet: 3, data: { ownerTeam: 'beaver', reason: 'closed' } }),
      t(4, '2026-09-20T10:00:00Z'), // prior streak 0 → 100
    ], { season: '2026-09', now: NOW });
    expect(s.teams).toEqual({ beaver: 210 });
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
    expect(s.planets[2332].lost).toBe(true);
  });

  it('ignores credits outside the season month', () => {
    const s = score([
      charted,
      E('z1:secured', '2026-08-21T12:00:00Z', 'ZONE_SECURED', { contributor: 'alice', team: 'octopod' }),
    ], { season: '2026-09', now: NOW });
    expect(s.individuals).toEqual({});
  });
});

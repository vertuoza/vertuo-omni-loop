import { describe, it, expect } from 'vitest';
import { buildGalaxy } from './galaxy.mjs';
import { demoEvents, DEMO_PROJECTS } from './demo.mjs';
import { makeEvent } from '../../../game/events.mjs';
import { RULEBOOK } from '../../../game/rulebook.mjs';

const NOW = new Date('2026-09-23T14:00:00Z');
const projects = { sectors: { core: { repos: ['core-repo'] }, ai: { repos: ['ai-repo'] } }, teams: { beaver: { home: 'core' }, octopod: { home: 'ai' } } };
const ev = (id, at, type, planet, extra = {}) => makeEvent({ id, at, type, planet, data: {}, ...extra });

const charted = ev('planet:7:charted', '2026-09-01T08:00:00Z', 'PLANET_CHARTED', 7, { data: { captain: 'pm', ownerTeam: 'beaver', title: 'Seven' } });

describe('buildGalaxy', () => {
  it('reads zones, wounds and fleets from the events alone', () => {
    const g = buildGalaxy([
      charted,
      ev('region:core-repo:7:surveyed', '2026-09-02T08:00:00Z', 'REGION_SURVEYED', 7, { region: 'core-repo' }),
      ev('region:ai-repo:7:surveyed', '2026-09-02T08:00:00Z', 'REGION_SURVEYED', 7, { region: 'ai-repo' }),
      ev('zone:core-repo:7:s1:opened', '2026-09-21T08:00:00Z', 'ZONE_OPENED', 7, { region: 'core-repo', data: { wave: 1 } }),
      ev('zone:core-repo:7:s1:claimed', '2026-09-21T09:00:00Z', 'ZONE_CLAIMED', 7, { region: 'core-repo', contributor: 'alice', team: 'octopod' }),
      ev('zone:core-repo:7:s1:secured', '2026-09-21T12:00:00Z', 'ZONE_SECURED', 7, { region: 'core-repo', contributor: 'alice', team: 'octopod' }),
      ev('zone:ai-repo:7:s2:opened', '2026-09-21T12:00:00Z', 'ZONE_OPENED', 7, { region: 'ai-repo', data: { wave: 2 } }),
      ev('zone:ai-repo:7:s2:claimed', '2026-09-23T13:00:00Z', 'ZONE_CLAIMED', 7, { region: 'ai-repo', contributor: 'bob', team: 'beaver' }),
      ev('fire:ai-repo:7/s2:opened', '2026-09-23T13:30:00Z', 'WOUND_OPENED', 7, { region: 'ai-repo', data: { kind: 'under-fire' } }),
      ev('outbox:core-repo:7/s1-01-x:opened', '2026-09-21T10:00:00Z', 'WOUND_OPENED', 7, { region: 'core-repo', data: { kind: 'beacon', rank: 'human-action' } }),
    ], { projects, now: NOW });
    const p = g.planets[0];
    expect(p).toMatchObject({ prd: 7, title: 'Seven', state: 'terraforming', class: 2, crossSector: true, secured: 1, progress: 0.5 });
    expect(p.zones.map((z) => [z.id, z.state, z.contributor])).toEqual([['s1', 'secured', 'alice'], ['s2', 'under-fire', 'bob']]);
    expect(p.openWounds.map((w) => w.kind)).toEqual(['beacon', 'under-fire']);
    expect(p.openWounds[0]).toMatchObject({ decayPerTranche: 5, ageTranches: 5 }) // 22 working hours: Mon 12–18, Tue, Wed 9–16 (Brussels);
    expect(p.expeditions).toEqual(['alice', 'bob']);
    expect(g.teams.map((t) => t.name)).toEqual(['octopod', 'beaver']);
  });

  it('orders the planet state as the spec does: lost beats terraformed, locked beats distress', () => {
    const lost = buildGalaxy([charted, ev('planet:7:lost', '2026-09-20T08:00:00Z', 'PLANET_LOST', 7, { data: { reason: 'closed' } })], { projects, now: NOW });
    expect(lost.planets[0].state).toBe('lost');
    const locked = buildGalaxy([
      charted,
      ev('planet:7:locked:6', '2026-09-02T08:00:00Z', 'PLANET_LOCKED', 7, { data: { blocker: 6 } }),
      ev('planet:7:distress:2026-09-10T08:00:00Z', '2026-09-11T08:00:00Z', 'DISTRESS', 7),
    ], { projects, now: NOW });
    expect(locked.planets[0]).toMatchObject({ state: 'locked', blockers: [6] });
    const rescued = buildGalaxy([
      charted,
      ev('zone:core-repo:7:s1:opened', '2026-09-10T08:00:00Z', 'ZONE_OPENED', 7, { region: 'core-repo', data: { wave: 1 } }),
      ev('planet:7:distress:2026-09-10T08:00:00Z', '2026-09-11T08:00:00Z', 'DISTRESS', 7),
      ev('planet:7:rescue:2026-09-10T08:00:00Z', '2026-09-12T08:00:00Z', 'RESCUE', 7, { contributor: 'alice', team: 'octopod' }),
    ], { projects, now: NOW });
    expect(rescued.planets[0]).toMatchObject({ state: 'terraforming', rescuers: [{ login: 'alice', team: 'octopod' }] });
  });

  it('builds the demo galaxy from the real projector with every planet state on show', () => {
    const now = new Date('2026-09-25T10:00:00Z');
    const g = buildGalaxy(demoEvents(now), { projects: DEMO_PROJECTS, now, source: 'demo' });
    expect(g.planets).toHaveLength(12);
    expect(new Set(g.planets.map((p) => p.state))).toEqual(new Set(['terraformed', 'aftershock', 'terraforming', 'lost', 'distress', 'awaiting-command', 'locked', 'charted']));
    expect(g.heroes.length).toBeGreaterThan(5);
    expect(g.teams).toHaveLength(5);
  });
});

describe('planets keyed by their home (PRD 728)', () => {
  const at = (home) => ({ home });
  const twin = (home, owner, who) => [
    ev(`planet:${home}#88:charted`, '2026-09-01T08:00:00Z', 'PLANET_CHARTED', 88, { ...at(home), data: { captain: who, ownerTeam: owner, title: `88 of ${home}` } }),
    ev(`region:${home}:${home}#88:surveyed`, '2026-09-02T08:00:00Z', 'REGION_SURVEYED', 88, { ...at(home), region: home }),
    ev(`zone:${home}:${home}#88:s1:opened`, '2026-09-21T08:00:00Z', 'ZONE_OPENED', 88, { ...at(home), region: home, data: { wave: 1 } }),
    ev(`zone:${home}:${home}#88:s1:secured`, '2026-09-21T12:00:00Z', 'ZONE_SECURED', 88, { ...at(home), region: home, contributor: who, team: owner }),
    ev(`fire:${home}:${home}#88/s2:opened`, '2026-09-22T12:00:00Z', 'WOUND_OPENED', 88, { ...at(home), region: home, data: { kind: 'under-fire' } }),
    ev(`zone:${home}:${home}#88:s2:claimed`, '2026-09-22T11:00:00Z', 'ZONE_CLAIMED', 88, { ...at(home), region: home, contributor: who, team: owner }),
  ];

  it('draws two repositories\' PRD 88 as two planets, each with its own zones, owner and points', () => {
    const g = buildGalaxy([...twin('acme/plan', 'beaver', 'bob'), ...twin('acme/tools', 'octopod', 'alice')], { projects, now: NOW });
    expect(g.planets.map((p) => [p.key, p.prd, p.home, p.ownerTeam, p.captain])).toEqual([
      ['acme/plan#88', 88, 'acme/plan', 'beaver', 'bob'],
      ['acme/tools#88', 88, 'acme/tools', 'octopod', 'alice'],
    ]);
    for (const p of g.planets) {
      expect(p.zones.map((z) => [z.id, z.region, z.state])).toEqual([['s1', p.home, 'secured'], ['s2', p.home, 'under-fire']]);
      expect(p.earned).toBe(10 - 6); // its own zone, less its own open fire's decay (2 tranches × 3)
    }
  });

  it('counts a repository that no sector names as a sector of its own', () => {
    const home = 'acme/plan';
    const g = buildGalaxy([
      ...twin(home, 'beaver', 'bob'),
      ev(`region:acme/core-repo:${home}#88:surveyed`, '2026-09-02T08:00:00Z', 'REGION_SURVEYED', 88, { home, region: 'acme/core-repo' }),
    ], { projects, now: NOW });
    expect(g.planets[0]).toMatchObject({ sectors: ['core'], sector: 'core', crossSector: true, class: 2 });
  });
});

describe('the rules the view carries', () => {
  it('carries the rulebook\'s xp block, so How to play shows the XP rules the ledger job applies', () => {
    const g = buildGalaxy([charted], { projects, now: NOW });
    expect(g.rules.xp).toBe(RULEBOOK.xp);
    expect(g.rules.xp).toEqual({
      weights: { zoneSecured: 1, woundClosed: 1, rescue: 1, expedition: 1, closer: 1 },
      curve: { first: 1, step: 25 },
      cap: 99,
      unlocks: { invaders: 1, platformer: 2 },
    });
  });

  it('keeps the xp block whole when the view is sent to the browser as JSON', () => {
    const g = buildGalaxy(demoEvents(NOW), { projects: DEMO_PROJECTS, now: NOW, source: 'demo' });
    expect(JSON.parse(JSON.stringify(g)).rules.xp).toEqual(RULEBOOK.xp);
  });
});

describe('fleets', () => {
  it('gives a fleet without a look a plain one, so a new row still plays', () => {
    const g = buildGalaxy([charted], { projects, now: NOW });
    expect(g.teams.find((t) => t.name === 'beaver')).toMatchObject({
      label: 'BEAVER', color: '#cfd4e6', motto: '', mascot: null, sort: 0, retired: false, home: 'core',
    });
  });

  it('keeps a retired fleet only while the season still remembers it', () => {
    const withRetired = { ...projects, teams: { ...projects.teams, ghosts: { home: null, label: 'GHOSTS', retired: true } } };
    expect(buildGalaxy([charted], { projects: withRetired, now: NOW }).teams.map((t) => t.name)).not.toContain('ghosts');
    const secured = ev('zone:core-repo:7:s1:secured', '2026-09-21T12:00:00Z', 'ZONE_SECURED', 7, { region: 'core-repo', contributor: 'casper', team: 'ghosts' });
    const g = buildGalaxy([charted, secured], { projects: withRetired, now: NOW });
    expect(g.teams.find((t) => t.name === 'ghosts')).toMatchObject({ label: 'GHOSTS', retired: true, members: ['casper'] });
    expect(g.sectors.flatMap((s) => s.fleets)).not.toContain('ghosts');
  });

  it('flies invented fleets in the demo galaxy, none of them Vertuoza\'s, and retires one', () => {
    const g = buildGalaxy(demoEvents(NOW), { projects: DEMO_PROJECTS, now: NOW });
    expect(g.teams.map((t) => t.name).sort()).toEqual(['builders', 'coiners', 'corsairs', 'inklings', 'night-owls']);
    expect(g.teams.find((t) => t.name === 'corsairs')).toMatchObject({ label: 'CORSAIRS', mascot: 'pirate', color: '#35b89a' });
    expect(g.teams.find((t) => t.name === 'night-owls')).toMatchObject({ mascot: null });
    expect(DEMO_PROJECTS.teams.capes.retired).toBe(true);
    const vertuoza = ['beaver', 'octopod', 'picsou', 'cia', 'pirates', 'invincible-team'];
    for (const name of Object.keys(DEMO_PROJECTS.teams)) expect(vertuoza).not.toContain(name);
  });

});

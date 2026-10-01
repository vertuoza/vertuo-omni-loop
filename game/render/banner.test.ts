// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { renderBanner } from './banner.ts';

const NOW = new Date('2026-09-23T14:00:00Z');
const planet = {
  prd: 2332, title: 'Generic Import Engine', captain: 'pm', ownerTeam: 'beaver', state: 'distress',
  regions: ['core-repo', 'ai-repo'], class: 2, crossSector: true, threat: 3, distressSince: '2026-09-22T11:00:00Z',
  zones: [
    { id: 's1', repo: 'core-repo', wave: 1, state: 'secured', author: 'alice' },
    { id: 's2', repo: 'core-repo', wave: 2, state: 'open', author: null },
    { id: 's3', repo: 'ai-repo', wave: 1, state: 'claimed', author: 'bob' },
  ],
  wounds: [
    { id: 'a', kind: 'unconfirmed-ground', repo: 'core-repo', openedAt: '2026-09-22T10:00:00Z', closedAt: null },
    { id: 'b', kind: 'transmission', repo: 'core-repo', openedAt: '2026-09-23T12:00:00Z', closedAt: null },
    { id: 'c', kind: 'beacon', repo: 'core-repo', openedAt: '2026-09-20T10:00:00Z', closedAt: '2026-09-21T10:00:00Z' },
  ],
};
const season = { individuals: { alice: 60 }, teams: { beaver: 10, octopod: 60 }, planets: {}, streaks: { beaver: 2 }, credits: [] };

describe('renderBanner', () => {
  it('prints the planet block', () => {
    expect(renderBanner(planet, { season, now: NOW })).toBe([
      'OMNI PLAN // PLANET 2332 — Generic Import Engine',
      'Class II ★ cross-sector · Threat III · 📡 DISTRESS · phase 1/2 · zones 1/3 secured (core-repo 1/2 · ai-repo 0/1)',
      // 🟧 opened Tue 12:00 local → Wed 16:00 local = 6h + 7h; 📡 opened Wed 14:00 local → 16:00
      'Wounds: 1 🟧 (13h) · 1 📡 (2h)',
      'Captain: @pm · Crew: beaver 🔥2 · Expeditions: 2 (alice, bob) · Rescuers: 0',
      'Open zones: s2 (core-repo, phase 2)',
    ].join('\n'));
  });

  it('counts rescuers from rescue credits and cross-team wound closures, and names their teams (F5b)', () => {
    const withRescues = { ...season, credits: [
      { to: 'eve', team: 'octopod', planet: 2332, points: 22.5, reason: 'wound closed: unconfirmed-ground', crossTeam: true },
      { to: 'bob', team: 'cia', planet: 2332, points: 20, reason: 'rescue' },
      { to: 'eve', team: 'octopod', planet: 2332, points: 20, reason: 'rescue' },
      { to: 'pm', team: 'beaver', planet: 2332, points: 25, reason: 'wound closed: beacon' },
      { to: 'zed', team: 'picsou', planet: 9999, points: 20, reason: 'rescue' },
    ] };
    expect(renderBanner(planet, { season: withRescues, now: NOW }).split('\n')[3]).toBe('Captain: @pm · Crew: beaver 🔥2 · Expeditions: 2 (alice, bob) · Rescuers: 2 (octopod, cia)');
  });

  it('flags a planet uncrewed when the captain has no owning team (spec §8)', () => {
    const uncrewedPlanet = {
      prd: 4100, title: 'Solo Prototype', captain: 'freelancer', ownerTeam: null, state: 'charted',
      regions: [], class: 1, crossSector: false, threat: 1,
      zones: [], wounds: [],
    };
    const uncrewedSeason = { individuals: {}, teams: {}, planets: {}, streaks: {}, credits: [] };
    expect(renderBanner(uncrewedPlanet, { season: uncrewedSeason, now: NOW })).toBe([
      'OMNI PLAN // PLANET 4100 — Solo Prototype',
      'Class I · Threat I · 🪐 CHARTED · phase 0/0 · zones 0/0 secured',
      'Wounds: none',
      'Captain: @freelancer · Crew: none (uncrewed) · Expeditions: 0 · Rescuers: 0',
      'Open zones: none',
    ].join('\n'));
  });
});

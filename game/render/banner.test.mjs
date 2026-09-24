import { describe, it, expect } from 'vitest';
import { renderBanner } from './banner.mjs';

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
});

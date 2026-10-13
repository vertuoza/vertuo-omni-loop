import { describe, expect, it, vi } from 'vitest';
import { buildGalaxy, demoEvents, DEMO_PROJECTS, type GalaxyView, type LogLine, type Planet } from '@omni/galaxy';
import { present } from '../ask/test/test-item';
import type { PlanetDossier } from '../arcade/types';
import { PlanetDetailsSchema } from './planet.contract';
import type { PlanetRepository } from './planet.repository';
import { planetService } from './planet.service';

vi.mock('server-only', () => ({}));

// One planet's details' rules (PRD 1808), on a fake repository over the demo world's galaxy: the planet
// found by its key in the person's workspace, its last 8 log lines, its dossier as the DOSSIER tab finds
// it, and what a failed read gives.

const NOW = new Date('2026-09-27T10:00:00Z');
const WORKSPACE = 'w-vertuoza';
const DOSSIER: PlanetDossier = { id: 'd-1', url: '/prd/d-1', latest: { 'before-after': null, spec: null, plan: null }, asked: 1, answered: 1, last: [] };

const line = (n: number): LogLine => ({ at: `2026-09-${String(n).padStart(2, '0')}T10:00:00Z`, type: 'zone', planet: 12, text: `line ${n}`, contributor: null, team: null });

/** The demo galaxy, its first planet given a home and a log of `lines` lines. */
function galaxy(lines = 12): { view: GalaxyView; planet: Planet } {
  const view = buildGalaxy(demoEvents(NOW), { projects: DEMO_PROJECTS, now: NOW, source: 'demo' });
  const first = present(view.planets[0], 'a demo planet');
  const planet: Planet = { ...first, home: 'vertuoza/vertuo-omni-loop', key: `vertuoza/vertuo-omni-loop#${first.prd}`, log: Array.from({ length: lines }, (_, i) => line(lines - i)) };
  return { view: { ...view, planets: [planet, ...view.planets.slice(1)] }, planet };
}

function service(over: Partial<PlanetRepository> = {}, view = galaxy().view) {
  const calls: string[] = [];
  const repo: PlanetRepository = {
    workspace: () => { calls.push('workspace'); return Promise.resolve(WORKSPACE); },
    galaxy: (w) => { calls.push(`galaxy ${w}`); return Promise.resolve(view); },
    dossier: (w, prd) => { calls.push(`dossier ${w} ${prd}`); return Promise.resolve(DOSSIER); },
    ...over,
  };
  return { s: planetService(repo), calls };
}

describe('planetService.details', () => {
  it('answers the planet\'s dossier and the last 8 lines of its log, newest first, in the contract\'s shape', async () => {
    const { planet } = galaxy();
    const { s, calls } = service();
    const read = await s.details(planet.key);
    expect(read).toEqual({ ok: true, value: { dossier: DOSSIER, log: planet.log.slice(0, 8) } });
    expect(read.ok && read.value.log.map((l) => l.text)).toEqual(['line 12', 'line 11', 'line 10', 'line 9', 'line 8', 'line 7', 'line 6', 'line 5']);
    expect(read.ok && PlanetDetailsSchema.parse(read.value)).toBeTruthy();
    expect(calls).toEqual(['workspace', `galaxy ${WORKSPACE}`, `dossier ${WORKSPACE} ${planet.prd}`]);
  });

  it('finds a planet whose key holds a slash and a hash, whole', async () => {
    const { planet } = galaxy(3);
    const { s } = service({}, galaxy(3).view);
    expect(planet.key).toMatch(/\/.*#/);
    expect(await s.details(planet.key)).toMatchObject({ ok: true, value: { log: planet.log } });
  });

  it('passes on none and unreadable as the dossier read gives them', async () => {
    const { planet } = galaxy();
    expect(await service({ dossier: () => Promise.resolve('none') }).s.details(planet.key)).toMatchObject({ ok: true, value: { dossier: 'none' } });
    expect(await service({ dossier: () => Promise.resolve('unreadable') }).s.details(planet.key)).toMatchObject({ ok: true, value: { dossier: 'unreadable', log: planet.log.slice(0, 8) } });
  });

  it('gives no dossier, and reads none, for a number two planets of the galaxy share (two repositories\' PRD 88)', async () => {
    const { view, planet } = galaxy();
    const twin: Planet = { ...planet, home: 'vertuoza/vertuo-core', key: `vertuoza/vertuo-core#${planet.prd}` };
    const { s, calls } = service({}, { ...view, planets: [...view.planets, twin] });
    expect(await s.details(planet.key)).toMatchObject({ ok: true, value: { dossier: 'none' } });
    expect(calls.some((c) => c.startsWith('dossier'))).toBe(false);
  });

  it('is missing for a planet not in the person\'s galaxy, and for a person in no workspace', async () => {
    const { s, calls } = service();
    expect(await s.details('acme/acme-plan#12')).toMatchObject({ ok: false, kind: 'missing' });
    expect(calls.some((c) => c.startsWith('dossier'))).toBe(false);
    const none = service({ workspace: () => Promise.resolve(null) });
    expect(await none.s.details(galaxy().planet.key)).toMatchObject({ ok: false, kind: 'missing' });
    expect(none.calls).toEqual([]);
  });

  it('fails, with what was thrown, when the workspace or the galaxy cannot be read', async () => {
    const boom = new Error('fake: ledger_events is out of reach');
    const key = galaxy().planet.key;
    expect(await service({ galaxy: () => Promise.reject(boom) }).s.details(key)).toEqual({ ok: false, kind: 'database', error: expect.any(String), cause: boom });
    expect(await service({ workspace: () => Promise.reject(boom) }).s.details(key)).toMatchObject({ ok: false, kind: 'database', cause: boom });
  });
});

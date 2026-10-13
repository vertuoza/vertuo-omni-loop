import { describe, expect, it, vi } from 'vitest';
import type { GalaxyView, LogLine, Planet } from '@omni/galaxy';
import type { PlanetDetails } from '../arcade-api/planet.contract';
import { fetchPlanetDetails } from './planet-details.client';
import { DETAILS_LOADING, fetchedDetails, overlayDetails, pageDetails, shownDetails, type DetailsRead } from './planet-details';
import type { PlanetDossier } from './types';

// One planet's details in the game (PRD 1808, s3): read when the planet is opened, kept for the
// session, shared while in flight, never kept when they failed, and read from the page in the demo.

const line = (n: number): LogLine => ({ at: `2026-10-0${String(n % 9 + 1)}T10:00:00Z`, type: 'ZONE_SECURED', planet: 12, text: `line ${String(n)}`, contributor: null, team: null });

const DOSSIER: PlanetDossier = {
  id: 'd-12', url: '/prd/d-12', latest: { 'before-after': null, spec: { version: 1, at: '2026-10-01T10:00:00Z' }, plan: null },
  asked: 1, answered: 1, last: [],
};

const DETAILS: PlanetDetails = { dossier: DOSSIER, log: [line(1), line(2)] };

/** A load whose answers the test settles by hand, one per call, in order. */
function deferredLoad() {
  const calls: { key: string; resolve: (d: PlanetDetails) => void; reject: (e: unknown) => void }[] = [];
  const load = vi.fn((key: string) => new Promise<PlanetDetails>((resolve, reject) => { calls.push({ key, resolve, reject }); }));
  return { load, calls };
}

const settle = () => new Promise((r) => { setTimeout(r, 0); });

describe('fetchedDetails', () => {
  it('reads a planet when it is opened, and says loading until its answer arrives', async () => {
    const { load, calls } = deferredLoad();
    const source = fetchedDetails(load);
    expect(source.read('acme/plan#12')).toBeUndefined();
    source.open('acme/plan#12');
    expect(load).toHaveBeenCalledWith('acme/plan#12');
    expect(source.read('acme/plan#12')).toEqual({ status: 'loading' });
    calls[0]?.resolve(DETAILS);
    await settle();
    expect(source.read('acme/plan#12')).toEqual({ status: 'loaded', details: DETAILS });
  });

  it('fetches a planet opened twice once: the second open shares the read in flight, and a third reads the kept answer', async () => {
    const { load, calls } = deferredLoad();
    const source = fetchedDetails(load);
    source.open('acme/plan#12');
    source.open('acme/plan#12');
    expect(load).toHaveBeenCalledOnce();
    calls[0]?.resolve(DETAILS);
    await settle();
    source.open('acme/plan#12');
    expect(load).toHaveBeenCalledOnce();
  });

  it('keeps no failure: the planet reads out of reach, and the next open asks again', async () => {
    const { load, calls } = deferredLoad();
    const source = fetchedDetails(load);
    source.open('acme/plan#12');
    calls[0]?.reject(new Error('500'));
    await settle();
    expect(source.read('acme/plan#12')).toEqual({ status: 'unreadable' });
    source.open('acme/plan#12');
    expect(load).toHaveBeenCalledTimes(2);
    expect(source.read('acme/plan#12')).toEqual({ status: 'loading' });
    calls[1]?.resolve(DETAILS);
    await settle();
    expect(source.read('acme/plan#12')).toEqual({ status: 'loaded', details: DETAILS });
  });

  it('keeps one answer per planet: an answer for another planet never shows on the one selected', async () => {
    const { load, calls } = deferredLoad();
    const source = fetchedDetails(load);
    source.open('acme/plan#12');
    source.open('acme/plan#13');
    calls[0]?.resolve(DETAILS);
    await settle();
    expect(shownDetails(source, 'acme/plan#13')).toEqual({ status: 'loading' });
    expect(shownDetails(source, 'acme/plan#12')).toEqual({ status: 'loaded', details: DETAILS });
  });

  it('draws nothing for an answer arriving after the overlay closed, and shows it at once when the planet opens again', async () => {
    const { load, calls } = deferredLoad();
    const source = fetchedDetails(load);
    const heard = vi.fn();
    source.subscribe(heard);
    source.open('acme/plan#12');
    calls[0]?.resolve(DETAILS);
    await settle();
    expect(shownDetails(source, null)).toBeNull();
    expect(heard).toHaveBeenCalled();
    source.open('acme/plan#12');
    expect(load).toHaveBeenCalledOnce();
    expect(shownDetails(source, 'acme/plan#12')).toEqual({ status: 'loaded', details: DETAILS });
  });

  it('gives the same answer object while nothing changes, as React reads a store', async () => {
    const { load, calls } = deferredLoad();
    const source = fetchedDetails(load);
    expect(shownDetails(source, 'acme/plan#12')).toBe(DETAILS_LOADING);
    source.open('acme/plan#12');
    calls[0]?.resolve(DETAILS);
    await settle();
    expect(source.read('acme/plan#12')).toBe(source.read('acme/plan#12'));
  });

  it('stops telling a listener once it unsubscribed', async () => {
    const { load, calls } = deferredLoad();
    const source = fetchedDetails(load);
    const heard = vi.fn();
    source.subscribe(heard)();
    source.open('acme/plan#12');
    calls[0]?.resolve(DETAILS);
    await settle();
    expect(heard).not.toHaveBeenCalled();
  });
});

describe('pageDetails (the demo, the single-file artifact)', () => {
  const planet = (prd: number, key: string, log: LogLine[]): Planet => ({ prd, key, home: key.split('#')[0] ?? null, log } as unknown as Planet);
  const view = { planets: [planet(12, 'acme/plan#12', Array.from({ length: 10 }, (_, i) => line(i))), planet(13, 'acme/plan#13', [])] } as unknown as GalaxyView;

  it('reads each planet from the page, never a fetch: its dossier and the last 8 lines of its log', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const source = pageDetails(view, { 12: DOSSIER });
    source.open('acme/plan#12');
    const read: DetailsRead | undefined = source.read('acme/plan#12');
    expect(read).toEqual({ status: 'loaded', details: { dossier: DOSSIER, log: Array.from({ length: 8 }, (_, i) => line(i)) } });
    expect(source.read('acme/plan#13')).toEqual({ status: 'loaded', details: { dossier: 'none', log: [] } });
    expect(source.read('acme/plan#12')).toBe(source.read('acme/plan#12'));
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('says the dossier is out of reach when the page says so', () => {
    const read = pageDetails(view, 'unreadable').read('acme/plan#12');
    expect(read?.status === 'loaded' && read.details.dossier).toBe('unreadable');
  });

  it('knows no planet the page does not hold', () => {
    expect(pageDetails(view, {}).read('acme/plan#99')).toEqual({ status: 'unreadable' });
  });
});

describe('overlayDetails', () => {
  it('gives the DOSSIER and LOG tabs LOADING… on the way, their content once read, and out of reach when the read failed', () => {
    expect(overlayDetails(null)).toEqual({ dossier: 'loading', log: 'loading' });
    expect(overlayDetails(DETAILS_LOADING)).toEqual({ dossier: 'loading', log: 'loading' });
    expect(overlayDetails({ status: 'unreadable' })).toEqual({ dossier: 'unreadable', log: 'unreadable' });
    expect(overlayDetails({ status: 'loaded', details: DETAILS })).toEqual({ dossier: DOSSIER, log: DETAILS.log });
    expect(overlayDetails({ status: 'loaded', details: { dossier: 'unreadable', log: DETAILS.log } })).toEqual({ dossier: 'unreadable', log: DETAILS.log });
  });
});

describe('fetchPlanetDetails', () => {
  const answer = (status: number, body: unknown) => Promise.resolve(Response.json(body, { status }));

  it('asks the planet\'s route, its key one segment, and parses the answer', async () => {
    const fetcher = vi.fn((_url: string, _init: RequestInit) => answer(200, DETAILS));
    expect(await fetchPlanetDetails('vertuoza/vertuo-omni-loop#12', fetcher)).toEqual(DETAILS);
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/arcade/planets/vertuoza%2Fvertuo-omni-loop%2312');
  });

  it('throws on a refusal or an answer of another shape', async () => {
    await expect(fetchPlanetDetails('a#1', () => answer(500, { error: 'no' }))).rejects.toThrow(/500/);
    await expect(fetchPlanetDetails('a#1', () => answer(404, { error: 'no' }))).rejects.toThrow(/404/);
    await expect(fetchPlanetDetails('a#1', () => answer(200, { dossier: 'none' }))).rejects.toThrow();
  });
});

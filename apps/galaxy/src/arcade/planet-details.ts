import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { GalaxyView } from '@omni/galaxy';
import { PLANET_LOG_LINES, type PlanetDetails } from '../arcade-api/planet.contract';
import { dossierOf, type DossierShown, type LogShown } from './scenes/planet.tsx';
import { fetchPlanetDetails } from './planet-details.client';
import type { Account, DossiersRead } from './types';

// One planet's details in the game (PRD 1808, s3): its dossier and the last lines of its log, which /play
// no longer sends. They are read when the planet is opened, never before (no prefetch), and kept for the
// session, one entry per planet key: the same planet opened twice is read once, and an open while a read
// is on its way shares it. A failed read is not kept: the planet reads out of reach, and its next open
// asks again. The overlay shows the selected planet's entry only, so an answer for another planet, or
// one arriving after the overlay closed, draws nothing.
//
// The demo and the single-file artifact have no database: their details are in the page (the demo
// dossiers and the planets' own logs), read without a fetch.

/** Where one planet's details stand. */
export type DetailsRead = { status: 'loading' } | { status: 'loaded'; details: PlanetDetails } | { status: 'unreadable' };

/** Read before its first open settles: one object, so React sees no change. */
export const DETAILS_LOADING: DetailsRead = { status: 'loading' };
const UNREADABLE: DetailsRead = { status: 'unreadable' };

/** Where the game's planet details come from: a store React reads. */
export interface DetailsSource {
  /** The planet's details as they stand, or undefined before its first open. The same object while nothing changes. */
  read: (key: string) => DetailsRead | undefined;
  /** The planet was opened: read it unless it is read or on its way. */
  open: (key: string) => void;
  /** Hears every change; returns the call that stops it. */
  subscribe: (listener: () => void) => () => void;
}

/** The details read from `/api/arcade/planets/<key>` through `load`, kept for the session. */
export function fetchedDetails(load: (key: string) => Promise<PlanetDetails>): DetailsSource {
  const entries = new Map<string, DetailsRead>();
  const listeners = new Set<() => void>();
  const set = (key: string, read: DetailsRead) => {
    entries.set(key, read);
    for (const listener of listeners) listener();
  };
  return {
    read: (key) => entries.get(key),
    open(key) {
      const status = entries.get(key)?.status;
      if (status === 'loading' || status === 'loaded') return;
      set(key, DETAILS_LOADING);
      load(key).then((details) => { set(key, { status: 'loaded', details }); }, () => { set(key, UNREADABLE); });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

/** The details the page holds (the demo, the artifact): each planet's dossier and its log, never fetched. */
export function pageDetails(view: GalaxyView | null, dossiers: DossiersRead | undefined): DetailsSource {
  const entries = new Map<string, DetailsRead>();
  return {
    read(key) {
      const kept = entries.get(key);
      if (kept) return kept;
      const planet = view?.planets.find((p) => p.key === key);
      const read: DetailsRead = planet
        ? { status: 'loaded', details: { dossier: dossierOf(dossiers, planet, view?.planets), log: planet.log.slice(0, PLANET_LOG_LINES) } }
        : UNREADABLE;
      entries.set(key, read);
      return read;
    },
    open: () => {},
    subscribe: () => () => {},
  };
}

/** What the overlay shows for the planet keyed `key`: null with no planet open. */
export const shownDetails = (source: DetailsSource, key: string | null): DetailsRead | null =>
  key === null ? null : source.read(key) ?? DETAILS_LOADING;

/** The open planet's details, read on its open: null while no planet is open. */
function usePlanetDetails(key: string | null, source: DetailsSource): DetailsRead | null {
  useEffect(() => { if (key !== null) source.open(key); }, [key, source]);
  const snapshot = () => shownDetails(source, key);
  return useSyncExternalStore(source.subscribe, snapshot, snapshot);
}

/** What the overlay's DOSSIER and LOG tabs show of a planet's details as they stand. */
export function overlayDetails(read: DetailsRead | null): { dossier: DossierShown | 'loading'; log: LogShown } {
  if (read === null || read.status === 'loading') return { dossier: 'loading', log: 'loading' };
  if (read.status === 'unreadable') return { dossier: 'unreadable', log: 'unreadable' };
  return { dossier: read.details.dossier, log: read.details.log };
}

/**
 * The DOSSIER and LOG tabs of the planet the game shows (PRD 1808): the planet selected while the planet
 * scene is up, a deep link's included, read on its open. A Supabase account reads it from
 * /api/arcade/planets/<key>, kept for the session; the demo and the artifact from the page.
 */
export function useOpenPlanetDetails(view: GalaxyView | null, dossiers: DossiersRead | undefined, ui: { scene: string; sel: number }, account: Account['kind']) {
  const fetched = useMemo(() => fetchedDetails((key) => fetchPlanetDetails(key)), []);
  const fromPage = useMemo(() => pageDetails(view, dossiers), [view, dossiers]);
  const key = ui.scene === 'planet' ? view?.planets[ui.sel]?.key ?? null : null;
  return overlayDetails(usePlanetDetails(key, account === 'supabase' ? fetched : fromPage));
}

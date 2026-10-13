import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { KnowledgeGraph } from '../data/knowledge';
import { fetchChart } from './chart-source.client';
import type { ChartShown, ChartSource, MenuChart } from './scenes/chart-layout.ts';

// The star chart in the game (PRD 1808, s4): /play no longer sends the crew the knowledge graph. The game
// reads it from /api/arcade/chart when the chart opens, never before, and keeps it for the session: an
// open while the read is on its way shares it. A failed read is not kept: the chart reads out of reach,
// and its next open asks again. Until the chart has been read, the menu's STAR CHART row shows no tally
// (the menu never reads the chart itself) and its door opens on the chart's LOADING….
//
// The demo keeps its chart in the page, and a page that holds none (a build without a knowledge base,
// anyone past the crew's gate) says so as before: neither ever fetches.

/**
 * The chart a page hands the arcade: the chart itself, 'none' or null as the page holds it, or 'fetch'
 * for the crew's, read from /api/arcade/chart when the chart opens.
 */
export type ArcadeChart = ChartSource | 'fetch';

/** Where the crew's chart stands. */
export type ChartRead = { status: 'loading' } | { status: 'loaded'; chart: KnowledgeGraph | 'none' } | { status: 'unreadable' };

const LOADING: ChartRead = { status: 'loading' };
const UNREADABLE: ChartRead = { status: 'unreadable' };

/** Where the game's chart comes from: a store React reads. */
export interface ChartStore {
  /** The chart as it stands, or undefined before its first open. The same object while nothing changes. */
  read: () => ChartRead | undefined;
  /** The chart was opened: read it unless it is read or on its way. */
  open: () => void;
  /** Hears every change; returns the call that stops it. */
  subscribe: (listener: () => void) => () => void;
}

/** The chart read through `load`, kept for the session. */
export function fetchedChart(load: () => Promise<KnowledgeGraph | 'none'>): ChartStore {
  let entry: ChartRead | undefined;
  const listeners = new Set<() => void>();
  const set = (read: ChartRead) => {
    entry = read;
    for (const listener of listeners) listener();
  };
  return {
    read: () => entry,
    open() {
      if (entry?.status === 'loading' || entry?.status === 'loaded') return;
      set(LOADING);
      load().then((chart) => { set({ status: 'loaded', chart }); }, () => { set(UNREADABLE); });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

/** What each screen sees of the chart: the canvas and the system (`source`), the chart's text (`shown`), the menu's row (`menu`). */
export interface ChartAt { source: ChartSource; shown: ChartShown; menu: MenuChart }

/** What the screens see of the page's chart, the crew's as it stands. */
export function chartAt(held: ArcadeChart, read: ChartRead | undefined): ChartAt {
  if (held !== 'fetch') return { source: held, shown: held, menu: held };
  if (read?.status === 'loaded') return { source: read.chart, shown: read.chart, menu: read.chart };
  return { source: null, shown: read?.status === 'unreadable' ? null : 'loading', menu: 'unread' };
}

/** The scenes that show the chart: on either, the crew's chart is read. */
const CHART_SCENES: readonly string[] = ['chart', 'system'];

/**
 * The star chart the game shows (PRD 1808): the page's own, or the crew's, read from /api/arcade/chart
 * when the scene on screen shows it (the chart or one of its systems), kept for the session. `graph` is
 * the graph the canvas lays out, when there is one.
 */
export function useChart(held: ArcadeChart, scene: string): ChartAt & { graph: KnowledgeGraph | null } {
  const store = useMemo(() => fetchedChart(() => fetchChart()), []);
  const fetches = held === 'fetch' && CHART_SCENES.includes(scene);
  useEffect(() => { if (fetches) store.open(); }, [fetches, store]);
  const read = useSyncExternalStore(store.subscribe, store.read, store.read);
  return useMemo(() => {
    const at = chartAt(held, read);
    return { ...at, graph: at.source === 'none' ? null : at.source };
  }, [held, read]);
}

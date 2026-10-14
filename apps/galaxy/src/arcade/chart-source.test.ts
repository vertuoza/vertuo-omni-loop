import { describe, expect, it, vi } from 'vitest';
import type { KnowledgeGraph } from '../data/knowledge';
import { CHART_PATH, fetchChart, type Fetch } from './chart-source.client';
import { chartAt, fetchedChart } from './chart-source';

// The star chart in the game (PRD 1808, s4): /play sends the crew no chart; the game reads it from
// /api/arcade/chart when the chart opens, once per session, shares a read in flight, keeps no failure,
// and never fetches in the demo, whose chart is in the page.

const GRAPH: KnowledgeGraph = {
  version: 1, repo: 'acme/widgets',
  domains: [{ name: 'product', code: 'PRODUCT', scope: 'product', counts: { principles: 1, rules: 0, invariants: 0, laws: 0, proposed: 1 } }],
  entries: [], links: [], loose: [], unserved: [],
};

/** A load whose answers the test settles by hand, one per call, in order. */
function deferredLoad() {
  const calls: { resolve: (c: KnowledgeGraph | 'none') => void; reject: (e: unknown) => void }[] = [];
  const load = vi.fn(() => new Promise<KnowledgeGraph | 'none'>((resolve, reject) => { calls.push({ resolve, reject }); }));
  return { load, calls };
}

const settle = () => new Promise((r) => { setTimeout(r, 0); });

describe('fetchedChart', () => {
  it('reads the chart when it is opened, and says loading until its answer arrives', async () => {
    const { load, calls } = deferredLoad();
    const store = fetchedChart(load);
    expect(store.read()).toBeUndefined();
    expect(load).not.toHaveBeenCalled();
    store.open();
    expect(store.read()).toEqual({ status: 'loading' });
    calls[0]?.resolve(GRAPH);
    await settle();
    expect(store.read()).toEqual({ status: 'loaded', chart: GRAPH });
  });

  it('reads the chart once per session: an open in flight shares the read, a later open keeps the answer', async () => {
    const { load, calls } = deferredLoad();
    const store = fetchedChart(load);
    store.open();
    store.open();
    expect(load).toHaveBeenCalledOnce();
    calls[0]?.resolve(GRAPH);
    await settle();
    store.open();
    expect(load).toHaveBeenCalledOnce();
  });

  it('keeps no failure: the chart reads out of reach, and the next open asks again', async () => {
    const { load, calls } = deferredLoad();
    const store = fetchedChart(load);
    store.open();
    calls[0]?.reject(new Error('500'));
    await settle();
    expect(store.read()).toEqual({ status: 'unreadable' });
    store.open();
    expect(load).toHaveBeenCalledTimes(2);
    expect(store.read()).toEqual({ status: 'loading' });
  });

  it('tells its listeners of each change, until they stop listening', async () => {
    const { load, calls } = deferredLoad();
    const store = fetchedChart(load);
    const heard = vi.fn();
    const stop = store.subscribe(heard);
    store.open();
    expect(heard).toHaveBeenCalledOnce();
    stop();
    calls[0]?.resolve('none');
    await settle();
    expect(heard).toHaveBeenCalledOnce();
    expect(store.read()).toEqual({ status: 'loaded', chart: 'none' });
  });
});

describe('chartAt: what the chart, its canvas and the menu see', () => {
  it('passes a chart the page holds through untouched: the demo\'s, a build without one, nobody\'s', () => {
    for (const held of [GRAPH, 'none', null] as const) {
      expect(chartAt(held, undefined)).toEqual({ source: held, shown: held, menu: held });
      expect(chartAt(held, { status: 'unreadable' })).toEqual({ source: held, shown: held, menu: held });
    }
  });

  it('shows LOADING on the chart and no tally on the menu while the crew\'s chart is unread or on its way', () => {
    expect(chartAt('fetch', undefined)).toEqual({ source: null, shown: 'loading', menu: 'unread' });
    expect(chartAt('fetch', { status: 'loading' })).toEqual({ source: null, shown: 'loading', menu: 'unread' });
  });

  it('shows the chart everywhere once it is read', () => {
    expect(chartAt('fetch', { status: 'loaded', chart: GRAPH })).toEqual({ source: GRAPH, shown: GRAPH, menu: GRAPH });
    expect(chartAt('fetch', { status: 'loaded', chart: 'none' })).toEqual({ source: 'none', shown: 'none', menu: 'none' });
  });

  it('says the chart is out of reach when its read failed, and keeps its door open on the menu to ask again', () => {
    expect(chartAt('fetch', { status: 'unreadable' })).toEqual({ source: null, shown: null, menu: 'unread' });
  });
});

describe('fetchChart', () => {
  const answer = (status: number, body: unknown): Fetch => vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status })));

  it('reads /api/arcade/chart with the sign-in cookie', async () => {
    const fetcher = answer(200, { chart: GRAPH });
    await expect(fetchChart(fetcher)).resolves.toEqual(GRAPH);
    expect(fetcher).toHaveBeenCalledWith(CHART_PATH, expect.objectContaining({ credentials: 'same-origin' }));
    expect(CHART_PATH).toBe('/api/arcade/chart');
  });

  it('reads a build without a chart as none', async () => {
    await expect(fetchChart(answer(200, { chart: 'none' }))).resolves.toBe('none');
  });

  it.each([401, 403, 500])('throws on a %i refusal', async (status) => {
    await expect(fetchChart(answer(status, { error: 'no' }))).rejects.toThrow(String(status));
  });

  it('throws on an answer of another shape', async () => {
    await expect(fetchChart(answer(200, { chart: { version: 2 } }))).rejects.toThrow();
    await expect(fetchChart(answer(200, ['nope']))).rejects.toThrow();
  });
});

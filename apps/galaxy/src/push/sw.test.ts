import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import manifest from '../../app/manifest';

// The installable page (PRD 1322 s9): the web manifest, and the service worker at /sw.js run in a
// sandbox with a fake `self`: a push shows one notification from its JSON, a push it cannot read still
// shows one, a url off this site is never opened, and a tap focuses the tab already on the url or
// opens it.

const ORIGIN = 'https://omni.example';
const SOURCE = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8');

type Listener = (event: Record<string, unknown>) => void;

function worker(tabs: Array<{ url: string }> = []) {
  const listeners = new Map<string, Listener>();
  const shown: Array<{ title: string; options: unknown }> = [];
  const opened: string[] = [];
  const focused: string[] = [];
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, listener: Listener) => { listeners.set(type, listener); },
    registration: { showNotification: (title: string, options: unknown) => { shown.push({ title, options }); return Promise.resolve(); } },
    clients: {
      matchAll: () => Promise.resolve(tabs.map((tab) => ({ url: tab.url, focus: () => { focused.push(tab.url); return Promise.resolve(); } }))),
      openWindow: (url: string) => { opened.push(url); return Promise.resolve(); },
    },
  };
  runInNewContext(SOURCE, { self, URL });
  const fire = async (type: string, event: Record<string, unknown>) => {
    let waited: Promise<unknown> = Promise.resolve();
    const listener = listeners.get(type);
    if (!listener) throw new Error(`no ${type} listener`);
    listener({ ...event, waitUntil: (promise: Promise<unknown>) => { waited = promise; } });
    await waited;
  };
  return { fire, shown, opened, focused };
}

const data = (json: unknown) => ({ json: () => (json instanceof Error ? (() => { throw json; })() : json) });
const tap = (url: unknown) => ({ notification: { data: { url }, close: () => {} } });

describe('/sw.js', () => {
  it('shows a push as one notification, its url kept for the tap', async () => {
    const { fire, shown } = worker();
    await fire('push', { data: data({ title: 'PRD 1322 waits for your approval', body: 'The approval handshake', url: '/prd/1322?tab=approval' }) });
    expect(shown).toEqual([{
      title: 'PRD 1322 waits for your approval',
      options: { body: 'The approval handshake', data: { url: `${ORIGIN}/prd/1322?tab=approval` }, icon: '/icon' },
    }]);
  });

  it('a push it cannot read still shows a notification, to the app', async () => {
    for (const event of [{ data: data(new Error('not json')) }, { data: null }, { data: data({ title: 7 }) }]) {
      const { fire, shown } = worker();
      await fire('push', event);
      expect(shown).toEqual([{ title: 'Omni Loop', options: { body: 'A PRD waits for your approval.', data: { url: `${ORIGIN}/app` }, icon: '/icon' } }]);
    }
  });

  it('never keeps a url off this site', async () => {
    const { fire, shown } = worker();
    await fire('push', { data: data({ title: 'x', body: 'y', url: 'https://evil.example/phish' }) });
    expect(shown[0]?.options).toMatchObject({ data: { url: `${ORIGIN}/app` } });
  });

  it('a tap focuses the tab already on the url, or opens it', async () => {
    const url = `${ORIGIN}/prd/1322`;
    const open = worker([{ url }]);
    await open.fire('notificationclick', tap(url));
    expect(open.focused).toEqual([url]);
    expect(open.opened).toEqual([]);
    const none = worker([{ url: `${ORIGIN}/app` }]);
    await none.fire('notificationclick', tap(url));
    expect(none.opened).toEqual([url]);
  });
});

describe('the web manifest', () => {
  it('makes the page installable: a name, the app as start, standalone, an icon', () => {
    const m = manifest();
    expect(m).toMatchObject({ name: 'Omni Loop', start_url: '/app', display: 'standalone' });
    expect(m.icons).toEqual([{ src: '/icon', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }]);
  });
});

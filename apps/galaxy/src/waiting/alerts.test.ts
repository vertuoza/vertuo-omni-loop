import { describe, expect, it, vi } from 'vitest';
import {
  ALERTS_KEY, ALERTS_OFF, alertOf, documentAlertOf, announce, BLOCKED_BY_BROWSER, CHIMED_KEY, claimChime, desktopAtLoad, playChime, raiseAlerts,
  readSwitches, switchDesktopOn, writeSwitches, type NotificationApi, type Store,
} from './alerts';
import type { DocumentGroup } from './documents';
import type { WaitingItem, WaitingOutbox, WaitingQuestion } from './waiting';
import { sure } from '../arcade/test/sure';
import { parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';

// Alerts for what is new (PRD 499, s5), as pure functions over fakes: what a read announces, the two
// switches kept per browser, the chime claimed by one tab, and the desktop notifications.

const q = (id: string): WaitingQuestion => ({
  kind: 'question', id, sessionTitle: `terminal ${id}`, question: `Which ${id}?`, askedAt: 0, sharedBy: null,
});
const o = (id: string, prd = 459): WaitingOutbox => ({
  kind: 'outbox', id, prd: parsePrd(prd), dossierId: `d-${prd}`, title: `Gate ${prd}`, rank: 'high', question: `Keep ${id}?`,
});
const ids = (items: WaitingItem[]) => items.map((i) => i.id);

/** A storage over a map, like the browser's. */
function memory(): Store & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) };
}
const throwing = (): Store => ({
  getItem: () => { throw new Error('blocked'); },
  setItem: () => { throw new Error('blocked'); },
});

describe('what is new', () => {
  it('the first read announces nothing', () => {
    const { fresh, seen } = announce(null, [q('a'), q('b')]);
    expect(fresh).toEqual([]);
    expect([...seen]).toEqual(['a', 'b']);
  });

  it('a later read announces only the ids it had not seen', () => {
    const first = announce(null, [q('a')]);
    const second = announce(first.seen, [q('a'), q('b'), o('i1')]);
    expect(ids(second.fresh)).toEqual(['b', 'i1']);
    expect(ids(announce(second.seen, [q('a'), q('b'), o('i1')]).fresh)).toEqual([]);
  });

  it('an item that leaves and comes back is new again', () => {
    const one = announce(null, [q('a'), q('b')]);
    const gone = announce(one.seen, [q('b')]);
    expect(gone.fresh).toEqual([]);
    expect(ids(announce(gone.seen, [q('a'), q('b')]).fresh)).toEqual(['a']);
  });
});

describe('the switches', () => {
  it('are both off by default', () => {
    expect(readSwitches(() => memory())).toEqual(ALERTS_OFF);
    expect(ALERTS_OFF).toEqual({ desktop: false, chime: false });
  });

  it('are kept after a change', () => {
    const store = memory();
    writeSwitches(() => store, { desktop: false, chime: true });
    expect(store.map.has(ALERTS_KEY)).toBe(true);
    expect(readSwitches(() => store)).toEqual({ desktop: false, chime: true });
    writeSwitches(() => store, { desktop: true, chime: true });
    expect(readSwitches(() => store)).toEqual({ desktop: true, chime: true });
  });

  it('are both off when storage throws, or cannot even be reached, and writing breaks nothing', () => {
    expect(readSwitches(throwing)).toEqual(ALERTS_OFF);
    expect(readSwitches(() => { throw new Error('no storage'); })).toEqual(ALERTS_OFF);
    expect(() => { writeSwitches(throwing, { desktop: true, chime: true }); }).not.toThrow();
  });

  it('read anything else stored as off', () => {
    const store = memory();
    store.map.set(ALERTS_KEY, 'not json');
    expect(readSwitches(() => store)).toEqual(ALERTS_OFF);
    store.map.set(ALERTS_KEY, JSON.stringify({ desktop: 'yes', chime: 1 }));
    expect(readSwitches(() => store)).toEqual(ALERTS_OFF);
  });
});

describe('the chime claim', () => {
  it('the first tab to write the ids plays, the second does not', () => {
    const store = memory();
    expect(claimChime(() => store, ['a', 'b'])).toBe(true);
    expect(store.map.has(CHIMED_KEY)).toBe(true);
    expect(claimChime(() => store, ['a', 'b'])).toBe(false);
    expect(claimChime(() => store, ['b'])).toBe(false);
  });

  it('plays again for an id not yet written', () => {
    const store = memory();
    claimChime(() => store, ['a']);
    expect(claimChime(() => store, ['a', 'c'])).toBe(true);
  });

  it('a throwing storage plays nothing', () => {
    expect(claimChime(throwing, ['a'])).toBe(false);
    expect(claimChime(() => { throw new Error('no storage'); }, ['a'])).toBe(false);
  });

  it('nothing new plays nothing', () => {
    expect(claimChime(() => memory(), [])).toBe(false);
  });

  it('keeps a bounded memory of what it chimed', () => {
    const store = memory();
    for (let i = 0; i < 500; i++) claimChime(() => store, [`id-${i}`]);
    expect((JSON.parse(sure(store.map.get(CHIMED_KEY), 'store.map.get(CHIMED_KEY)')) as string[]).length).toBeLessThanOrEqual(200);
  });
});

describe('the chime itself', () => {
  it('breaks nothing when the browser refuses to play sound', () => {
    expect(() => { playChime(null); }).not.toThrow();
    expect(() => { playChime(class { readonly state = 'closed'; constructor() { throw new Error('no audio'); } } as never); }).not.toThrow();
  });
});

/** A fake of the browser's Notification: records what it raised and each permission asked. */
function fakeNotification(permission: NotificationPermission, answer: NotificationPermission = 'granted') {
  const raised: { title: string; options: NotificationOptions; onclick: (() => void) | null }[] = [];
  const asks = vi.fn(() => {
    Fake.permission = answer;
    return Promise.resolve(answer);
  });
  class Fake {
    static permission = permission;
    static requestPermission = asks;
    onclick: (() => void) | null = null;
    constructor(title: string, options: NotificationOptions) {
      raised.push(this as never);
      Object.assign(this, { title, options });
    }
  }
  return { api: Fake as unknown as NotificationApi, raised, asks };
}

describe('desktop alerts', () => {
  it('switching on asks the browser\'s permission once', async () => {
    const { api, asks } = fakeNotification('default', 'granted');
    expect(await switchDesktopOn(api)).toBe('on');
    expect(await switchDesktopOn(api)).toBe('on');
    expect(asks).toHaveBeenCalledTimes(1);
  });

  it('a denied permission reads "Blocked by the browser"', async () => {
    const denied = fakeNotification('default', 'denied');
    expect(await switchDesktopOn(denied.api)).toBe('blocked');
    const already = fakeNotification('denied');
    expect(await switchDesktopOn(already.api)).toBe('blocked');
    expect(already.asks).not.toHaveBeenCalled();
    expect(BLOCKED_BY_BROWSER).toBe('Blocked by the browser');
  });

  it('a dismissed prompt leaves the switch off, and a browser without notifications is blocked', async () => {
    expect(await switchDesktopOn(fakeNotification('default', 'default').api)).toBe('off');
    expect(await switchDesktopOn(null)).toBe('blocked');
  });

  it('comes back at load as it was kept, never asking', () => {
    const granted = fakeNotification('granted');
    expect(desktopAtLoad(true, granted.api)).toBe('on');
    expect(desktopAtLoad(false, granted.api)).toBe('off');
    expect(desktopAtLoad(true, fakeNotification('denied').api)).toBe('blocked');
    expect(desktopAtLoad(false, fakeNotification('denied').api)).toBe('blocked');
    const unasked = fakeNotification('default');
    expect(desktopAtLoad(true, unasked.api)).toBe('off');
    expect(unasked.asks).not.toHaveBeenCalled();
  });

  it('each new item raises one notification tagged with its id and its text', () => {
    const { api, raised } = fakeNotification('granted');
    const opened: string[] = [];
    raiseAlerts(api, 'on', [q('r1'), o('i1', 460)], (href) => opened.push(href));
    expect(raised.map((n) => [(n as never as { title: string }).title, (n as never as { options: NotificationOptions }).options.tag])).toEqual([
      ['Claude is asking: Which r1?', 'r1'],
      ['PRD 460 outbox: Keep i1?', 'i1'],
    ]);
    sure(raised[1], 'raised[1]').onclick?.();
    expect(opened).toEqual(['/prd/d-460?tab=outbox']);
  });

  it('with the switch off nothing is raised and nothing is asked', () => {
    const { api, raised } = fakeNotification('granted');
    raiseAlerts(api, 'off', [q('r1')], () => {});
    raiseAlerts(api, 'blocked', [q('r1')], () => {});
    expect(raised).toEqual([]);
    const unasked = fakeNotification('default');
    raiseAlerts(unasked.api, 'off', [q('r1')], () => {});
    expect(unasked.asks).not.toHaveBeenCalled();
  });

  it('never throws when the browser refuses a notification', () => {
    const api = class { static permission = 'granted'; onclick = null; constructor() { throw new Error('refused'); } } as unknown as NotificationApi;
    expect(() => { raiseAlerts(api, 'on', [q('r1')], () => {}); }).not.toThrow();
  });

  it('says what waits in words a person reads, and where it opens', () => {
    expect(alertOf(q('r 1'))).toEqual({ title: 'Claude is asking: Which r 1?', body: 'terminal r 1', tag: 'r 1', href: '/ask/q/r%201' });
    expect(alertOf(o('i1', 459))).toEqual({ title: 'PRD 459 outbox: Keep i1?', body: 'Gate 459', tag: 'i1', href: '/prd/d-459?tab=outbox' });
  });
});

describe('a new documents alert (PRD 579, s2)', () => {
  const group: DocumentGroup = {
    dossierId: 'd 572', prd: parsePrd(572), title: 'Dashboards', kinds: ['spec', 'plan', 'before-after'], newestId: 'v9', newestAt: 0,
  };

  it('names the PRD and the kinds, the body its title, tagged by its newest version, opening its page', () => {
    expect(documentAlertOf(group)).toEqual({
      title: 'PRD 572: new spec, plan, before/after', body: 'Dashboards', tag: 'docs-d 572-v9', href: '/prd/d%20572',
    });
  });

  it('names only the kinds it is given', () => {
    expect(documentAlertOf(group, ['plan']).title).toBe('PRD 572: new plan');
  });
});

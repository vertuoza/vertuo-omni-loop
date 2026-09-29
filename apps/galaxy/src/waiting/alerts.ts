import type { DocumentGroup, DocumentKind } from './documents';
import type { WaitingItem } from './waiting';

// Alerts for what is new (PRD 499, s5), as pure functions over the browser's parts, each passed in so
// the tests hand fakes. New is an item, by its id, in a read's result that was not in the list before
// that read: the first read after load (and the list the server rendered) announces nothing, and an
// item that leaves and comes back is new again. Two switches, Desktop alerts and Chime, both off until
// the person switches them on at the foot of the bell's panel, kept per browser in localStorage. A
// desktop alert is one notification per new item, tagged by its id, so several open tabs raise it
// once. The chime plays once per read that finds new items, and only in the first tab to write their
// ids to localStorage. Every storage read and write is wrapped: without storage both switches are off
// and no chime plays. Nothing here throws.

/** Where the two switches are kept. */
export const ALERTS_KEY = 'omni-waiting-alerts';
/** Where the tabs write the ids they chimed for, so only the first plays. */
export const CHIMED_KEY = 'omni-waiting-chimed';
/** How many chimed ids are kept: enough for every open tab to see a read's ids, bounded. */
const CHIMED_KEPT = 200;

export const BLOCKED_BY_BROWSER = 'Blocked by the browser';

export type AlertSwitches = { desktop: boolean; chime: boolean };

export const ALERTS_OFF: AlertSwitches = { desktop: false, chime: false };

/** The part of localStorage used; reaching it may throw, so it is passed as a function. */
export type Store = Pick<Storage, 'getItem' | 'setItem'>;

/** What a read announces: the items it holds that were not seen before it, and what is seen now.
 * `seen` null is the first read: it announces nothing. */
export function announce(seen: ReadonlySet<string> | null, items: readonly WaitingItem[]): { fresh: WaitingItem[]; seen: Set<string> } {
  const now = new Set(items.map((i) => i.id));
  return { fresh: seen ? items.filter((i) => !seen.has(i.id)) : [], seen: now };
}

export function readSwitches(store: () => Store): AlertSwitches {
  try {
    const raw = JSON.parse(store().getItem(ALERTS_KEY) ?? 'null') as Partial<AlertSwitches> | null;
    return { desktop: raw?.desktop === true, chime: raw?.chime === true };
  } catch {
    return ALERTS_OFF;
  }
}

export function writeSwitches(store: () => Store, switches: AlertSwitches): void {
  try {
    store().setItem(ALERTS_KEY, JSON.stringify(switches));
  } catch {
    /* the switch holds for this visit only */
  }
}

/** Whether this tab plays the chime for `ids`: only when one of them is not yet written, and the
 * write works. A storage that throws plays nothing. */
export function claimChime(store: () => Store, ids: readonly string[]): boolean {
  if (ids.length === 0) return false;
  try {
    const s = store();
    let prior: string[] = [];
    try {
      const raw: unknown = JSON.parse(s.getItem(CHIMED_KEY) ?? '[]');
      if (Array.isArray(raw)) prior = raw.filter((x): x is string => typeof x === 'string');
    } catch {
      /* unreadable: start over */
    }
    const written = new Set(prior);
    const unwritten = ids.filter((id) => !written.has(id));
    if (unwritten.length === 0) return false;
    s.setItem(CHIMED_KEY, JSON.stringify([...prior, ...unwritten].slice(-CHIMED_KEPT)));
    return true;
  } catch {
    return false;
  }
}

type AudioCtor = new () => AudioContext;

/** A short tone made by the Web Audio API, no audio file. A browser that refuses breaks nothing. */
export function playChime(Audio: AudioCtor | null | undefined): void {
  if (!Audio) return;
  try {
    const ctx = new Audio();
    const tone = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    tone.type = 'sine';
    tone.frequency.setValueAtTime(880, t);
    tone.frequency.setValueAtTime(1320, t + 0.09);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    tone.connect(gain).connect(ctx.destination);
    tone.onended = () => void ctx.close().catch(() => {});
    tone.start(t);
    tone.stop(t + 0.32);
    void ctx.resume?.().catch(() => {});
  } catch {
    /* no sound */
  }
}

/** The browser's Notification, as much of it as is used. */
export type NotificationApi = {
  readonly permission: NotificationPermission;
  requestPermission(): Promise<NotificationPermission>;
  new (title: string, options?: NotificationOptions): { onclick: ((this: unknown, ev: Event) => unknown) | null; close?(): void };
};

/** The Desktop alerts switch: on, off, or blocked by the browser (it cannot be turned on from the page). */
export type DesktopState = 'on' | 'off' | 'blocked';

/** The switch as the page loads, from what was kept, never asking the browser. */
export function desktopAtLoad(kept: boolean, api: NotificationApi | null | undefined): DesktopState {
  if (!api || api.permission === 'denied') return 'blocked';
  return kept && api.permission === 'granted' ? 'on' : 'off';
}

/** Switching on: asks the browser's permission only when it has not been answered. */
export async function switchDesktopOn(api: NotificationApi | null | undefined): Promise<DesktopState> {
  if (!api || api.permission === 'denied') return 'blocked';
  if (api.permission === 'granted') return 'on';
  try {
    const answer = await api.requestPermission();
    return answer === 'granted' ? 'on' : answer === 'denied' ? 'blocked' : 'off';
  } catch {
    return 'off';
  }
}

export type Alert = { title: string; body: string; tag: string; href: string };

/** What a desktop alert says of an item, and where clicking it goes. */
export function alertOf(item: WaitingItem): Alert {
  return item.kind === 'question'
    ? { title: `Claude is asking: ${item.question}`, body: item.sessionTitle, tag: item.id, href: `/ask/q/${encodeURIComponent(item.id)}` }
    : { title: `PRD ${item.prd} outbox: ${item.question}`, body: item.title, tag: item.id, href: `/prd/${encodeURIComponent(item.dossierId)}?tab=outbox` };
}

const KIND_WORDS: Record<DocumentKind, string> = { spec: 'spec', plan: 'plan', 'before-after': 'before/after' };

/** What a desktop alert says of a PRD's new documents (PRD 579, s2): the kinds given (by default all
 * of its group's), tagged by its newest version so every open tab raises it once, opening its page. */
export function documentAlertOf(group: DocumentGroup, kinds: readonly DocumentKind[] = group.kinds): Alert {
  return {
    title: `PRD ${group.prd}: new ${kinds.map((k) => KIND_WORDS[k]).join(', ')}`,
    body: group.title,
    tag: `docs-${group.dossierId}-${group.newestId}`,
    href: `/prd/${encodeURIComponent(group.dossierId)}`,
  };
}

/** One notification per new item while the switch is on; clicking one calls `open` with its link. */
export function raiseAlerts(api: NotificationApi | null | undefined, state: DesktopState, items: readonly WaitingItem[], open: (href: string) => void): void {
  raiseEach(api, state, items.map(alertOf), open);
}

/** One notification per alert while the switch is on; clicking one calls `open` with its link. */
export function raiseEach(api: NotificationApi | null | undefined, state: DesktopState, alerts: readonly Alert[], open: (href: string) => void): void {
  if (!api || state !== 'on' || api.permission !== 'granted') return;
  for (const alert of alerts) {
    try {
      const n = new api(alert.title, { body: alert.body, tag: alert.tag });
      n.onclick = () => {
        open(alert.href);
        n.close?.();
      };
    } catch {
      /* the browser refused this one */
    }
  }
}

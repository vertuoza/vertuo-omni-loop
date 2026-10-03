'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '../../../../supabase/database.types.ts';
import { poll } from '../ask/page/poll';
import {
  announce, claimChime, desktopAtLoad, playChime, raiseAlerts, readSwitches, switchDesktopOn, writeSwitches,
  type DesktopState, type NotificationApi, type Store,
} from './alerts';
import { DOCS_MS, documentsReader, groupDocuments, noticeDocuments, readSeen, type Announced, type DocumentGroup } from './documents';
import { BUSINESS_MS, EMPTY_BUSINESS_PART, businessRead, readBusinessCount, type BusinessPart } from './business';
import { iconHref } from './icon';
import { EMPTY_OUTBOX_PART, outboxRead, pollOutbox, readOutbox, type OutboxPart } from './outbox';
import { pollQuestions } from './questions-poll';
import { questionsReader } from './source';
import type { WaitingView } from './view';
import { EMPTY_WAITING, titled, waitingCounts, type WaitingCounts, type WaitingItem, type WaitingList, type WaitingOutbox } from './waiting';

// The waiting provider (PRD 499), mounted once by the app shell around the sidebar, the top bar and
// the page: the one place that reads what waits for the person looking. It starts from the Questions
// part the server rendered and reads it again every 5 s while the tab is visible, every 15 s while it
// is hidden (PRD 657, s10), and at once when the tab shows again. The Outbox part starts empty and is read from GET /api/waiting/outbox once after
// load and every 60 s while visible (src/waiting/outbox.ts). It keeps the browser tab's title prefixed
// with the count, whatever the page or Next writes there, and the tab's icon dotted while the count is
// above 0. A failed read keeps the part's last items and is logged once per kind of failure per page
// load. Signed out, there is no view: the list stays empty and nothing is read.
//
// It also alerts for what is new (s5, src/waiting/alerts.ts): each part remembers the ids of its last
// read, starting from what the server rendered (the Questions part) or from its first read (the Outbox
// part), so what waited at load announces nothing. A read that finds new items raises one desktop
// notification per item while Desktop alerts is on, and one chime while Chime is on, played by the
// first tab to claim it. The two switches, off until switched on, are kept per browser.
//
// PRD 579 adds the New documents part (src/waiting/documents.ts): the spec, plan and before/after
// versions pushed to the numbered dossiers the person opened, read straight from Supabase as them once
// after load and every 10 s while the tab is visible, grouped per PRD less what this browser has seen
// (a PRD's page marks it seen). It is news, not a wait: it never adds to the counts, so never to the
// bell's badge, the tab's `(N)`, the favicon dot or the sidebar badges. A PRD's group is announced
// once it settles (s2, `noticeDocuments`): one desktop alert per PRD and one chime per read, behind the
// same two switches, once per newest version across reloads and tabs.
//
// PRD 774 (s5) adds the Business part (src/waiting/business.ts): how many things wait to be checked on
// Settings › Business, read from GET /api/waiting/business once after load and every 60 s while
// visible. Like New documents it never adds to the counts, and it raises no alert (no email, no sound).

export type Waiting = {
  list: WaitingList;
  counts: WaitingCounts;
  /** A part whose last read failed: it holds what it last had. */
  unread: { questions: boolean; outbox: boolean; documents: boolean; business: boolean };
  /** How many PRDs the outbox route could not read, the items of the others kept. */
  unreadPrds: number;
  /** The New documents part: one group per PRD, newest first. Never counted. */
  documents: DocumentGroup[];
  /** The Business part: how many things wait to be checked on Settings › Business. Never counted. */
  business: number;
};

const EMPTY: Waiting = { list: EMPTY_WAITING, counts: waitingCounts(EMPTY_WAITING), unread: { questions: false, outbox: false, documents: false, business: false }, unreadPrds: 0, documents: [], business: 0 };

const Context = createContext<Waiting>(EMPTY);

/** The waiting list, as the provider last read it; empty outside one. */
export const useWaiting = (): Waiting => useContext(Context);

/** The two alert switches at the foot of the bell's panel, and what flipping one does. */
export type WaitingAlerts = {
  desktop: DesktopState;
  chime: boolean;
  onDesktop: (on: boolean) => void;
  onChime: (on: boolean) => void;
};

const AlertsContext = createContext<WaitingAlerts | undefined>(undefined);

/** The alert switches; none outside a provider, or signed out. */
export const useAlerts = (): WaitingAlerts | undefined => useContext(AlertsContext);

const storage = (): Store => window.localStorage;
const notifications = (): NotificationApi | null =>
  typeof Notification === 'undefined' ? null : Notification;
/** The window as sound is looked for on it: older Safari names its AudioContext webkitAudioContext, and some browsers have none. */
type AudioWindow = { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
const audio = () => {
  const sound: AudioWindow = window;
  return sound.AudioContext ?? sound.webkitAudioContext ?? null;
};
/** A notification clicked: this tab in front, on the item's page. */
const openFromAlert = (href: string) => {
  window.focus();
  window.location.assign(href);
};

/** Logs each kind of failure once per page load. */
function onceEach(): (kind: string, error: unknown) => void {
  const seen = new Set<string>();
  return (kind, error) => {
    if (seen.has(kind)) return;
    seen.add(kind);
    console.error(error);
  };
}

export function WaitingProvider({ view, outbox: first = [], children }: {
  view: WaitingView | null;
  /** The Outbox part to start from: empty on a page, which reads it after load. */
  outbox?: WaitingOutbox[];
  children: ReactNode;
}) {
  const [questions, setQuestions] = useState(() => view?.questions ?? []);
  const [unread, setUnread] = useState(() => view?.unread ?? false);
  const [outbox, setOutbox] = useState<OutboxPart>(() => ({ ...EMPTY_OUTBOX_PART, items: first }));
  const [documents, setDocuments] = useState<{ groups: DocumentGroup[]; unread: boolean }>({ groups: [], unread: false });
  const [business, setBusiness] = useState<BusinessPart>(EMPTY_BUSINESS_PART);
  const source = view?.source ?? null;
  const url = source?.kind === 'database' ? source.url : null;
  const key = source?.kind === 'database' ? source.key : null;
  const me = source?.kind === 'database' ? source.me : null;
  const signedIn = Boolean(me);

  const [switches, setSwitches] = useState<{ desktop: DesktopState; chime: boolean }>({ desktop: 'off', chime: false });
  const live = useRef(switches);
  live.current = switches;
  // What each part held at its last read: the Questions part starts from what the server rendered (when
  // it could read it), the Outbox part from its own first read.
  const seenQuestions = useRef<ReadonlySet<string> | null>(view && !view.unread ? new Set(view.questions.map((q) => q.id)) : null);
  const seenOutbox = useRef<ReadonlySet<string> | null>(null);

  useEffect(() => {
    if (!signedIn) return;
    const kept = readSwitches(storage);
    const loaded = { desktop: desktopAtLoad(kept.desktop, notifications()), chime: kept.chime };
    // Held at once, so the first New documents read, which may announce, sees the switches as kept.
    live.current = loaded;
    setSwitches(loaded);
  }, [signedIn]);

  /** A read's new items: one notification each, and one chime for the read. */
  const notice = useCallback((fresh: WaitingItem[]) => {
    if (fresh.length === 0) return;
    const { desktop, chime } = live.current;
    raiseAlerts(notifications(), desktop, fresh, openFromAlert);
    if (chime && claimChime(storage, fresh.map((i) => i.id))) playChime(audio());
  }, []);

  const onDesktop = useCallback((on: boolean) => {
    const keep = (desktop: DesktopState) => {
      setSwitches((s) => ({ ...s, desktop }));
      writeSwitches(storage, { desktop: desktop === 'on', chime: live.current.chime });
    };
    if (!on) keep(live.current.desktop === 'blocked' ? 'blocked' : 'off');
    else void switchDesktopOn(notifications()).then(keep);
  }, []);

  const onChime = useCallback((chime: boolean) => {
    setSwitches((s) => ({ ...s, chime }));
    writeSwitches(storage, { desktop: live.current.desktop === 'on', chime });
  }, []);

  const alerts = useMemo<WaitingAlerts>(() => ({ ...switches, onDesktop, onChime }), [switches, onDesktop, onChime]);

  useEffect(() => {
    if (!url || !key || !me) return;
    const read = questionsReader(createBrowserClient<Database>(url, key), me);
    const log = onceEach();
    return pollQuestions(async () => {
      try {
        const next = await read(Date.now());
        setQuestions(next);
        setUnread(false);
        const { fresh, seen } = announce(seenQuestions.current, next);
        seenQuestions.current = seen;
        notice(fresh);
      } catch (error) {
        log('questions', error);
        setUnread(true);
      }
      return true;
    }, document);
  }, [url, key, me, notice]);

  // The outbox route answers the cookie session, so it is read wherever the questions are.
  useEffect(() => {
    if (!signedIn) return;
    const log = onceEach();
    return pollOutbox(async () => {
      const read = await readOutbox((input, init) => fetch(input, init));
      if (!read.ok) log(read.kind, new Error(`The waiting outbox could not be read: ${read.kind}`));
      setOutbox((part) => outboxRead(part, read));
      if (read.ok) {
        const { fresh, seen } = announce(seenOutbox.current, read.items);
        seenOutbox.current = seen;
        notice(fresh);
      }
    }, document, () => Date.now());
  }, [signedIn, notice]);

  // The Business part: the route answers the cookie session, as the outbox route does. No alert.
  useEffect(() => {
    if (!signedIn) return;
    const log = onceEach();
    return pollOutbox(async () => {
      const read = await readBusinessCount((input, init) => fetch(input, init));
      if (!read.ok) log(read.kind, new Error(`The waiting business could not be read: ${read.kind}`));
      setBusiness((part) => businessRead(part, read));
    }, document, () => Date.now(), BUSINESS_MS);
  }, [signedIn]);

  // The New documents part: read as `me` at once, then every 10 s while visible. Seen is read again at
  // each read, so a PRD page opened in any tab clears its group at the next one.
  useEffect(() => {
    if (!url || !key || !me) return;
    const read = documentsReader(createBrowserClient<Database>(url, key), me);
    const loadedAt = Date.now();
    const log = onceEach();
    // What this tab announced, standing in for storage that cannot be read (s2).
    let announced: Announced = [];
    const tick = async () => {
      try {
        const rows = await read(Date.now());
        const groups = groupDocuments(rows, readSeen(storage, loadedAt));
        setDocuments({ groups, unread: false });
        const { desktop, chime } = live.current;
        announced = noticeDocuments({
          groups, now: Date.now(), store: storage, kept: announced, desktop, chime,
          notifications: notifications(), play: () => { playChime(audio()); }, open: openFromAlert,
        });
      } catch (error) {
        log('documents', error);
        setDocuments((part) => ({ ...part, unread: true }));
      }
      return true;
    };
    const stop = poll(tick, document, DOCS_MS);
    if (document.visibilityState === 'visible') void tick();
    return stop;
  }, [url, key, me]);

  const value = useMemo<Waiting>(() => {
    const list = { questions, outbox: outbox.items };
    return {
      list, counts: waitingCounts(list), unread: { questions: unread, outbox: outbox.unread, documents: documents.unread, business: business.unread },
      unreadPrds: outbox.unreadPrds, documents: documents.groups, business: business.count,
    };
  }, [questions, unread, outbox, documents, business]);

  const total = value.counts.total;
  useEffect(() => {
    const apply = () => {
      const next = titled(document.title, total);
      if (next !== document.title) document.title = next;
      for (const link of document.head.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]')) {
        // The page's own icon, kept the first time it is dotted, so it comes back at 0.
        link.dataset.crest ??= link.getAttribute('href') ?? '';
        const href = iconHref(total, link.dataset.crest);
        if (link.getAttribute('href') !== href) link.setAttribute('href', href);
      }
    };
    apply();
    // Next writes each page's title and icon on navigation, after this effect: apply them again.
    const watch = new MutationObserver(apply);
    watch.observe(document.head, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['href'] });
    return () => { watch.disconnect(); };
  }, [total]);

  return (
    <Context.Provider value={value}>
      <AlertsContext.Provider value={signedIn ? alerts : undefined}>{children}</AlertsContext.Provider>
    </Context.Provider>
  );
}

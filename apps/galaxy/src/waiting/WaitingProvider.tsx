'use client';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { poll } from '../ask/page/poll';
import { iconHref } from './icon';
import { EMPTY_OUTBOX_PART, outboxRead, pollOutbox, readOutbox, type OutboxPart } from './outbox';
import { questionsReader } from './source';
import type { WaitingView } from './view';
import { EMPTY_WAITING, titled, WAITING_MS, waitingCounts, type WaitingCounts, type WaitingList, type WaitingOutbox } from './waiting';

// The waiting provider (PRD 499), mounted once by the app shell around the sidebar, the top bar and
// the page: the one place that reads what waits for the person looking. It starts from the Questions
// part the server rendered and reads it again every 5 s while the tab is visible (and at once when the
// tab shows again). The Outbox part starts empty and is read from GET /api/waiting/outbox once after
// load and every 60 s while visible (src/waiting/outbox.ts). It keeps the browser tab's title prefixed
// with the count, whatever the page or Next writes there, and the tab's icon dotted while the count is
// above 0. A failed read keeps the part's last items and is logged once per kind of failure per page
// load. Signed out, there is no view: the list stays empty and nothing is read.

export type Waiting = {
  list: WaitingList;
  counts: WaitingCounts;
  /** A part whose last read failed: it holds what it last had. */
  unread: { questions: boolean; outbox: boolean };
  /** How many PRDs the outbox route could not read, the items of the others kept. */
  unreadPrds: number;
};

const EMPTY: Waiting = { list: EMPTY_WAITING, counts: waitingCounts(EMPTY_WAITING), unread: { questions: false, outbox: false }, unreadPrds: 0 };

const Context = createContext<Waiting>(EMPTY);

/** The waiting list, as the provider last read it; empty outside one. */
export const useWaiting = (): Waiting => useContext(Context);

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
  const source = view?.source ?? null;
  const url = source?.kind === 'database' ? source.url : null;
  const key = source?.kind === 'database' ? source.key : null;
  const me = source?.kind === 'database' ? source.me : null;

  useEffect(() => {
    if (!url || !key || !me) return;
    const read = questionsReader(createBrowserClient(url, key), me);
    const log = onceEach();
    return poll(async () => {
      try {
        setQuestions(await read(Date.now()));
        setUnread(false);
      } catch (error) {
        log('questions', error);
        setUnread(true);
      }
      return true;
    }, document, WAITING_MS);
  }, [url, key, me]);

  // The outbox route answers the cookie session, so it is read wherever the questions are.
  const signedIn = Boolean(me);
  useEffect(() => {
    if (!signedIn) return;
    const log = onceEach();
    return pollOutbox(async () => {
      const read = await readOutbox((input, init) => fetch(input, init));
      if (!read.ok) log(read.kind, new Error(`The waiting outbox could not be read: ${read.kind}`));
      setOutbox((part) => outboxRead(part, read));
    }, document, () => Date.now());
  }, [signedIn]);

  const value = useMemo<Waiting>(() => {
    const list = { questions, outbox: outbox.items };
    return { list, counts: waitingCounts(list), unread: { questions: unread, outbox: outbox.unread }, unreadPrds: outbox.unreadPrds };
  }, [questions, unread, outbox]);

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
    return () => watch.disconnect();
  }, [total]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

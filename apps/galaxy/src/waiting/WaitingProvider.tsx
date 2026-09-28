'use client';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { poll } from '../ask/page/poll';
import { questionsReader } from './source';
import type { WaitingView } from './view';
import { EMPTY_WAITING, titled, WAITING_MS, waitingCounts, type WaitingCounts, type WaitingList } from './waiting';

// The waiting provider (PRD 499), mounted once by the app shell around the sidebar, the top bar and
// the page: the one place that reads what waits for the person looking. It starts from the Questions
// part the server rendered, reads it again every 5 s while the tab is visible (and at once when the
// tab shows again), and keeps the browser tab's title prefixed with the count, whatever the page or
// Next writes there. A failed read keeps the last items and is logged once per page load. Signed out,
// there is no view: the list stays empty and nothing is read.

export type Waiting = {
  list: WaitingList;
  counts: WaitingCounts;
  /** A part whose last read failed: it holds what it last had. */
  unread: { questions: boolean };
};

const EMPTY: Waiting = { list: EMPTY_WAITING, counts: waitingCounts(EMPTY_WAITING), unread: { questions: false } };

const Context = createContext<Waiting>(EMPTY);

/** The waiting list, as the provider last read it; empty outside one. */
export const useWaiting = (): Waiting => useContext(Context);

export function WaitingProvider({ view, children }: { view: WaitingView | null; children: ReactNode }) {
  const [questions, setQuestions] = useState(() => view?.questions ?? []);
  const [unread, setUnread] = useState(() => view?.unread ?? false);
  const source = view?.source ?? null;
  const url = source?.kind === 'database' ? source.url : null;
  const key = source?.kind === 'database' ? source.key : null;
  const me = source?.kind === 'database' ? source.me : null;

  useEffect(() => {
    if (!url || !key || !me) return;
    const read = questionsReader(createBrowserClient(url, key), me);
    let logged = false;
    return poll(async () => {
      try {
        setQuestions(await read(Date.now()));
        setUnread(false);
      } catch (error) {
        if (!logged) console.error(error);
        logged = true;
        setUnread(true);
      }
      return true;
    }, document, WAITING_MS);
  }, [url, key, me]);

  const value = useMemo<Waiting>(() => {
    const list = { ...EMPTY_WAITING, questions };
    return { list, counts: waitingCounts(list), unread: { questions: unread } };
  }, [questions, unread]);

  const total = value.counts.total;
  useEffect(() => {
    const apply = () => {
      const next = titled(document.title, total);
      if (next !== document.title) document.title = next;
    };
    apply();
    // Next writes each page's title on navigation, after this effect: prefix it again.
    const watch = new MutationObserver(apply);
    watch.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => watch.disconnect();
  }, [total]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

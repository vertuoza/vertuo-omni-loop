'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { AskSession, type SourceConfig } from './AskSession';
import { poll } from './poll';
import { databaseTabs, type TabsPort } from './source';
import { needsYou, pageTabs, pageWithList, pageWithPane, pickTab, tabsTitle, toggleList, type Page, type Tab } from './tabs';
import type { SessionState } from './view';

// The person's ask page (PRD 142): every open ask session they own as a tab, one per terminal, the
// selected one's pane beside the list. The list is read again every 2 s while the page is visible;
// the selection moves only when the person picks a tab (a link to /ask/<id>), never by itself: a
// question arriving elsewhere badges that tab and counts in the browser title. Below 720 px the list
// folds into one row at the top that says how many terminals there are and how many need the person;
// pressing it opens the list, and picking a tab closes it.

type Props = {
  source: SourceConfig;
  /** The page as the server opened it: the list, and the selected tab. */
  page: Page;
  /** The selected session, as the server read it; null when none is selected. */
  pane: SessionState | null;
  serverNow: number;
  /** Kept on every tab link (the demo's `?demo=`). */
  query?: string;
};

function makeTabs(source: SourceConfig, page: Page): TabsPort {
  if (source.kind === 'demo') return { list: async () => structuredClone(page.rows) };
  return databaseTabs(createBrowserClient(source.url, source.key));
}

function TabState({ tab }: { tab: Tab }) {
  if (tab.state === 'needs-you') return <span className="ask-tab-state" data-state="needs-you">needs you · {tab.age}</span>;
  return <span className="ask-tab-state">{tab.state === 'closed' ? 'closed' : 'working'}</span>;
}

export function AskPage({ source, page: initial, pane, serverNow, query = '' }: Props) {
  const [page, setPage] = useState(initial);
  const [offset] = useState(() => serverNow - Date.now());
  const [now, setNow] = useState(serverNow);
  const port = useRef<TabsPort | null>(null);
  const getPort = useCallback(() => (port.current ??= makeTabs(source, initial)), [source, initial]);

  const tabs = useMemo(() => pageTabs(page, now), [page, now]);
  const waiting = needsYou(tabs);

  // Written again on every read: Next writes the layout's metadata title after the first effects.
  useEffect(() => {
    document.title = tabsTitle(waiting);
  }, [waiting, now]);

  useEffect(
    () =>
      poll(async () => {
        const at = Date.now() + offset;
        try {
          const rows = await getPort().list(at);
          setPage((p) => pageWithList(p, rows));
        } catch {
          /* the list keeps what it last read; the pane says when the server cannot be reached */
        }
        setNow(at);
        return true;
      }, document),
    [getPort, offset],
  );

  const onPane = useCallback((state: SessionState) => setPage((p) => pageWithPane(p, state)), []);

  if (tabs.length === 0) {
    return (
      <div className="ask-col">
        <section className="ask-card" aria-live="polite">
          <h1>Ask mode is not on in any terminal</h1>
          <p className="ask-muted">
            Run <code>/omni:ask on</code> in a Claude Code terminal. Each terminal that asks a question shows here as a
            tab of its own.
          </p>
        </section>
      </div>
    );
  }

  const head = (
    <>
      Terminals ({tabs.length}){waiting > 0 && <> · <b>{waiting} {waiting === 1 ? 'needs' : 'need'} you</b></>}
    </>
  );

  return (
    <div className="ask-page">
      <nav className="ask-tabs" aria-label="Terminals" data-open={page.listOpen || undefined}>
        <button
          type="button"
          className="ask-tabs-fold"
          aria-expanded={page.listOpen}
          aria-controls="ask-tab-list"
          onClick={() => setPage(toggleList)}
        >
          <span>{head}</span>
          <span className="ask-tabs-chevron" aria-hidden="true" />
        </button>
        <p className="ask-tabs-head">{head}</p>
        <ul className="ask-tab-list" id="ask-tab-list">
          {tabs.map((tab) => (
            <li key={tab.id}>
              <Link
                href={`/ask/${encodeURIComponent(tab.id)}${query}`}
                prefetch={false}
                className="ask-tab"
                data-state={tab.state}
                aria-current={tab.id === page.selected ? 'page' : undefined}
                onClick={() => setPage(pickTab)}
              >
                <span className="ask-tab-title">
                  {tab.state === 'needs-you' && <span className="ask-badge" aria-hidden="true" />}
                  {tab.title}
                </span>
                {tab.header && <span className="ask-tab-header">{tab.header}</span>}
                <TabState tab={tab} />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="ask-pane">
        {pane && page.selected === pane.session.id ? (
          <AskSession source={source} initial={pane} serverNow={serverNow} onState={onPane} />
        ) : (
          <div className="ask-col">
            <section className="ask-card">
              <h1>Pick a terminal</h1>
              <p className="ask-muted">Each tab is one Claude Code terminal. Pick one to read and answer its questions.</p>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

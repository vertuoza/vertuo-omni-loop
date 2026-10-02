'use client';
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import type { KnowledgeEntry, KnowledgeGraph } from '../data/knowledge';
import { EntryIndex } from './EntryIndex';
import { EntryPanel } from './EntryPanel';
import { OrreryDiagram } from './OrreryDiagram';
import { BETWEEN, entryHref, indexOf, select, tabEntries, tabs, type Selection } from './view';

// The knowledge map, for the crew: the domain tabs, the diagram of the selected one, the selected
// entry's panel, and the index with its filter. Every tab, dot and row is a real link to its address,
// so the page reads without a script; with one, a choice updates the page and the address in place
// (the address can be shared, and the back button walks the choices), and the filter narrows the
// index and dims every dot it does not match. Every address keeps the repository the menu shows
// (`repo`, null for the deployed checkout); changing repository loads the page anew.

/** A plain click: one that does not ask for a new tab or window. */
const plainClick = (event: MouseEvent) => event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function countsLine(entries: KnowledgeEntry[]) {
  const n = (test: (e: KnowledgeEntry) => boolean) => entries.filter(test).length;
  return [
    count(n((e) => e.kind === 'principle'), 'principle'),
    count(n((e) => e.kind === 'rule'), 'rule'),
    count(n((e) => e.kind === 'invariant'), 'invariant'),
    count(n((e) => e.status === 'law'), 'law'),
    `${n((e) => e.status === 'proposed')} proposed`,
  ].join(' · ');
}

export function KnowledgeMap({ graph, initial, repo = null }: { graph: KnowledgeGraph; initial: Selection; repo?: string | null }) {
  const [selection, setSelection] = useState(initial);
  const [query, setQuery] = useState('');
  const panel = useRef<HTMLDivElement>(null);
  const reveal = useRef(false);

  const allTabs = useMemo(() => tabs(graph), [graph]);
  const entries = useMemo(() => tabEntries(graph, selection.domain), [graph, selection.domain]);
  const index = useMemo(() => indexOf(graph, entries, query), [graph, entries, query]);
  const selected = entries.find((e) => e.id === selection.entry) ?? null;
  const tabLabel = (key: string) => allTabs.find((t) => t.key === key)?.label ?? key;

  // The back and forward buttons walk the choices.
  useEffect(() => {
    const walk = () => {
      const params = new URLSearchParams(window.location.search);
      const next = select(graph, { domain: params.get('domain'), entry: params.get('entry') });
      if (next) setSelection(next);
    };
    window.addEventListener('popstate', walk);
    return () => { window.removeEventListener('popstate', walk); };
  }, [graph]);

  // After choosing an entry, its panel is brought into view when it is off screen: on a phone it sits
  // between the diagram and the index.
  useEffect(() => {
    if (!reveal.current) return;
    reveal.current = false;
    const box = panel.current?.getBoundingClientRect();
    if (!box || (box.top >= 0 && box.top < window.innerHeight * 0.8)) return;
    // A browser without matchMedia (an old one, a test's) moves smoothly, as before.
    const still = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    panel.current?.scrollIntoView({ block: 'start', behavior: still ? 'auto' : 'smooth' });
  }, [selection]);

  const go = (next: Selection | null, event: MouseEvent, bringPanel: boolean) => {
    if (!next || !plainClick(event)) return;
    event.preventDefault();
    reveal.current = bringPanel;
    setSelection(next);
    const href = entryHref(next, repo);
    if (`${window.location.pathname}${window.location.search}` !== href) window.history.pushState(null, '', href);
  };
  const choose = (id: string, event: MouseEvent) => { go(select(graph, { entry: id }), event, true); };
  const openTab = (key: string, event: MouseEvent) => { go(select(graph, { domain: key }), event, false); };

  const title = tabLabel(selection.domain);
  return (
    <div className="km">
      <nav className="km-tabs" aria-label="Domains">
        {allTabs.map((tab) => (
          <a
            key={tab.key}
            href={entryHref({ domain: tab.key, entry: null }, repo)}
            aria-current={tab.key === selection.domain ? 'page' : undefined}
            className="km-tab"
            onClick={(event) => { openTab(tab.key, event); }}
          >
            {tab.label}<span className="km-count">{tab.count}</span>
          </a>
        ))}
      </nav>
      <div className="km-body">
        <header className="km-head">
          <h1 className="km-title">{title}</h1>
          <p className="km-counts">{countsLine(entries)}</p>
        </header>
        <figure className="km-figure" aria-hidden="true">
          <OrreryDiagram
            graph={graph}
            entries={entries}
            label={selection.domain === BETWEEN ? 'between' : title}
            selected={selected?.id ?? null}
            query={query}
            repo={repo}
            onChoose={choose}
          />
          <ul className="km-legend">
            <li data-kind="principle"><span className="km-mark" data-status="law" />principles, inner orbit</li>
            <li data-kind="rule"><span className="km-mark" data-status="law" />rules, middle orbit</li>
            <li data-kind="invariant"><span className="km-mark" data-status="law" />invariants, outer orbit</li>
            <li><span className="km-mark" data-status="law" />law</li>
            <li><span className="km-mark" data-status="proposed" />proposed</li>
          </ul>
        </figure>
        <div ref={panel} className="km-side">
          <EntryPanel graph={graph} entry={selected} repo={repo} onChoose={choose} />
        </div>
        <section className="km-index" aria-labelledby="km-index-title">
          <h2 id="km-index-title">Index</h2>
          <div className="km-filter">
            <label htmlFor="km-filter">Filter</label>
            <input
              id="km-filter"
              type="search"
              value={query}
              onChange={(event) => { setQuery(event.target.value); }}
              placeholder="By id or words"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <EntryIndex index={index} query={query} selected={selected?.id ?? null} tabLabel={tabLabel} repo={repo} onChoose={choose} />
        </section>
      </div>
    </div>
  );
}

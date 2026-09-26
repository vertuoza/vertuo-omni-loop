import type { MouseEvent, ReactNode } from 'react';
import { cited, servedBy, serving, type KnowledgeEntry, type KnowledgeGraph } from '../data/knowledge';
import { KIND_LABEL } from './kinds';
import { entryHref, tabOf } from './view';

// The selected entry, whole: its id, kind and status, its statement, then what the registers say
// about it (a principle's Why and what serves it, a rule's or an invariant's principle, what it cites,
// the PRD it came from, what enforces it, and its file). Every entry it names is a link to that
// entry's address.

type Choose = (id: string, event: MouseEvent) => void;

function EntryLink({ entry, onChoose }: { entry: KnowledgeEntry; onChoose: Choose }) {
  return (
    <a href={entryHref({ domain: tabOf(entry), entry: entry.id })} onClick={(event) => onChoose(entry.id, event)}>
      <code>{entry.id}</code>
    </a>
  );
}

function EntryLinks({ entries, onChoose }: { entries: KnowledgeEntry[]; onChoose: Choose }) {
  if (entries.length === 0) return <>—</>;
  return (
    <ul className="km-links">
      {entries.map((entry) => <li key={entry.id}><EntryLink entry={entry} onChoose={onChoose} /></li>)}
    </ul>
  );
}

function Fact({ term, children }: { term: string; children: ReactNode }) {
  return <><dt>{term}</dt><dd>{children}</dd></>;
}

/** What a rule's or an invariant's `Serves:` line leads to. */
function Serves({ graph, entry, onChoose }: { graph: KnowledgeGraph; entry: KnowledgeEntry; onChoose: Choose }) {
  const principle = serving(graph, entry.id);
  if (principle) return <><EntryLink entry={principle} onChoose={onChoose} /> <span className="km-quote">{principle.statement}</span></>;
  if (entry.serves) return <>{entry.serves} <span className="km-muted">names no entry</span></>;
  return <>—</>;
}

export function EntryPanel({ graph, entry, onChoose }: { graph: KnowledgeGraph; entry: KnowledgeEntry | null; onChoose: Choose }) {
  if (!entry) {
    return (
      <section className="km-panel" aria-label="The selected entry">
        <p className="km-muted">This domain holds no entry yet.</p>
      </section>
    );
  }
  const principle = entry.kind === 'principle';
  return (
    <section className="km-panel" aria-labelledby="km-panel-id">
      <h2 id="km-panel-id" className="km-panel-id"><code>{entry.id}</code></h2>
      <p className="km-chips">
        <span className="km-chip" data-kind={entry.kind}>{KIND_LABEL[entry.kind]}</span>
        <span className="km-chip" data-status={entry.status}>{entry.status}</span>
      </p>
      <p className="km-statement">{entry.statement}</p>
      <dl className="km-facts">
        {entry.domain === null && <Fact term="Domains">{entry.domains.join(' · ')}</Fact>}
        {principle && <Fact term="Why">{entry.why ?? '—'}</Fact>}
        {!principle && <Fact term="Serves"><Serves graph={graph} entry={entry} onChoose={onChoose} /></Fact>}
        {principle && <Fact term="Served by"><EntryLinks entries={servedBy(graph, entry.id)} onChoose={onChoose} /></Fact>}
        <Fact term="Cites"><EntryLinks entries={cited(graph, entry.id)} onChoose={onChoose} /></Fact>
        <Fact term="From">
          {entry.prd === null ? '—' : graph.repo ? <a href={`https://github.com/${graph.repo}/issues/${entry.prd}`}>{`PRD #${entry.prd}`}</a> : `PRD #${entry.prd}`}
        </Fact>
        <Fact term="Enforced by">{entry.enforcedBy ?? (entry.enforced ? 'yes' : '—')}</Fact>
        <Fact term="File"><code>{entry.file}</code></Fact>
      </dl>
    </section>
  );
}

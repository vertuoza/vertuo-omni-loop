import type { MouseEvent } from 'react';
import { KIND_LABEL } from './kinds';
import { entryHref, tabOf, type IndexRow, type KnowledgeIndex } from './view';

// The index under the diagram: every entry of the tab, grouped by the principle it serves, then the
// loose entries, then the unserved principles. Each row is a link to its entry's address: the way to
// the map for the keyboard and for screen readers.

type Props = {
  index: KnowledgeIndex;
  /** The filter, when one is typed. */
  query: string;
  selected: string | null;
  /** The tab's own label for a principle of another tab, keyed by its tab. */
  tabLabel: (key: string) => string;
  /** The menu's `?repo=`, carried by every row's address; null for the deployed checkout. */
  repo: string | null;
  onChoose: (id: string, event: MouseEvent) => void;
};

function Rows({ rows, selected, tabLabel, repo, onChoose }: Omit<Props, 'index' | 'query'> & { rows: IndexRow[] }) {
  return (
    <ol className="km-rows">
      {rows.map(({ entry, role, foreign }) => (
        <li key={`${role} ${entry.id}`} data-role={role}>
          <a
            href={entryHref({ domain: tabOf(entry), entry: entry.id }, repo)}
            className="km-row"
            data-kind={entry.kind}
            aria-current={entry.id === selected ? 'true' : undefined}
            data-entry={entry.id}
            onClick={(event) => { onChoose(entry.id, event); }}
          >
            <span className="km-mark" data-status={entry.status} aria-hidden="true" />
            <span className="ask-sr">{`${KIND_LABEL[entry.kind]}, ${entry.status}: `}</span>
            <code className="km-id">{entry.id}</code>
            <span className="km-text">{entry.statement}</span>
            {foreign && <span className="km-tag">{`in ${tabLabel(tabOf(entry))}`}</span>}
            {role === 'unserved' && <span className="km-tag">nothing serves it</span>}
          </a>
        </li>
      ))}
    </ol>
  );
}

export function EntryIndex({ index, query, ...rest }: Props) {
  const empty = index.grouped.length + index.loose.length + index.unserved.length === 0;
  return (
    <>
      {index.grouped.length > 0 && (
        <div className="km-group">
          <h3>By principle</h3>
          <Rows rows={index.grouped} {...rest} />
        </div>
      )}
      {index.loose.length > 0 && (
        <div className="km-group">
          <h3>Loose entries</h3>
          <p className="km-hint">Rules and invariants that serve no principle.</p>
          <Rows rows={index.loose} {...rest} />
        </div>
      )}
      {index.unserved.length > 0 && (
        <div className="km-group">
          <h3>Unserved principles</h3>
          <p className="km-hint">Principles no rule or invariant serves yet.</p>
          <Rows rows={index.unserved} {...rest} />
        </div>
      )}
      {empty && <p className="km-hint">{query.trim() ? `No entry matches “${query.trim()}”.` : 'This domain holds no entry yet.'}</p>}
    </>
  );
}

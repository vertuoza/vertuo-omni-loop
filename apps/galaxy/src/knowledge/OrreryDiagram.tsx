import type { MouseEvent } from 'react';
import { matches, type KnowledgeEntry, type KnowledgeGraph, type KnowledgeLink } from '../data/knowledge';
import { orrery } from './orrery';
import { entryHref, tabOf } from './view';

// The diagram of one tab: the sun, an orbit per kind, a dot per entry (filled for a law, a hollow
// ring for a proposed entry), every serves link drawn faintly and the selected entry's links strong.
// A dot is a link to its entry's address, for a pointer; the index under the diagram carries the
// same links for the keyboard and for screen readers, so the picture is hidden from both.

type Props = {
  graph: KnowledgeGraph;
  entries: KnowledgeEntry[];
  /** The sun's name. */
  label: string;
  selected: string | null;
  query: string;
  onChoose: (id: string, event: MouseEvent) => void;
};

/** The sun label's font size: 11 units, shrunk to fit inside the sun, whichever face draws it (a bold
 * letter is about two thirds of the size wide). */
const labelSize = (label: string, sun: number) =>
  Math.round(Math.min(11, (2 * sun * 0.84) / (0.68 * Math.max(label.length, 1))) * 10) / 10;

export function OrreryDiagram({ graph, entries, label, selected, query, onChoose }: Props) {
  const layout = orrery(entries);
  const at = new Map(layout.dots.map((dot) => [dot.entry.id, dot]));
  const drawn = graph.links.filter((link) => at.has(link.from) && at.has(link.to));
  const touches = (link: KnowledgeLink) => selected !== null && (link.from === selected || link.to === selected);
  const faint = drawn.filter((link) => link.kind === 'serves' && !touches(link));
  const strong = drawn.filter(touches);
  const chosen = selected ? at.get(selected) : undefined;

  const line = (link: KnowledgeLink, className: string) => {
    const [a, b] = [at.get(link.from)!, at.get(link.to)!];
    return <line key={`${link.kind} ${link.from} ${link.to}`} className={className} data-link={link.kind} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
  };

  return (
    <svg className="km-orrery" viewBox={`0 0 ${layout.size} ${layout.size}`} aria-hidden="true" focusable="false">
      {layout.rings.map((ring, i) => (
        <circle key={`${ring.kind} ${i}`} className="km-ring" data-kind={ring.kind} cx={layout.center} cy={layout.center} r={ring.r} />
      ))}
      <g>{faint.map((link) => line(link, 'km-link'))}</g>
      <g>{strong.map((link) => line(link, 'km-link is-strong'))}</g>
      <circle className="km-sun" cx={layout.center} cy={layout.center} r={layout.sun} />
      <text className="km-sun-label" x={layout.center} y={layout.center} fontSize={labelSize(label, layout.sun)}>{label}</text>
      {layout.dots.map(({ entry, x, y }) => (
        <a
          key={entry.id}
          href={entryHref({ domain: tabOf(entry), entry: entry.id })}
          className={matches(entry, query) ? 'km-pick' : 'km-pick is-dim'}
          tabIndex={-1}
          data-entry={entry.id}
          onClick={(event) => onChoose(entry.id, event)}
        >
          <title>{`${entry.id} · ${entry.statement}`}</title>
          <circle className="km-hit" cx={x} cy={y} r={layout.dot + 4} />
          <circle className="km-dot" data-kind={entry.kind} data-status={entry.status} cx={x} cy={y} r={layout.dot} />
        </a>
      ))}
      {chosen && <circle className="km-selected" cx={chosen.x} cy={chosen.y} r={layout.dot + 5} />}
    </svg>
  );
}

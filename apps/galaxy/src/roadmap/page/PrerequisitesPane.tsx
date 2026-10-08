import { CopyCommand } from './CopyCommand';
import type { PrerequisiteView, PrerequisitesView } from './prerequisites';
import { TickButton } from './TickButton';

// A roadmap's Prerequisites tab (PRD 1218, s6): the count line, then the rows grouped by category, those
// waiting on you first. Each row shows its need, its state, what it blocks, who does it and where and when
// it was last checked; its author card (Why, the command with a Copy button, What it does, Who can do it)
// opens by itself when the row waits on you or was never checked. A roadmap whose roadmap.md has no
// `## Prerequisites` section says so in one line. A `person` row not ticked yet has Mark as done for a
// member where it is open (s7, TickButton.tsx), and a tick that posted nothing says why above the rows.

function Card({ row }: { row: PrerequisiteView }) {
  const { card } = row;
  if (card === null) return null;
  return (
    <details className="roadmap-prereq-card" open={row.open}>
      <summary>What to do</summary>
      <dl>
        {card.why ? <><dt>Why</dt><dd>{card.why}</dd></> : null}
        {card.command ? <><dt>Command</dt><dd><CopyCommand command={card.command} id={`roadmap-prereq-${row.id}-command`} /></dd></> : null}
        {card.whatItDoes ? <><dt>What it does</dt><dd>{card.whatItDoes}</dd></> : null}
        {card.whoCanDoIt ? <><dt>Who can do it</dt><dd>{card.whoCanDoIt}</dd></> : null}
      </dl>
    </details>
  );
}

function Row({ row, roadmap }: { row: PrerequisiteView; roadmap: string }) {
  return (
    <li className={`roadmap-prereq is-${row.state}`} data-prereq={row.id}>
      <p>
        <span className={`roadmap-prereq-state is-${row.state}`}>{row.stateLabel}</span> <b>{row.id}</b> {row.need}
      </p>
      <p className="roadmap-muted">
        {row.blocks} · {row.who}{row.checked ? ` · ${row.checked}` : null}
      </p>
      <Card row={row} />
      {row.tickable ? <TickButton roadmap={roadmap} row={row.id} /> : null}
    </li>
  );
}

export function PrerequisitesPane({ prerequisites, roadmap }: { prerequisites: PrerequisitesView; roadmap: string }) {
  if (prerequisites.count === null) {
    return (
      <section className="board-card roadmap-prereqs">
        <p className="roadmap-muted">
          This roadmap names no prerequisite: its <code>roadmap.md</code> has no <code>## Prerequisites</code> section.
        </p>
      </section>
    );
  }
  return (
    <section className="board-card roadmap-prereqs">
      <h2>Prerequisites</h2>
      <p className="roadmap-prereq-count">{prerequisites.count}</p>
      {prerequisites.tickError ? <p className="roadmap-tick-error" role="alert">{prerequisites.tickError}</p> : null}
      {prerequisites.groups.map((group) => (
        <section key={group.category} className="roadmap-prereq-group" data-category={group.category}>
          <h3>{group.label}</h3>
          <ul className="roadmap-lines">{group.rows.map((row) => <Row key={row.id} row={row} roadmap={roadmap} />)}</ul>
        </section>
      ))}
    </section>
  );
}

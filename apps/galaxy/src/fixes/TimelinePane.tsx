import type { People } from '../people/load';
import { PersonChip } from '../people/PersonChip';
import type { BugRowsView } from './bug-rows';
import { NOBODY } from './people';
import { MOMENT_WORDS, type FixPageView, type Moment } from './timeline';

// A fix's Timeline tab (PRD 627, s5): each moment on its own line, in order — what happened, who and
// when, linked to its GitHub page — or muted *not yet*, *unknown* or *not recorded*. Rendered on the
// server; every word is text, escaped by React. With nothing read (a fix the route read no GitHub for),
// every moment reads unknown.
// PRD 652, s6: each "by @login" wears the person's face, resolved by login through the page's directory
// when it hands one in; without one, or for a login no member holds, their GitHub photo.

/** The login a moment names: `who` is always `@login`. */
const loginOf = (who: string) => who.replace(/^@/, '');

function Line({ moment, people }: { moment: Moment; people: People }) {
  if (moment.state !== 'done') {
    return (
      <li className={`fix-moment fix-moment-${moment.state}`}>
        <span className="fix-moment-label">{moment.label}</span>{' '}
        <span className="ask-hint">{MOMENT_WORDS[moment.state]}</span>
      </li>
    );
  }
  const label = moment.href
    ? <a href={moment.href} target="_blank" rel="noopener noreferrer">{moment.label}</a>
    : moment.label;
  return (
    <li className="fix-moment fix-moment-done">
      <span className="fix-moment-label">{label}</span>
      {moment.who && <> <span>by <PersonChip person={people.byLogin(loginOf(moment.who), moment.who)} size="inline" /></span></>}
      {moment.when && <> <span className="ask-hint">· {moment.when}</span></>}
    </li>
  );
}

/** A product bug's Fixes rows (PRD 2011, s8), as the `bug-record` screen draws them. */
function BugRowsPane({ rows }: { rows: BugRowsView }) {
  return (
    <div className="fix-rows">
      <ol className="fix-timeline" aria-label="Fixes">
        {rows.rows.map((row) => (
          <li key={row.position} className={`fix-moment fix-row fix-row-${row.state}`}>
            <span className="fix-moment-label">{row.position}. {row.repository}</span>{' '}
            {row.href && row.pull !== null ? <a href={row.href} target="_blank" rel="noopener noreferrer">#{row.pull}</a> : <span className="ask-hint">no pull request yet</span>}{' '}
            <span className="fix-state">{row.words}</span>{' '}
            <span className="ask-hint">· {row.changes}</span>
          </li>
        ))}
      </ol>
      {rows.ships && <p className="ask-hint">{rows.ships}</p>}
      {rows.unmatched.length > 0 && (
        <ul className="fix-unmatched" aria-label="Unmatched merges">
          {rows.unmatched.map((u) => <li key={u.label}><a href={u.href} target="_blank" rel="noopener noreferrer">{u.label}</a></li>)}
        </ul>
      )}
      {rows.next && <p><a className="fix-next" href={rows.next.href} target="_blank" rel="noopener noreferrer">{rows.next.label}</a></p>}
    </div>
  );
}

export function TimelinePane({ fix, people = NOBODY() }: { fix: FixPageView | null; people?: People }) {
  if (fix?.bugRows) return <BugRowsPane rows={fix.bugRows} />;
  if (!fix) return <p className="dossier-empty">GitHub could not be read for this fix. Reload the page in a moment.</p>;
  return (
    <ol className="fix-timeline" aria-label="Timeline">
      {fix.timeline.map((moment, i) => <Line key={`${moment.id}-${i}`} moment={moment} people={people} />)}
    </ol>
  );
}

/** The header's State cell: the pill, `—` when GitHub did not answer. */
export function FixStatePill({ fix }: { fix: FixPageView }) {
  return <span className={`fix-state fix-state-${fix.state ?? 'unknown'}`}>{fix.stateLabel}</span>;
}

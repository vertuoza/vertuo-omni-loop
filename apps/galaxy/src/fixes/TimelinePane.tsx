import type { People } from '../people/load';
import { PersonChip } from '../people/PersonChip';
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

export function TimelinePane({ fix, people = NOBODY() }: { fix: FixPageView | null; people?: People }) {
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

import { MOMENT_WORDS, type FixPageView, type Moment } from './timeline';

// A fix's Timeline tab (PRD 627, s5): each moment on its own line, in order — what happened, who and
// when, linked to its GitHub page — or muted *not yet*, *unknown* or *not recorded*. Rendered on the
// server; every word is text, escaped by React. With nothing read (a fix the route read no GitHub for),
// every moment reads unknown.

function Line({ moment }: { moment: Moment }) {
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
      {moment.who && <> <span>by {moment.who}</span></>}
      {moment.when && <> <span className="ask-hint">· {moment.when}</span></>}
    </li>
  );
}

export function TimelinePane({ fix }: { fix: FixPageView | null }) {
  if (!fix) return <p className="dossier-empty">GitHub could not be read for this fix. Reload the page in a moment.</p>;
  return (
    <ol className="fix-timeline" aria-label="Timeline">
      {fix.timeline.map((moment, i) => <Line key={`${moment.id}-${i}`} moment={moment} />)}
    </ol>
  );
}

/** The header's State cell: the pill, `—` when GitHub did not answer. */
export function FixStatePill({ fix }: { fix: FixPageView }) {
  return <span className={`fix-state fix-state-${fix.state ?? 'unknown'}`}>{fix.stateLabel}</span>;
}

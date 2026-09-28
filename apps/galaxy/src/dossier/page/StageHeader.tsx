import type { StageView } from './stage';
import { StageHeaderCopy } from './StageHeaderCopy';

// The stage's pieces of /prd/<id>'s header box (PRD 426, laid out by PRD 476), rendered on the server:
// the title ("PRD #n ↗" linking to its issue, or DRAFT), the one button for the title row, the track
// idea ─ PRD ─ inbox ─ outbox ─ shipped ─ retro with the stages passed ticked and the current one lit
// and written in words for the Stage cell, and the issue and pull requests that exist for the On GitHub
// cell. Unknown: nothing lit, and the words say GitHub did not answer, as a status.

export function DossierTitle({ heading, draft, title, issueUrl }: { heading: string; draft: boolean; title: string; issueUrl: string | null }) {
  return (
    <h1 className="dossier-title">
      {draft || !issueUrl ? (
        <span className="dossier-draft">DRAFT</span>
      ) : (
        <a className="dossier-number" href={issueUrl} target="_blank" rel="noopener noreferrer">{heading} ↗</a>
      )}{' '}
      <span>{title}</span>
    </h1>
  );
}

/** The stage's one button: a link to GitHub, or a command to copy; nothing when the stage has none. */
export function StageAction({ stage }: { stage: StageView | null }) {
  const action = stage?.action;
  if (action?.kind === 'link') {
    return <a className="ask-button stage-action" href={action.href} target="_blank" rel="noopener noreferrer">{action.label}</a>;
  }
  if (action?.kind === 'copy') return <StageHeaderCopy label={action.label} command={action.command} />;
  return null;
}

/** The Stage cell's value: the track, then the stage in words and its caption. */
export function StageTrack({ stage }: { stage: StageView }) {
  return (
    <>
      <ol className="stage-track" aria-label="Stages">
        {stage.track.map((stop) => (
          <li key={stop.id} className={`stage-stop stage-${stop.state}`} aria-current={stop.state === 'current' ? 'step' : undefined}>
            {stop.state === 'passed' && <span aria-hidden="true">✓ </span>}
            {stop.label}
          </li>
        ))}
      </ol>
      <p className="stage-words" role={stage.id === 'unknown' ? 'status' : undefined}>
        <strong>{stage.words}</strong>
        {stage.caption && <span className="ask-hint"> · {stage.caption}</span>}
      </p>
    </>
  );
}

/** The On GitHub cell's value: each issue or pull request that exists, open or ✓. */
export function StageLinks({ links }: { links: StageView['links'] }) {
  return (
    <ul className="stage-links" aria-label="On GitHub">
      {links.map((link) => (
        <li key={link.label}>
          <a href={link.href} target="_blank" rel="noopener noreferrer">{link.label}</a>{' '}
          <span className="ask-hint">{link.done ? '✓' : 'open'}</span>
        </li>
      ))}
    </ul>
  );
}

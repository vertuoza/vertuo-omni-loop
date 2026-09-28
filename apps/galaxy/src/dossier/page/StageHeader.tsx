import type { StageView } from './stage';
import { StageHeaderCopy } from './StageHeaderCopy';

// The top of /prd/<id> (PRD 426, part 3), rendered on the server: the title line ("PRD #n ↗" linking
// to its issue, or DRAFT), then the track idea ─ PRD ─ inbox ─ outbox ─ shipped ─ retro with the
// stages passed ticked, the current one lit and written in words, the one button, and the links line
// with only the issue and pull requests that exist. Unknown: nothing lit, and it says GitHub did not
// answer. With no stage (demo mode), the title line alone.

type Props = {
  heading: string;
  draft: boolean;
  title: string;
  issueUrl: string | null;
  stage: StageView | null;
};

export function StageHeader({ heading, draft, title, issueUrl, stage }: Props) {
  return (
    <div className="stage-head">
      <h1 className="dossier-title">
        {draft || !issueUrl ? (
          <span className="dossier-draft">DRAFT</span>
        ) : (
          <a className="dossier-number" href={issueUrl} target="_blank" rel="noopener noreferrer">{heading} ↗</a>
        )}{' '}
        <span>{title}</span>
      </h1>
      {stage && (
        <div className="stage-row">
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
          {stage.action?.kind === 'link' && (
            <a className="ask-button stage-action" href={stage.action.href} target="_blank" rel="noopener noreferrer">{stage.action.label}</a>
          )}
          {stage.action?.kind === 'copy' && <StageHeaderCopy label={stage.action.label} command={stage.action.command} />}
          {stage.links.length > 0 && (
            <ul className="stage-links" aria-label="On GitHub">
              {stage.links.map((link) => (
                <li key={link.label}>
                  <a href={link.href} target="_blank" rel="noopener noreferrer">{link.label}</a>{' '}
                  <span className="ask-hint">{link.done ? '✓' : 'open'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

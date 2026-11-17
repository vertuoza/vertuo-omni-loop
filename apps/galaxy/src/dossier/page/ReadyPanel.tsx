import { Button } from '@omni/ui';
import type { ReadyView } from './ready';

// The Ready panel of /prd/<id> (PRD 2898 s9, the library screen `ready-checks`): the latest verdict the Omni
// App saved for the PRD's feature pull request, five checks each one tap from its evidence, each acceptance
// criterion with its three lines, kind, proof and state. Ready is never merged: the foot says so. With no
// verdict there is no panel. Read-only; every text is escaped.

export function ReadyPanel({ ready }: { ready?: ReadyView | null | undefined }) {
  if (!ready) return null;
  return (
    <section className={`ready ready-${ready.tone}`} aria-label="Ready" data-screen="ready-checks">
      <div className="ready-top">
        <p className="ready-lab">Ready</p>
        <h2 className="ready-title">{ready.title}</h2>
        <span className="ready-sign">{ready.sign}</span>
      </div>
      {ready.named && (
        <div className="ready-named">
          <p><strong>Failed: {ready.named.name}</strong></p>
          {ready.named.why !== '' && <p>{ready.named.why}</p>}
          <p>{ready.named.excuse}</p>
        </div>
      )}
      <ol className="ready-checks">
        {ready.checks.map((check) => (
          <li key={check.name} className={`ready-check is-${check.tone}`}>
            <div className="ready-row">
              <span className="ready-mark" aria-hidden="true">{check.mark}</span>
              <span className="ready-name">{check.name}</span>
              <span className="ready-state">{check.state}</span>
              {check.evidence && <a href={check.evidence} target="_blank" rel="noopener noreferrer">Evidence</a>}
            </div>
            {check.note && <p className="ready-note">{check.note}</p>}
            {check.criteria.length > 0 && (
              <ol className="ready-acs">
                {check.criteria.map((ac) => (
                  <li key={ac.id} className="ready-ac">
                    <div className="ready-ac-head">
                      <span className="ready-ac-id">{ac.id}</span>
                      <span className="ready-kind">{ac.kind}</span>
                      {ac.title && <span>{ac.title}</span>}
                      <span className={`ready-state ready-ac-${ac.tone}`}>{ac.state}</span>
                      {ac.proof ? <a href={ac.proof} target="_blank" rel="noopener noreferrer">{ac.kind === 'e2e' ? 'e2e report' : 'Test'} {ac.id}</a> : <span className="ask-hint">no proof yet</span>}
                    </div>
                    {ac.steps.map((step, at) => <p key={at}><b>{step.keyword}</b> {step.text}</p>)}
                  </li>
                ))}
              </ol>
            )}
          </li>
        ))}
      </ol>
      <div className="ready-foot">
        <div>{ready.foot.lines.map((line, at) => <p key={at}>{ready.foot.strong && at === 0 ? <strong>{line}</strong> : line}</p>)}</div>
        {ready.foot.action && <Button variant="primary" href={ready.foot.action.href}>{ready.foot.action.label}</Button>}
      </div>
    </section>
  );
}

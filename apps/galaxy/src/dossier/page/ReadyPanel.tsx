import { Badge, Button, Link, Text } from '@omni/ui';
import type { ReadyView } from './ready';

// The Ready checks of /prd/<id> (PRD 2898 s9, the library screen `ready-checks`; drawn in Calm 2 by
// omni-loop-20 s13): the latest verdict the Omni App saved for the PRD's feature pull request as a record
// on top of the Feature tab, five checks each one tap from its evidence, each acceptance criterion with its
// three lines, kind, proof and state. Ready is never merged: the foot says so. With no verdict there is no
// panel. Read-only; every text is escaped.

type Tone = ReadyView['tone'];
const BADGE_TONE = { pass: 'success', fail: 'danger', wait: 'neutral' } as const satisfies Record<Tone, 'success' | 'danger' | 'neutral'>;

export function ReadyPanel({ ready }: { ready?: ReadyView | null | undefined }) {
  if (!ready) return null;
  return (
    <section className={`ready ready-${ready.tone}`} aria-label="Ready" data-screen="ready-checks">
      <div className="ready-top">
        <Text as="span" size="caption" tone="secondary" strong>Ready</Text>
        <Text as="h2" size="heading" strong>{ready.title}</Text>
        <span className="ready-sign"><Text as="span" size="small" tone="secondary">{ready.sign}</Text></span>
      </div>
      {ready.named && (
        <div className="ready-named">
          <Text tone="danger" strong>Failed: {ready.named.name}</Text>
          {ready.named.why !== '' && <Text>{ready.named.why}</Text>}
          <Text>{ready.named.excuse}</Text>
        </div>
      )}
      <ol className="ready-checks">
        {ready.checks.map((check) => (
          <li key={check.name} className={`ready-check is-${check.tone}`}>
            <div className="ready-line">
              <span className="ready-mark" aria-hidden="true">{check.mark}</span>
              <span className="ready-name"><Text as="span" strong>{check.name}</Text></span>
              <Badge tone={BADGE_TONE[check.tone]}>{check.state}</Badge>
              {check.evidence && <Link href={check.evidence} external>Evidence</Link>}
            </div>
            {check.note && <div className="ready-detail"><Text size="small" tone="secondary">{check.note}</Text></div>}
            {check.criteria.length > 0 && (
              <ol className="ready-acs">
                {check.criteria.map((ac) => (
                  <li key={ac.id} className="ready-ac">
                    <div className="ready-ac-head">
                      <Text as="span" size="caption" tone="secondary" strong>{ac.id}</Text>
                      <Badge>{ac.kind}</Badge>
                      {ac.title && <Text as="span" size="small">{ac.title}</Text>}
                      <Badge tone={BADGE_TONE[ac.tone]}>{ac.state}</Badge>
                      <span className="ready-ac-proof">
                        {ac.proof
                          ? <Link href={ac.proof} external>{ac.kind === 'e2e' ? 'e2e report' : 'Test'} {ac.id}</Link>
                          : <Text as="span" size="small" tone="secondary">no proof yet</Text>}
                      </span>
                    </div>
                    {ac.steps.map((step, at) => <Text key={at} size="small"><Text as="span" size="small" tone="secondary" strong>{step.keyword}</Text> {step.text}</Text>)}
                  </li>
                ))}
              </ol>
            )}
          </li>
        ))}
      </ol>
      <div className="ready-foot">
        <div>{ready.foot.lines.map((line, at) => <Text key={at} strong={ready.foot.strong && at === 0}>{line}</Text>)}</div>
        {ready.foot.action && <Button variant="primary" href={ready.foot.action.href}>{ready.foot.action.label}</Button>}
      </div>
    </section>
  );
}

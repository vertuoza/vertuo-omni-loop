import type { CSSProperties, ReactNode } from 'react';
import { CliSignInCard } from './cli-code-card';
import { devicePagePath } from './cli-code';
import type { DeviceView } from './device-card.controller';
import { AskUnreachable, Notice } from './page/Notice';

// The device page's own card, /ask/device (PRD 1660; the `ask-device` screen and its mockup): the
// question with the code, the box to type one, and the done, denied and expired states. The sign-in
// card after Yes is CliSignInCard (./cli-code-card.tsx). Every sentence at rest stays within 7 words;
// the only code it ever shows is the user code, XXXX-XXXX. It needs no script: Yes is a link, No and
// Continue are forms.

/** The card's states (./device-card.controller.ts picks one). */
export type DeviceCardView =
  | { kind: 'confirm'; userCode: string }
  | { kind: 'enter' }
  | { kind: 'done' }
  | { kind: 'denied' }
  | { kind: 'expired' };

/** The code in large mono type on the sunk panel. */
const CODE_PANEL: CSSProperties = {
  font: '700 32px/1 var(--ask-mono)',
  letterSpacing: '0.12em',
  padding: '14px 20px',
  borderRadius: 8,
  background: 'var(--ask-sunk)',
  color: 'var(--ask-ink)',
};
const ACTIONS: CSSProperties = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, margin: 0 };
const CODE_BOX: CSSProperties = {
  font: '600 18px/1 var(--ask-mono)',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  width: '12ch',
  padding: '11px 12px',
  borderRadius: 8,
  border: '1.5px solid var(--ask-line-strong)',
  background: 'var(--ask-surface)',
  color: 'var(--ask-ink)',
};

function Card({ title, tone, children }: { title: ReactNode; tone?: 'error'; children: ReactNode }) {
  return (
    <div className="ask-col">
      <section className="ask-card" aria-labelledby="ask-device-title">
        <h1 id="ask-device-title" className={tone === 'error' ? 'ask-error' : undefined}>{title}</h1>
        {children}
      </section>
    </div>
  );
}

export function DeviceCard({ view }: { view: DeviceCardView }) {
  switch (view.kind) {
    case 'confirm':
      return (
        <Card title="Sign a terminal in">
          <p className="ask-muted">Does your terminal show this code?</p>
          <p style={CODE_PANEL}>{view.userCode}</p>
          <form method="post" action="/ask/device/deny" style={ACTIONS}>
            <a className="ask-button" href={devicePagePath({ user_code: view.userCode, yes: '1' })}>Yes, sign it in</a>
            <input type="hidden" name="user_code" value={view.userCode} />
            <button type="submit" className="ask-button quiet">No, it’s not mine</button>
          </form>
        </Card>
      );
    case 'enter':
      return (
        <Card title="Sign a terminal in">
          <p className="ask-muted">Enter the code your terminal shows.</p>
          <form method="get" action="/ask/device" style={ACTIONS}>
            <input
              name="user_code" aria-label="Code" placeholder="XXXX-XXXX" required maxLength={12}
              autoComplete="off" autoCapitalize="characters" spellCheck={false} style={CODE_BOX}
            />
            <button type="submit" className="ask-button">Continue</button>
          </form>
        </Card>
      );
    case 'done':
      return (
        <Card title={<><span className="ask-ok" aria-hidden="true">✓</span> Back to your terminal</>}>
          <p className="ask-muted">Signed in. Close this tab.</p>
        </Card>
      );
    case 'denied':
      return (
        <Card title="Nothing was signed in">
          <p className="ask-muted">Got this link from someone? Ignore it.</p>
        </Card>
      );
    case 'expired':
      return (
        <Card title="This link has expired" tone="error">
          <p className="ask-muted">Run <code>omni signin</code> again.</p>
        </Card>
      );
  }
}

/** The whole page for a state: the card, the sign-in card after Yes (with the public Supabase pair it
 * signs in with), or a notice when there is no device sign-in here or the database did not answer. */
export function DevicePage({ view, supabase }: { view: DeviceView; supabase: { url: string; key: string } | null }) {
  if (view.kind === 'unreachable') return <AskUnreachable />;
  if (view.kind === 'signin' && supabase) {
    return <CliSignInCard supabase={supabase} returnPath={view.returnPath} error={view.error} purpose={view.purpose} />;
  }
  if (view.kind === 'closed' || view.kind === 'signin') {
    return (
      <Notice title="Ask mode is not open here">
        <p className="ask-muted">This deployment has no database, so it cannot sign a terminal in.</p>
      </Notice>
    );
  }
  return <DeviceCard view={view} />;
}

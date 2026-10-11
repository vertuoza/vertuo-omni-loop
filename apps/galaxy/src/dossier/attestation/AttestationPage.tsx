import { Notice } from '../../ask/page/Notice';
import { DossierSignIn } from '../page/DossierSignIn';
import { DossierDatabaseDown, DossiersClosed } from '../page/route-gate';
import { ApproveAgain } from './ApproveAgain';
import type { AttestationScreen } from './attestation.controller';
import type { Attestation, PinRow, TargetRow } from './attestation.service';
import { CopyCommand } from './CopyCommand';

// The Attestation page (PRD 1612 s4, spec §5), the omni/approved check's Details, drawn as the before/after
// page's Pixel perfect part draws it (the library's `attestation` screen): the seal and what it says, who
// approved and when, the policy line, each pinned file against the head, on a drift the two ways out
// (`omni approval restore <n>` with Copy, and Approve again for a member the product lets approve), and
// the PRD's target PRs. Every other state of the route is the PRD page's own notice.

const MARKS: Record<PinRow['mark'], string> = { '=': 'matches', '≠': 'differs', '?': 'unread', '·': 'not judged' };

const STATES: Record<TargetRow['state'], string> = { approved: 'approved', drifted: 'drifted', waiting: 'waits for approval', held: 'held', merged: 'merged' };

/** The seal: the PRD's number and the short hash it was approved at, lit while the approval holds. */
function Seal({ attestation }: { attestation: Attestation }) {
  return (
    <svg className="attestation-seal" viewBox="0 0 72 72" aria-hidden="true">
      <circle className="attestation-seal-ring" cx="36" cy="36" r="33" />
      <circle className="attestation-seal-core" cx="36" cy="36" r="26" />
      <text className="attestation-seal-prd" x="36" y="34" textAnchor="middle">{Number(attestation.prd)}</text>
      <text className="attestation-seal-hash" x="36" y="47" textAnchor="middle">{attestation.sealHash ?? '—'}</text>
    </svg>
  );
}

function Pins({ attestation }: { attestation: Attestation }) {
  const { head, pins } = attestation;
  return (
    <section className="ask-card attestation-card" aria-labelledby="attestation-pins">
      <h2 id="attestation-pins">{head ? `Pinned vs head ${head.slice(0, 7)}` : 'Pinned files'}</h2>
      {pins.length === 0
        ? <p className="ask-muted">Nothing pinned yet.</p>
        : (
          <ul className="attestation-pins">
            {pins.map((pin) => (
              <li key={pin.path}>
                <span className="attestation-mark" data-mark={MARKS[pin.mark]} aria-label={MARKS[pin.mark]}>{pin.mark}</span>
                <span className="attestation-path">{pin.path}</span>
                <small>{pin.now ? `${pin.pinned ?? '?'} → ${pin.now}` : pin.pinned ?? '?'}{pin.how ? ` · ${pin.how}` : ''}</small>
              </li>
            ))}
          </ul>
        )}
    </section>
  );
}

function FixIt({ attestation }: { attestation: Attestation }) {
  if (!attestation.restore) return null;
  return (
    <section className="ask-card attestation-card" aria-labelledby="attestation-fix">
      <h2 id="attestation-fix">Fix it</h2>
      <CopyCommand command={attestation.restore} />
      <p className="ask-muted">Restores the approved files; commits nothing.</p>
      <div className="attestation-again">
        {attestation.canApprove ? <ApproveAgain dossier={attestation.dossier} /> : null}
        <span className="ask-muted">{attestation.canApprove ? 'to keep the change' : `To keep it, ${attestation.approvesAgain} approves again.`}</span>
      </div>
    </section>
  );
}

function Targets({ attestation }: { attestation: Attestation }) {
  const { targets } = attestation;
  return (
    <section className="ask-card attestation-card" aria-labelledby="attestation-targets">
      <h2 id="attestation-targets">Targets</h2>
      {targets === 'unread' && <p className="ask-muted">Couldn't read the target PRs.</p>}
      {targets !== 'unread' && targets.length === 0 && <p className="ask-muted">No target PR.</p>}
      {targets !== 'unread' && targets.length > 0 && (
        <ul className="attestation-targets">
          {targets.map((target) => (
            <li key={`${target.repo}#${target.number}`}>
              <a href={target.url}>{target.repo} #{target.number}</a>
              <span data-state={target.state}>{STATES[target.state]}{target.draft ? ' · draft' : ''}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AttestationPage({ attestation }: { attestation: Attestation }) {
  const page = `/prd/${attestation.dossier}`;
  const lines = [attestation.verdict === 'approved' ? attestation.who : attestation.line, attestation.verdict === 'approved' ? null : attestation.who];
  return (
    <div className="ask-col attestation" data-verdict={attestation.verdict}>
      <nav className="attestation-crumbs" aria-label="Breadcrumb">
        <a href="/prd">PRDs</a> › <a href={page}>{Number(attestation.prd)}</a> › <b>Attestation</b>
      </nav>
      <header className="attestation-head">
        <Seal attestation={attestation} />
        <div>
          <h1>{attestation.title}</h1>
          {lines.filter((line) => line !== null).map((line) => <p key={line}>{line}</p>)}
        </div>
      </header>
      <Pins attestation={attestation} />
      <FixIt attestation={attestation} />
      {attestation.verdict === 'waiting' && (
        <p><a className="ask-button" href={page}>Open the PRD to approve it</a></p>
      )}
      <Targets attestation={attestation} />
      <p className="ask-muted attestation-policy">{attestation.policy}</p>
    </div>
  );
}

/** What /prd/<id>/attestation draws, but not found, which the route sends to its own page. */
export function AttestationScreenView({ screen }: { screen: Exclude<AttestationScreen, { kind: 'not-found' }> }) {
  switch (screen.kind) {
    case 'closed': return <DossiersClosed />;
    case 'database-down': return <DossierDatabaseDown />;
    case 'sign-in': return <DossierSignIn supabase={screen.supabase} returnPath={screen.returnPath} error={screen.error} />;
    case 'repo-born':
      return (
        <Notice title="No attestation for this PRD">
          <p className="ask-muted">PRD {screen.prd} was approved in its repository, by its merged phase-0 pull request: no check carries its approval.</p>
          <p><a href={screen.page}>Open the PRD</a></p>
        </Notice>
      );
    case 'attestation': return <AttestationPage attestation={screen.attestation} />;
  }
}

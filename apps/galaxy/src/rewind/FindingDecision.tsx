'use client';
import { useState } from 'react';
import type { DecisionReply, Verdict } from './rewind.contract';
import { decideFinding } from './rewind.client';

// Approve and Reject on a proposed finding of the Main tab (PRD 2410, s7), shown to the members who read it, as
// the before/after page draws them: the first proposed finding's Approve is the page's primary, the others
// quiet. Approve is one click. Reject asks for its optional reason beside it, then rejects with it or without.
// Once decided it says so, with what Approve sent (or why not, and what to run instead); the page read again
// shows who decided and when, and no button. A refusal (decided by someone else meanwhile, signed out) shows
// the route's own words.

/** What the card says once decided: the verdict, and what Approve sent with where to see it. */
function DecidedLine({ decided }: { decided: DecisionReply }) {
  const followUp = decided.followUp;
  const link = followUp?.link ?? null;
  const external = link?.startsWith('https://') ? { target: '_blank', rel: 'noopener noreferrer' } : {};
  return (
    <p className="main-finding-decided" role="status">
      <strong>{decided.state === 'approved' ? 'Approved' : 'Rejected'}</strong>
      {followUp && <> · {followUp.words}{link && <> <a href={link} {...external}>See it</a></>}</>}
    </p>
  );
}

type Asking = { reason: string; setReason: (reason: string) => void; busy: boolean; reject: () => void; cancel: () => void };

/** A Reject's optional reason, then Reject or Cancel. */
function ReasonAsk({ reason, setReason, busy, reject, cancel }: Asking) {
  return (
    <>
      <input
        type="text" className="ask-share-link" maxLength={500} value={reason} disabled={busy} autoFocus
        placeholder="Why, if you like" aria-label="Why reject it (optional)"
        onChange={(event) => { setReason(event.target.value.replace(/[\r\n]+/g, ' ')); }}
        onKeyDown={(event) => { if (event.key === 'Enter') reject(); }}
      />
      <button type="button" className="ask-button quiet" disabled={busy} onClick={reject}>{busy ? 'Rejecting…' : 'Reject'}</button>
      <button type="button" className="ask-button quiet" disabled={busy} onClick={cancel}>Cancel</button>
    </>
  );
}

export function FindingDecision({ finding, primary = false }: { finding: string; primary?: boolean }) {
  const [busy, setBusy] = useState<Verdict | null>(null);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [decided, setDecided] = useState<DecisionReply | null>(null);

  async function decide(verdict: Verdict) {
    if (busy) return;
    setBusy(verdict);
    setProblem(null);
    const why = reason.trim();
    const done = await decideFinding(verdict === 'reject' && why !== '' ? { finding, verdict, reason: why } : { finding, verdict });
    if (done.ok) setDecided(done.reply);
    else setProblem(done.error);
    setBusy(null);
  }

  if (decided) return <DecidedLine decided={decided} />;
  const approveLook = primary ? { className: 'ask-button', 'data-primary': '' } : { className: 'ask-button quiet' };
  return (
    <div className="main-finding-decide">
      {asking ? (
        <ReasonAsk
          reason={reason} setReason={setReason} busy={busy !== null}
          reject={() => void decide('reject')} cancel={() => { setAsking(false); setReason(''); }}
        />
      ) : (
        <>
          <button type="button" {...approveLook} disabled={busy !== null} onClick={() => void decide('approve')}>{busy === 'approve' ? 'Approving…' : 'Approve'}</button>
          <button type="button" className="ask-button quiet" disabled={busy !== null} onClick={() => { setAsking(true); }}>Reject</button>
        </>
      )}
      {problem && <span className="ask-problem" role="alert">{problem}</span>}
    </div>
  );
}

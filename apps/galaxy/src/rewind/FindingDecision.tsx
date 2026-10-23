'use client';
import { useState } from 'react';
import type { DecisionReply } from './rewind.contract';
import { decideFinding } from './rewind.client';

// Approve and Reject on a proposed finding of the Main tab (PRD 2410, s7), shown to the members who read it:
// one click each, a reason for a Reject optional. Once decided it says so, with what Approve sent (or why not,
// and what to run instead); the page read again shows who decided and when, and no button. A refusal (already
// decided by someone else meanwhile, signed out) shows the route's own words.

export function FindingDecision({ finding }: { finding: string }) {
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [reason, setReason] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [decided, setDecided] = useState<DecisionReply | null>(null);

  async function decide(verdict: 'approve' | 'reject') {
    if (busy) return;
    setBusy(verdict);
    setProblem(null);
    const why = reason.trim();
    const done = await decideFinding(verdict === 'reject' && why !== '' ? { finding, verdict, reason: why } : { finding, verdict });
    if (done.ok) setDecided(done.reply);
    else setProblem(done.error);
    setBusy(null);
  }

  if (decided) {
    const followUp = decided.followUp;
    return (
      <p className="main-finding-decided" role="status">
        <strong>{decided.state === 'approved' ? 'Approved' : 'Rejected'}</strong>
        {followUp && <> · {followUp.words}{followUp.link && <> <a href={followUp.link} {...(followUp.link.startsWith('https://') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>See it</a></>}</>}
      </p>
    );
  }

  return (
    <div className="main-finding-decide">
      <button type="button" className="ask-button" disabled={busy !== null} onClick={() => void decide('approve')}>{busy === 'approve' ? 'Approving…' : 'Approve'}</button>
      <input
        type="text" className="ask-share-link" maxLength={500} value={reason} disabled={busy !== null}
        placeholder="Why reject it (optional)" aria-label="Why reject it (optional)"
        onChange={(event) => { setReason(event.target.value.replace(/[\r\n]+/g, ' ')); }}
      />
      <button type="button" className="ask-button quiet" disabled={busy !== null} onClick={() => void decide('reject')}>{busy === 'reject' ? 'Rejecting…' : 'Reject'}</button>
      {problem && <span className="ask-problem" role="alert">{problem}</span>}
    </div>
  );
}

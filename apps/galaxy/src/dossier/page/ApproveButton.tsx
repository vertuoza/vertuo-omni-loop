'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { APPROVAL_ROUTE } from './approval';

// Approve, on a ◆ PRD's page (PRD 1299 s3), shown to a member while it waits for approval or drifted:
// it approves as the signed-in person, through the approval route (src/approval/approval-api.ts), which
// pins the dossier's latest files and labels the PRD's issue, then re-renders the page, which reads the
// new approval in force. A refusal shows the route's own words.

export function ApproveButton({ dossier }: { dossier: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function approve() {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    try {
      const answer = await fetch(APPROVAL_ROUTE, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dossier }),
      });
      if (answer.ok) {
        router.refresh();
      } else {
        const body: unknown = await answer.json().catch(() => null);
        const error = typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string' ? body.error : null;
        setProblem(error ?? `The PRD was not approved (${answer.status}). Try again.`);
      }
    } catch {
      setProblem('The PRD was not approved. Check your connection and try again.');
    }
    setBusy(false);
  }

  return (
    <span className="dossier-approve">
      <button type="button" className="ask-button" disabled={busy} onClick={() => void approve()}>{busy ? 'Approving…' : 'Approve'}</button>
      {problem && <span className="ask-problem" role="alert">{problem}</span>}
    </span>
  );
}

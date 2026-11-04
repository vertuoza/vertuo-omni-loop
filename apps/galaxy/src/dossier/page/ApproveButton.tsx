'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { APPROVAL_ROUTE } from './approval';
import { refusalOf } from './refusal';
import { rememberApproved } from './SealScroll';

// Approve, on a ◆ PRD's page (PRD 1299 s3), shown to a member while it waits for approval or drifted:
// it approves as the signed-in person, through the approval route (src/approval/approval-api.ts), which
// pins the dossier's latest files and labels the PRD's issue, then re-renders the page, which reads the
// new approval in force, its seal brought into view (SealScroll, #1351). A refusal shows the route's own words.

export function ApproveButton({ dossier, noun = 'PRD', kind = 'product' }: { dossier: string; noun?: string; kind?: 'product' | 'tech' }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function approve() {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    try {
      const answer = await fetch(APPROVAL_ROUTE, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(kind === 'tech' ? { dossier, kind } : { dossier }),
      });
      if (answer.ok) {
        if (kind === 'product') rememberApproved(dossier);
        router.refresh();
      } else {
        setProblem(await refusalOf(answer, `The ${noun} was not approved (${answer.status}). Try again.`));
      }
    } catch {
      setProblem(`The ${noun} was not approved. Check your connection and try again.`);
    }
    setBusy(false);
  }

  return (
    <span className="dossier-approve">
      <button type="button" className="ask-button dossier-approve-button" disabled={busy} onClick={() => void approve()}>{busy ? 'Approving…' : kind === 'tech' ? 'Give Tech Approval' : 'Approve'}</button>
      {problem && <span className="ask-problem" role="alert">{problem}</span>}
    </span>
  );
}

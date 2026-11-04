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
// PRD 2632 s4: `off` turns it off, saying why beside it: the latest spec breaks a business law.

export function ApproveButton({ dossier, noun = 'PRD', kind = 'product', off = null }: { dossier: string; noun?: string; kind?: 'product' | 'tech'; off?: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const offId = `dossier-approve-off-${dossier}`;

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
      <button type="button" className="ask-button dossier-approve-button" disabled={busy || off !== null} aria-describedby={off === null ? undefined : offId} onClick={() => void approve()}>{busy ? 'Approving…' : kind === 'tech' ? 'Give Tech Approval' : 'Approve'}</button>
      {off !== null && <span id={offId} className="ask-hint">{off}</span>}
      {problem && <span className="ask-problem" role="alert">{problem}</span>}
    </span>
  );
}

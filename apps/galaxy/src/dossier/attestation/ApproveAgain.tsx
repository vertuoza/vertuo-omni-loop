'use client';
import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { approveAgain } from './attestation.client';

// Approve again, on a drifted attestation (PRD 1612 s4), for a member the product lets approve: it
// approves as the signed-in person through the PRD page's approval route, which pins the dossier's latest
// files and labels the PRD's issue, then re-renders the page, judged again against the same head. A
// refusal shows the route's own words.

export function ApproveAgain({ dossier }: { dossier: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [refusal, setRefusal] = useState<string | null>(null);

  const onApprove = () => {
    startTransition(async () => {
      const said = await approveAgain(dossier, fetch);
      setRefusal(said);
      if (said === null) router.refresh();
    });
  };

  return (
    <span className="attestation-approve">
      <button type="button" className="ask-button" disabled={pending} onClick={onApprove}>{pending ? 'Approving…' : 'Approve again'}</button>
      {refusal !== null && <span className="ask-problem" role="alert">{refusal}</span>}
    </span>
  );
}

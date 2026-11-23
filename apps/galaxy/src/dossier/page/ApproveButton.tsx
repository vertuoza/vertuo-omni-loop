'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Stack } from '@omni/ui';
import { APPROVAL_ROUTE } from './approval';
import { refusalOf } from './refusal';
import { rememberApproved } from './SealScroll';

// Approve, on a ◆ PRD's page (PRD 1299 s3), shown to a member while it waits for approval or drifted:
// it approves as the signed-in person, through the approval route (src/approval/approval-api.ts), which
// pins the dossier's latest files and labels the PRD's issue, then re-renders the page, which reads the
// new approval in force, its seal brought into view (SealScroll, #1351). A refusal shows the route's own words.
// PRD 2632 s4: `off` turns it off, saying why beside it: the latest spec breaks a business law.
// PRD omni-loop-20 s5: on the review screen (../review/) it is the decision bar's one primary, and, once
// approved, takes the viewer to `returnTo`, the PRD's page. It posts what it posts on the page, word for word.

export type ApprovalKind = 'product' | 'tech';

/** What Approve sends: the dossier alone for a product approval, so the route pins its latest files (BL-APPROVALS-1), and the kind for a Tech Approval. */
export const approvalBody = (dossier: string, kind: ApprovalKind) => JSON.stringify(kind === 'tech' ? { dossier, kind } : { dossier });

/** Posts the approval of `dossier` to the approval route, as the signed-in person. */
export function postApproval(dossier: string, kind: ApprovalKind, send: typeof fetch = fetch): Promise<Response> {
  return send(APPROVAL_ROUTE, { method: 'POST', headers: { 'content-type': 'application/json' }, body: approvalBody(dossier, kind) });
}

type Props = {
  dossier: string;
  noun?: string;
  kind?: ApprovalKind;
  off?: string | null;
  /** Where the viewer goes once it is approved; left out, the page re-renders where it is. */
  returnTo?: string | undefined;
  /** `review`: the review screen's primary, whose reason for being off its decision bar says. */
  look?: 'page' | 'review';
};

export function ApproveButton({ dossier, noun = 'PRD', kind = 'product', off = null, returnTo, look = 'page' }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const offId = `dossier-approve-off-${dossier}`;
  const label = busy ? 'Approving…' : kind === 'tech' ? 'Give Tech Approval' : 'Approve';

  async function approve() {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    try {
      const answer = await postApproval(dossier, kind);
      if (answer.ok) {
        if (kind === 'product') rememberApproved(dossier);
        if (returnTo === undefined) router.refresh();
        else router.push(returnTo);
      } else {
        setProblem(await refusalOf(answer, `The ${noun} was not approved (${answer.status}). Try again.`));
      }
    } catch {
      setProblem(`The ${noun} was not approved. Check your connection and try again.`);
    }
    setBusy(false);
  }

  if (look === 'review') {
    return (
      <Stack direction="row" gap="2" align="center" wrap>
        <Button variant="primary" disabled={busy || off !== null} onClick={() => void approve()}>{label}</Button>
        {problem && <span className="ask-problem" role="alert">{problem}</span>}
      </Stack>
    );
  }
  return (
    <span className="dossier-approve">
      <button type="button" className="ask-button dossier-approve-button" disabled={busy || off !== null} aria-describedby={off === null ? undefined : offId} onClick={() => void approve()}>{label}</button>
      {off !== null && <span id={offId} className="ask-hint">{off}</span>}
      {problem && <span className="ask-problem" role="alert">{problem}</span>}
    </span>
  );
}

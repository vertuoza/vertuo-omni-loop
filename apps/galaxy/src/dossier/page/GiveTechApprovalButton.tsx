'use client';
import { ApproveButton } from './ApproveButton';

// Give Tech Approval, on a ◆ PRD's approve screen (PRD 2608 s4), shown to the one member the PRD's Tech
// Approval request names: it posts a `tech` approval to the approval route, which the database accepts from
// that person only, then re-renders the page.
// PRD omni-loop-20 s5: on the review screen it is the decision bar's primary, and takes the viewer to
// `returnTo`, the PRD's page, once given. A red business-law verdict never turns it off (BR-PRODUCT-129).

export function GiveTechApprovalButton({ dossier, returnTo, look = 'page' }: { dossier: string; returnTo?: string | undefined; look?: 'page' | 'review' }) {
  return <ApproveButton dossier={dossier} kind="tech" look={look} returnTo={returnTo} />;
}

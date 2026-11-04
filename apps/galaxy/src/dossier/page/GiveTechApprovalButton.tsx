'use client';
import { ApproveButton } from './ApproveButton';

// Give Tech Approval, on a ◆ PRD's approve screen (PRD 2608 s4), shown to the one member the PRD's Tech
// Approval request names: it posts a `tech` approval to the approval route, which the database accepts from
// that person only, then re-renders the page.

export function GiveTechApprovalButton({ dossier }: { dossier: string }) {
  return <ApproveButton dossier={dossier} kind="tech" />;
}

'use client';
import { useEffect } from 'react';

// After Approve (#1351): the page re-renders with the seal where the approve screen was, and this brings it
// into view, once, when the approval was just given from this tab. ApproveButton leaves the dossier's id
// in sessionStorage for it; a seal seen any other way stays where the page puts it.

/** The sessionStorage key the approved dossier's id is kept under. */
const JUST_APPROVED = 'omni-just-approved';

/** Remembers, for this tab, that `dossier` was just approved here, so its seal comes into view. */
export function rememberApproved(dossier: string): void {
  try {
    sessionStorage.setItem(JUST_APPROVED, dossier);
  } catch {
    // No storage: the seal shows where the page puts it.
  }
}

export function SealScroll({ dossier }: { dossier: string }) {
  useEffect(() => {
    try {
      if (sessionStorage.getItem(JUST_APPROVED) !== dossier) return;
      sessionStorage.removeItem(JUST_APPROVED);
    } catch {
      return;
    }
    document.getElementById('approval')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [dossier]);
  return null;
}

'use client';
import { useSyncExternalStore } from 'react';

// Ported from archive/outbox-answers-v1:apps/galaxy/src/outbox/ContextDisclosure.tsx (PRD 251, s9).
//
// The context rail's disclosure (PRD 251, "The Outbox tab"): on a wide screen the rail sits open beside
// the questions and its summary is hidden; on a tall one it is a Context disclosure above them, closed
// until the person opens it. The server renders it open — what a wide screen shows, and what a page
// shows before any script runs — and the browser closes it on a narrow screen.

/** The width from which the rail sits beside the questions; dossier.css uses the same. */
export const WIDE = '(min-width: 960px)';

/** Follows the screen's width: calls `change` whenever it crosses WIDE. */
export function subscribe(change: () => void) {
  const media = window.matchMedia(WIDE);
  media.addEventListener('change', change);
  return () => media.removeEventListener('change', change);
}

/** Whether the rail sits open beside the questions: in the browser, the screen is wide; on the server, yes. */
export const isWide = () => window.matchMedia(WIDE).matches;
const onServer = () => true;

export function ContextDisclosure({ children }: { children: React.ReactNode }) {
  const wide = useSyncExternalStore(subscribe, isWide, onServer);
  return (
    // `key` remounts the element when the width crosses the line, so `open` applies again.
    <details key={wide ? 'wide' : 'tall'} className="outbox-context" open={wide} aria-label="Context">
      <summary>Context</summary>
      {children}
    </details>
  );
}

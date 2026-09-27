'use client';
import { useSyncExternalStore } from 'react';

// The context rail's disclosure (PRD 251, "The Outbox tab"): on a wide screen the rail sits open beside
// the questions and its summary is hidden; on a tall one it is a Context disclosure above them, closed
// until the person opens it. The server renders it open — what a wide screen shows, and what a page
// shows before any script runs — and the browser closes it on a narrow screen.

/** The width from which the rail sits beside the questions; outbox.css uses the same. */
export const WIDE = '(min-width: 960px)';

function subscribe(change: () => void) {
  const media = window.matchMedia(WIDE);
  media.addEventListener('change', change);
  return () => media.removeEventListener('change', change);
}

export function ContextDisclosure({ children }: { children: React.ReactNode }) {
  const wide = useSyncExternalStore(subscribe, () => window.matchMedia(WIDE).matches, () => true);
  return (
    // `key` remounts the element when the width crosses the line, so `open` applies again.
    <details key={wide ? 'wide' : 'tall'} className="outbox-context" open={wide} aria-label="Context">
      <summary>Context</summary>
      {children}
    </details>
  );
}

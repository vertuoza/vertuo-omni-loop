import type { DocumentKind } from '../waiting/documents';

// The words the Inbox page's list shares with what the top bar's bell (PRD 499) used to say. The bell
// itself left the bar in omni-loop-22 (s7): below 900 px its slot is the Inbox button (AppBar.tsx), and the
// page (src/inbox/) draws what waits. What stayed is how long a wait has lasted, and how the kinds of a
// New documents group read.

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** How long a question has waited, as a person reads it: "just now", "3 min", "2 h", "3 d". */
export function waitedFor(ms: number): string {
  if (ms < MIN) return 'just now';
  if (ms < HOUR) return `${Math.floor(ms / MIN)} min`;
  if (ms < DAY) return `${Math.floor(ms / HOUR)} h`;
  return `${Math.floor(ms / DAY)} d`;
}

const KIND_WORDS: Record<DocumentKind, string> = { spec: 'spec', plan: 'plan', 'before-after': 'before/after' };

/** The kinds that landed, as a line reads them: `spec, plan, before/after`. */
export const kindWords = (kinds: readonly DocumentKind[]) => kinds.map((k) => KIND_WORDS[k]).join(', ');

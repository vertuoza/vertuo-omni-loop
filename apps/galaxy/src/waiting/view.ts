import type { WaitingQuestion } from './waiting';

// What the server hands the waiting provider (PRD 499), safe to import from the browser: the Questions
// part as the page rendered it, and where the browser reads it again.

/** Where the browser reads the Questions part again: the bell's routes, as `me`, or the demo, which does
 * not change. Since PRD 1318 (s4) the browser no longer uses `url` and `key`; the app shell still
 * fills them. */
export type WaitingSource = { kind: 'database'; url: string; key: string; me: string } | { kind: 'demo' };

export interface WaitingView {
  /** The Questions part as the page rendered it. */
  questions: WaitingQuestion[];
  /** The server could not read it: the page starts with none, and the browser tries again. */
  unread: boolean;
  /** Null when the browser has nowhere to read it from. */
  source: WaitingSource | null;
}

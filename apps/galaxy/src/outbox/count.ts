// What the page read of a dossier's latest outbox (PRD 251), and the Outbox tab's `n open`. Apart from
// tab.ts, which reads the items through the kit's parser and renders them on the server, so that the
// dossier's page model (src/dossier/page/view.ts), which a browser component imports too, stays free of
// the kit and the markdown renderer.
import { StoredOutbox } from './contract';
import type { OutboxRow } from './store';

/** What the page read: the dossier's latest outbox (null: none yet), or a read that failed. */
export type OutboxRead = { row: OutboxRow | null } | { failed: true };

/** The Outbox tab's `n open`: the open questions while the pull request is open; 0 otherwise. */
export function openCount(read: OutboxRead): number {
  if ('failed' in read || !read.row || read.row.state !== 'open') return 0;
  const stored = StoredOutbox.safeParse(read.row.outbox);
  return stored.success ? stored.data.open.length : 0;
}

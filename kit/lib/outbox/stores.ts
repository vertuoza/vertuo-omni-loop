// Which store a PRD's outbox lives in (PRD 1548, slice s6). Today every PRD's outbox is in git:
// slice s7 picks the `server` store here, by the PRD's birthplace, behind the same `OutboxStore`.
import type { Context } from '../context.ts';
import { gitOutboxStore } from './git-store.ts';
import type { OutboxStore } from './store.ts';

/** The store every outbox verb of the repository `ctx` reads and writes through. */
export function outboxStore(ctx: Context): OutboxStore {
  return gitOutboxStore(ctx);
}

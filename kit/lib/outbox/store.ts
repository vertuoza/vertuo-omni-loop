// The outbox store seam (PRD 1548, slice s6): every outbox verb (`omni item`, `adopt`, `settle`,
// `status <prd>`, `answers`, `replies`, `comment`) reads and writes a PRD's outbox through one
// `OutboxStore`, never the filesystem. The `git` store (`./git-store.ts`) is today's files: open
// items under the PRD's outbox folder, `settled.md` beside them. A store's methods are async, so a
// store that answers over the network meets the same shape: slice s7's `server` store
// (`./server-store.ts`), a product PRD's rows on the Omni page. Types only: `./stores.ts` picks the
// store a PRD's outbox lives in, by the PRD's birthplace.
import type { OutboxItemId, PrdNumber, ProductPrdId } from '../ids.ts';
import type { Laws } from '../laws.ts';
import type { OutboxItem } from '../types.ts';
import type { CommentClient, SettledEntryView, upsertOutboxComment, upsertOutboxPrComment } from './comment.ts';
import type { readReplies } from './replies.ts';
import type { relayFolder } from './relay.ts';
import type { adoptItem, settleItem } from './settle.ts';
import type { GateResult, gateResult } from './status.ts';

/** A PRD a store holds the outbox of: a repository's, by its number, or a product's (`mobile-12`, PRD
 * 1548). The `git` store holds only the first, the `server` store only the second. */
export type OutboxPrd = PrdNumber | ProductPrdId;

/** An open item's text, or why it could not be read: no such item, a folder, or no permission. */
export type ItemRead = { ok: true; text: string } | { ok: false; code: 'ENOENT' | 'EISDIR' | 'EACCES' };

/** A folder outside the store an item is written to instead (`omni item new --out`): where it is,
 * and how the caller spelled it. */
export type OutFolder = { abs: string; shown: string };

/** What the outbox gate is graded against besides the items: the PR's labels, the changes of its
 * range, and the knowledge at the range's base. */
export type GateOptions = Omit<Parameters<typeof gateResult>[1], 'ctx'>;

/** What `omni replies` asks: the PRD, its feature pull request, and whether to post the next round. */
export type RepliesRequest = Omit<Parameters<typeof readReplies>[0], 'ctx' | 'prd'> & { prd: OutboxPrd };

/** The GitHub comments `omni replies` reads and posts through. */
export type RepliesClient = Parameters<typeof readReplies>[1];

/** What the PRD-issue outbox comment is written from, besides the outbox. */
export type IssueCommentRequest = Omit<Parameters<typeof upsertOutboxComment>[0], 'ctx' | 'prd'> & { prd: OutboxPrd };

/** One PRD outbox's home, as every outbox verb reaches it. */
export type OutboxStore = {
  /** The text of the open item held at `ref`: for the `git` store, a path in the repository; for the
   * `server` store, `<prd>/<item id>` as it wrote it, or the item's id. */
  readItem(ref: string): Promise<ItemRead>;
  /** Removes the open item held at `ref`, once its entry is in the ledger. */
  removeItem(ref: string): Promise<void>;
  /** Every item id PRD `prd` has spent, open or settled, and those `out` already holds. */
  spentIds(prd: OutboxPrd, out: OutFolder | null): Promise<Set<string>>;
  /** Writes a new open item of PRD `prd`, or into `out`; resolves to where it went, as shown. */
  writeItem(item: { prd: OutboxPrd; id: OutboxItemId; text: string }, out: OutFolder | null): Promise<string>;
  /** Adopts a medium item straight to its PRD's ledger. */
  adopt(itemText: string): Promise<ReturnType<typeof adoptItem>>;
  /** Settles the open item held at `ref` with `answer`, and removes it. */
  settle(ref: string, answer: unknown): Promise<ReturnType<typeof settleItem>>;
  /** Moves every item and account of the folder `dir` into PRD `prd`'s outbox; `null` when `dir`
   * is not a folder. */
  relay(prd: OutboxPrd, dir: string, laws: Laws): Promise<ReturnType<typeof relayFolder> | null>;
  /** The outbox gate of PRD `prd`. */
  gate(prd: OutboxPrd, options: GateOptions): Promise<GateResult>;
  /** Every open item of PRD `prd`, unsorted. */
  openItems(prd: OutboxPrd): Promise<OutboxItem[]>;
  /** Every entry of PRD `prd`'s ledger adopted without an answer. */
  adoptedEntries(prd: OutboxPrd): Promise<SettledEntryView[]>;
  /** Reads the replies on the feature pull request and settles what they answer. */
  replies(request: RepliesRequest, client: RepliesClient): Promise<ReturnType<typeof readReplies>>;
  /** Writes the outbox comment on the feature pull request of PRD `prd`. */
  prComment(prd: OutboxPrd, client: CommentClient): Promise<ReturnType<typeof upsertOutboxPrComment>>;
  /** Writes the outbox comment on PRD `request.prd`'s issue. */
  issueComment(request: IssueCommentRequest, client: CommentClient): Promise<ReturnType<typeof upsertOutboxComment>>;
};

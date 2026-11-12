// PRD 2739, s3: the ship step refuses a PRD whose review promised a point for later and did not keep
// it. It reads the review threads of the PRD's feature PR and of its merged sub-PRs through the loop's
// reads (the reader `omni care` uses, PRD 1665) and, for each thread a `later` care reply answered,
// asks for two things: a follow-up file of source `PRD #<n> · <thread url>`, and an outbox item of PRD n
// naming that thread url, open or answered. An item a person answered "fix it now" (drifted) needs no
// file: the rework deletes it. When the threads cannot be read the verdict is `not judged`, never a pass
// (BL-GATE-1).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fillBranch } from '../board.ts';
import { replyFirstWords, reviewSource, threadUrl } from '../care/later.ts';
import { readCareVerdict } from '../care/marker.ts';
import { prdReviews } from '../care/threads.ts';
import type { Context } from '../context.ts';
import { FOLLOW_UPS_DIR, readFollowUps } from '../follow-ups/follow-ups.ts';
import type { PrdNumber, PrNumber } from '../ids.ts';
import { parseFolderName } from '../layout.ts';
import type { LoopChangeDetail } from '../loop-reads/contract.ts';
import { LoopReadError } from '../loop-reads/port.ts';
import type { LoopReads } from '../loop-reads/port.ts';
import { SETTLED_FILE } from '../outbox/outbox.ts';
import { parseSettledEntries } from '../outbox/settle.ts';
import { openItemFiles } from '../outbox/status.ts';

/** What the review gate found: the reasons a PRD cannot ship (none: it may), or why it could not judge. */
export type ReviewVerdict = { judged: true; reasons: string[] } | { judged: false; why: string };

/** A thread a `later` reply answered: its pull request's number, its url, and the reply. */
type Promised = { pr: PrNumber; url: string; reply: string };

/** An outbox item of the PRD, as the gate reads it: its text, and the verdict a person gave, if any. */
type ItemText = { text: string; verdict: string | null };

/** The threads of `change` a `later` care reply answered. */
function promisedIn(change: LoopChangeDetail): Promised[] {
  return change.review.threads.flatMap((thread) => {
    const reply = thread.comments.find((comment) => readCareVerdict(comment.body) === 'later');
    if (reply === undefined) return [];
    return [{ pr: change.number, url: threadUrl(change.url, thread.id), reply: reply.body }];
  });
}

/** Every item of PRD `prd`: its open item files, then the items its ledger settled, with their verdict. */
function itemsOf(ctx: Context, prd: PrdNumber): ItemText[] {
  const open = openItemFiles(prd, { ctx }).map((file) => ({ text: readFileSync(join(ctx.root, file), 'utf8'), verdict: null }));
  const dir = ctx.layout.outboxDir(prd);
  const ledger = dir === null ? null : join(ctx.root, dir, SETTLED_FILE);
  if (ledger === null || !existsSync(ledger)) return open;
  const settled = parseSettledEntries(readFileSync(ledger, 'utf8'), ctx.markers).map((entry) => ({ text: entry.itemText, verdict: entry.verdict ?? null }));
  return [...open, ...settled];
}

/** Whether `text` names `url` whole: a thread's url never matches another one it is the start of. */
function names(text: string, url: string): boolean {
  let at = text.indexOf(url);
  for (; at !== -1; at = text.indexOf(url, at + 1)) {
    if (!/[\w-]/.test(text.charAt(at + url.length))) return true;
  }
  return false;
}

/** Why `promised` holds the PRD: no follow-up file of its thread, no outbox item of it, or neither. */
function reasonsFor(promised: Promised, { prd, sources, items }: { prd: PrdNumber; sources: ReadonlySet<string>; items: readonly ItemText[] }): string[] {
  const words = replyFirstWords(promised.reply);
  const source = reviewSource(prd, promised.url);
  const item = items.find((one) => names(one.text, promised.url));
  const reasons: string[] = [];
  if (item?.verdict !== 'drifted' && !sources.has(source)) {
    reasons.push(`PR #${promised.pr}: the reply "${words}" promised a follow-up that has no file: omni follow-up add --source '${source}' --text '…'`);
  }
  if (item === undefined) reasons.push(`PR #${promised.pr}: the reply "${words}" postpones a person's comment with no outbox item: a person must agree to it`);
  return reasons;
}

/** The review gate of shipping PRD `prd`, read through `reads`. */
export async function reviewPromises(ctx: Context, prd: PrdNumber, reads: LoopReads): Promise<ReviewVerdict> {
  const where = ctx.layout.whereIs(prd);
  const topic = where === null ? null : parseFolderName(where.name)?.topic;
  if (topic === undefined || topic === null) return { judged: true, reasons: [] };
  const repo = ctx.config.repo.slug;
  if (repo === null) return { judged: false, why: 'no repository slug (repo.slug)' };
  let changes: LoopChangeDetail[];
  try {
    changes = await prdReviews(repo, fillBranch(ctx.config.branches.feature, { topic }), reads, 'merged');
  } catch (error) {
    if (error instanceof LoopReadError) return { judged: false, why: error.line };
    throw error;
  }
  const promised = changes.flatMap(promisedIn);
  if (promised.length === 0) return { judged: true, reasons: [] };
  const sources = new Set(readFollowUps(join(ctx.root, ctx.config.paths.delivery, FOLLOW_UPS_DIR)).map((point) => point.source));
  const items = itemsOf(ctx, prd);
  return { judged: true, reasons: promised.flatMap((one) => reasonsFor(one, { prd, sources, items })) };
}

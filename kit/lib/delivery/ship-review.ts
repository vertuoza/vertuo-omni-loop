// PRD 2739, s3: the ship step refuses a PRD whose review promised a point for later and did not keep
// it. BR-PRODUCT-130: it reads no review thread. Every `later` care reply records an outbox item of PRD
// n naming its thread (`omni care reply --verdict later`, `later.ts`), so the promises are what the
// repository holds: the PRD's open items and the items its ledger settled. For each one a `later` reply
// wrote, it asks for a follow-up file of source `PRD #<n> · <thread url>`; an item a person answered
// "fix it now" (drifted) needs none: the rework deletes it. A PRD with no review has no such item, so it
// is never held here and never `not judged`.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readPostponed, replyFirstWords, reviewSource } from '../care/later.ts';
import type { Context } from '../context.ts';
import { FOLLOW_UPS_DIR, readFollowUps } from '../follow-ups/follow-ups.ts';
import type { PrdNumber } from '../ids.ts';
import { SETTLED_FILE } from '../outbox/outbox.ts';
import { parseSettledEntries } from '../outbox/settle.ts';
import { openItemFiles } from '../outbox/status.ts';

/** An outbox item of the PRD, as the gate reads it: its text, and the verdict a person gave, if any. */
type ItemText = { text: string; verdict: string | null };

/** The pull request a thread url names (`…/pull/<n>#<thread>`), as `PR #<n>`; the url when none. */
function pullOf(url: string): string {
  const number = /\/pull\/(\d+)#[^#]*$/.exec(url)?.[1];
  return number === undefined ? url : `PR #${number}`;
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

/** The reasons the review promises hold PRD `prd` from shipping: none when it may ship. */
export function reviewPromises(ctx: Context, prd: PrdNumber): string[] {
  const promised = itemsOf(ctx, prd).flatMap(({ text, verdict }) => {
    const point = readPostponed(text);
    return point === null || verdict === 'drifted' ? [] : [point];
  });
  if (promised.length === 0) return [];
  const sources = new Set(readFollowUps(join(ctx.root, ctx.config.paths.delivery, FOLLOW_UPS_DIR)).map((point) => point.source));
  return promised.flatMap(({ url, note }) => {
    const source = reviewSource(prd, url);
    if (sources.has(source)) return [];
    return [`${pullOf(url)}: the reply "${replyFirstWords(note)}" promised a follow-up that has no file: omni follow-up add --source '${source}' --text '…'`];
  });
}

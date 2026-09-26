/**
 * **What to harvest** (PRD #82, slice s3). A PRD's ledger, `settled.md` in its outbox directory,
 * holds every decision the PRD took. The harvest writes back the ones not written back yet: for
 * each id, the **latest** settled entry (the ledger's "latest wins" rule, read through
 * `parseSettledEntries`) that carries neither a `Became:` line nor a `Stays here:` line.
 *
 * Pure at its core: {@link candidatesFromLedger} takes the ledger's text, so a caller that reads
 * files from somewhere other than a working tree (the app, from a snapshot of the default branch)
 * gets the same candidates as {@link harvestCandidates}, which reads the working tree.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SETTLED_FILE, parseOutboxItem } from '../outbox/outbox.mjs';
import { parseSettledEntries } from '../outbox/settle.mjs';

/** The two ledger lines that say an entry was written back already. */
export const BECAME_FIELD = 'Became';
export const STAYS_HERE_FIELD = 'Stays here';

/** Whether a parsed settled entry was already written back: a `Became:` or a `Stays here:` line. */
export function writtenBack(entry) {
  return entry.became.length > 0 || (entry.fields[STAYS_HERE_FIELD] ?? '').trim().length > 0;
}

/**
 * One settled entry, as the harvest needs it: `{ id, ledgerFile, item, itemText, answer, verdict,
 * approvedBy, approvedAt, channel, channelUrl, rank }`. `item` is the embedded item parsed (its
 * sections, its PRD), `null` when the embedded text no longer parses: the candidate is still listed,
 * its text still carried, so no decision is dropped silently.
 */
function toCandidate(entry, ledgerFile) {
  const parsed = parseOutboxItem(entry.itemText, { file: null });
  return {
    id: entry.id,
    ledgerFile,
    item: parsed.ok ? parsed.item : null,
    itemText: entry.itemText,
    answer: entry.answerText,
    verdict: entry.verdict ?? null,
    approvedBy: entry.fields['Approved by'] ?? null,
    approvedAt: entry.fields['Approved at'] ?? null,
    channel: entry.fields.Channel ?? null,
    channelUrl: entry.fields['Channel URL'] ?? null,
    closed: entry.fields.Closed ?? null,
    rank: entry.fields.Rank ?? parsed.item?.rank ?? null,
  };
}

/**
 * The candidates in a ledger's text, in ledger order: the latest entry per id that was not written
 * back. Pure.
 *
 * @param {string} text the ledger's text
 * @param {{ markers: object, ledgerFile?: string | null }} options `ledgerFile` is carried on every
 *   candidate, for its `Source:` line
 */
export function candidatesFromLedger(text, { markers, ledgerFile = null }) {
  return parseSettledEntries(text, markers)
    .filter((entry) => !writtenBack(entry))
    .map((entry) => toCandidate(entry, ledgerFile));
}

/**
 * The candidates of PRD `prd`, read from the working tree: `[]` when the PRD has no outbox
 * directory or no ledger yet.
 */
export function harvestCandidates({ ctx, prd }) {
  const outboxDir = ctx.layout.outboxDir(prd);
  if (outboxDir === null) return [];
  const ledgerFile = `${outboxDir}/${SETTLED_FILE}`;
  const absolute = join(ctx.root, ledgerFile);
  if (!existsSync(absolute)) return [];
  return candidatesFromLedger(readFileSync(absolute, 'utf8'), { markers: ctx.markers, ledgerFile });
}

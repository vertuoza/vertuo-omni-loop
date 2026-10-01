// @ts-nocheck
/**
 * **A merge over a red outbox adopts what is still open** (PRD #82, slice s2).
 *
 * A feature pull request can merge while its outbox is red — under the override label, or where
 * branch protection is off. The merge is a person's decision, and this unit records it: every open
 * item (any rank) gets one `adopted` entry approved by the person who merged, at the merge time,
 * through the feature pull request, with basis `merged-over-red`; and every `drifted` entry never
 * reworked gets one more `adopted` entry the same way, which wins by the ledger's "latest wins"
 * rule — the answer that asked for something else stays above it.
 *
 * **Pure over the tree `ctx` is rooted at: it returns text and touches no file.** The caller (the
 * harvest pipeline, locally or in the app) writes `text` to `settledFile` and deletes `deletes`,
 * together. The ledger stays append-only: `text` is the existing ledger, byte for byte, followed by
 * `append`.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { readRepoFile } from '../check-report.ts';
import { SETTLED_FILE, parseOutboxItem } from './outbox.ts';
import {
  ADOPTED_VERDICT,
  parseSettledEntries,
  renderSettledEntry,
  settledHeader,
} from './settle.ts';
import { openItemFiles } from './status.ts';
import { KIT_MESSAGES } from '../schema/messages.ts';

/** The basis every entry settled at the merge carries. */
export const MERGED_OVER_RED_BASIS = 'merged-over-red';

const MERGED_OVER_RED_REASON =
  'the feature pull request merged while this item was open; merging adopts what was built';

/** The merge's facts, read from the pull request itself. */
export const MergeSchema = z
  .object({
    by: z
      .string()
      .trim()
      .transform((login) => login.replace(/^@/, ''))
      .pipe(z.string().min(1, 'merge.by is required — who merged')),
    at: z
      .string()
      .regex(
        /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})?)?$/,
        'merge.at must be an ISO date or date-time',
      ),
    pr: z.coerce.number({ message: 'merge.pr must be a number' }).int().positive(),
    url: z.string().trim().min(1).optional(),
  })
  .strict();

function mergeAnswer(merge) {
  return {
    approvedBy: `@${merge.by}`,
    approvedAt: merge.at,
    channel: {
      kind: 'feature-pull-request',
      number: merge.pr,
      ...(merge.url ? { url: merge.url } : {}),
    },
    text: `Adopted when @${merge.by} merged feature pull request #${merge.pr} while this item was open.`,
  };
}

const JUDGEMENT = {
  verdict: ADOPTED_VERDICT,
  basis: MERGED_OVER_RED_BASIS,
  reason: MERGED_OVER_RED_REASON,
};

/** The item a drifted entry carries, from its own recorded fields — the item text is kept whole. */
function itemFromEntry(entry) {
  const { fields } = entry;
  return {
    id: entry.id,
    rank: fields.Rank,
    bearsOn: fields['Bears on'],
    raised: fields.Raised,
    slice: fields.Slice,
    wave: fields.Wave,
  };
}

/**
 * @param {{ ctx: object, prd: string | number, merge: { by: string, at: string, pr: number, url?: string } }} input
 * @returns {{ ok: true, settledFile: string, entries: { id: string, from: 'open' | 'drift', entry: string }[],
 *   append: string, text: string | null, deletes: string[] } | { ok: false, errors: string[] }}
 */
export function settleAtMerge({ ctx, prd, merge }) {
  const parsedMerge = MergeSchema.safeParse(merge, { error: KIT_MESSAGES });
  if (!parsedMerge.success) {
    return { ok: false, errors: parsedMerge.error.issues.map((issue) => issue.message) };
  }
  const facts = parsedMerge.data;

  const outboxDir = ctx.layout.outboxDir(prd);
  if (outboxDir === null) {
    return { ok: false, errors: [`PRD ${prd} has no inbox or shipped folder`] };
  }

  const settledFile = `${outboxDir}/${SETTLED_FILE}`;
  const existing = existsSync(join(ctx.root, settledFile)) ? readRepoFile(ctx, settledFile) : null;
  const answer = mergeAnswer(facts);
  const errors = [];
  const entries = [];
  const deletes = [];

  for (const file of openItemFiles(prd, { ctx })) {
    const itemText = readRepoFile(ctx, file);
    const parsed = parseOutboxItem(itemText, { file });
    if (!parsed.ok) {
      errors.push(...parsed.errors);
      continue;
    }
    const entry = renderSettledEntry({
      item: parsed.item,
      itemText,
      answer,
      judgement: JUDGEMENT,
      markers: ctx.markers,
      closed: `yes — adopted at the merge by @${facts.by}`,
    });
    entries.push({ id: parsed.item.id, from: 'open', entry });
    deletes.push(file);
  }
  if (errors.length > 0) return { ok: false, errors };

  const drifted = existing === null ? [] : parseSettledEntries(existing, ctx.markers);
  for (const settled of drifted) {
    if (settled.verdict !== 'drifted' || settled.closed) continue;
    const entry = renderSettledEntry({
      item: itemFromEntry(settled),
      itemText: settled.itemText,
      answer,
      judgement: JUDGEMENT,
      markers: ctx.markers,
      closed: `yes — merged without rework, by @${facts.by}`,
    });
    entries.push({ id: settled.id, from: 'drift', entry });
  }

  if (entries.length === 0) {
    return { ok: true, settledFile, entries, append: '', text: null, deletes };
  }

  const base = existing ?? settledHeader(prd, { ctx });
  const separator = base.endsWith('\n') ? '\n' : '\n\n';
  const append = `${separator}${entries.map((e) => e.entry).join('\n')}`;
  return { ok: true, settledFile, entries, append, text: `${base}${append}`, deletes };
}

/**
 * **The committee's record line** (PRD 2896 s9): the one line of a `/omni:committee` job's log the App reads back, from
 * the job's log tail, to record the decision as the service (BR-PRODUCT-94: never through a terminal token).
 *
 *   omni committee: {"v":1,"prd":2896,"kind":"approve","author":null,"read":[{"kind":"spec","sha256":"…"}, …],
 *                    "escalations":[],"verdicts":[{"role":"pm","answer":"yes","sentence":"…"}, …],"outcome":"carried"}
 *
 * A high outbox item's answer (PRD 2896 s10) is `"kind":"answer"`, with the `item` it answers and the `option` it settles
 * it with, its `read` the item file by its hash.
 *
 * `read` is each file the committee read, by its kind and hash, so a carried approval covers exactly those
 * (BL-APPROVALS-1); `escalations` what the list named; `verdicts` each member's, as recorded. The App never takes
 * `outcome` on trust: it decides again from the rest ({@link ./escalation.ts}). Only those fields are kept: never a
 * line of the log, a person's words or a credential (L-GDPR-2).
 */
import { z } from 'zod';
import { OutboxItemIdSchema, PrdNumberSchema, type PrdNumber } from '../ids.ts';
import { CommitteeRoleSchema, VerdictSchema, COMMITTEE_ROLES } from './vote.ts';

/** What the line starts with. */
const COMMITTEE_LINE = 'omni committee: ';

/** The most reasons a record carries, and the longest one. */
const REASONS_MAX = 10;
const REASON_MAX = 300;

const ReadFileSchema = z.object({ kind: z.string().regex(/^[a-z][a-z-]*$/).max(40), sha256: z.string().regex(/^[0-9a-f]{64}$/) });

/** What every record carries, an approval's or an answer's. */
const RECORD = {
  v: z.literal(1),
  prd: PrdNumberSchema,
  author: CommitteeRoleSchema.nullable(),
  read: z.array(ReadFileSchema).max(10),
  escalations: z.array(z.string().min(1).max(REASON_MAX)).max(REASONS_MAX),
  verdicts: z.array(VerdictSchema).max(COMMITTEE_ROLES.length + 1),
  outcome: z.enum(['carried', 'escalated']),
};

const CommitteeRecordSchema = z.discriminatedUnion('kind', [
  z.object({ ...RECORD, kind: z.literal('approve') }),
  z.object({ ...RECORD, kind: z.literal('answer'), item: OutboxItemIdSchema, option: z.string().regex(/^[A-Z]$/) }),
]);

export type CommitteeRecord = z.infer<typeof CommitteeRecordSchema>;

/** A record of the committee's approval of a PRD. */
export type ApprovalRecord = Extract<CommitteeRecord, { kind: 'approve' }>;

/** A record of the committee's answer to a high outbox item (PRD 2896 s10). */
export type AnswerRecord = Extract<CommitteeRecord, { kind: 'answer' }>;

/** The record as its one line. */
export const committeeLine = (record: CommitteeRecord): string => `${COMMITTEE_LINE}${JSON.stringify(record)}`;

const STAMP = /^\d{2}:\d{2}:\d{2} /;

/** Every record `log` holds that reads whole, the last first. */
function* recordsOf(log: string): Generator<CommitteeRecord> {
  for (const raw of log.split('\n').reverse()) {
    const line = raw.trim().replace(STAMP, '');
    if (!line.startsWith(COMMITTEE_LINE)) continue;
    let json: unknown;
    try {
      json = JSON.parse(line.slice(COMMITTEE_LINE.length));
    } catch {
      continue;
    }
    const parsed = CommitteeRecordSchema.safeParse(json);
    if (parsed.success) yield parsed.data;
  }
}

/** The last approval record `log` holds for PRD `prd`; null when it holds none that reads whole. */
export function committeeOf(log: string, prd: PrdNumber): ApprovalRecord | null {
  for (const record of recordsOf(log)) if (record.kind === 'approve' && record.prd === prd) return record;
  return null;
}

/** The last answer record `log` holds for item `item` of PRD `prd` (PRD 2896 s10); null when it holds none that reads whole. */
export function answerOf(log: string, prd: PrdNumber, item: string): AnswerRecord | null {
  for (const record of recordsOf(log)) if (record.kind === 'answer' && record.prd === prd && record.item === item) return record;
  return null;
}

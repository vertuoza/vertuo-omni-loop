/**
 * **The committee's record line** (PRD 2896 s9): the one line of a `/omni:committee` job's log the App reads back, from
 * the job's log tail, to record the decision as the service (BR-PRODUCT-94: never through a terminal token).
 *
 *   omni committee: {"v":1,"prd":2896,"kind":"approve","author":null,"read":[{"kind":"spec","sha256":"…"}, …],
 *                    "escalations":[],"verdicts":[{"role":"pm","answer":"yes","sentence":"…"}, …],"outcome":"carried"}
 *
 * `read` is each file the committee read, by its kind and hash, so a carried approval covers exactly those
 * (BL-APPROVALS-1); `escalations` what the list named; `verdicts` each member's, as recorded. The App never takes
 * `outcome` on trust: it decides again from the rest ({@link ./escalation.ts}). Only those fields are kept: never a
 * line of the log, a person's words or a credential (L-GDPR-2).
 */
import { z } from 'zod';
import { PrdNumberSchema, type PrdNumber } from '../ids.ts';
import { CommitteeRoleSchema, VerdictSchema, COMMITTEE_ROLES } from './vote.ts';

/** What the line starts with. */
const COMMITTEE_LINE = 'omni committee: ';

/** The most reasons a record carries, and the longest one. */
const REASONS_MAX = 10;
const REASON_MAX = 300;

const ReadFileSchema = z.object({ kind: z.string().regex(/^[a-z][a-z-]*$/).max(40), sha256: z.string().regex(/^[0-9a-f]{64}$/) });

const CommitteeRecordSchema = z.object({
  v: z.literal(1),
  prd: PrdNumberSchema,
  kind: z.literal('approve'),
  author: CommitteeRoleSchema.nullable(),
  read: z.array(ReadFileSchema).max(10),
  escalations: z.array(z.string().min(1).max(REASON_MAX)).max(REASONS_MAX),
  verdicts: z.array(VerdictSchema).max(COMMITTEE_ROLES.length + 1),
  outcome: z.enum(['carried', 'escalated']),
});

export type CommitteeRecord = z.infer<typeof CommitteeRecordSchema>;

/** The record as its one line. */
export const committeeLine = (record: CommitteeRecord): string => `${COMMITTEE_LINE}${JSON.stringify(record)}`;

const STAMP = /^\d{2}:\d{2}:\d{2} /;

/** The last record `log` holds for PRD `prd`; null when it holds none that reads whole. */
export function committeeOf(log: string, prd: PrdNumber): CommitteeRecord | null {
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
    if (parsed.success && parsed.data.prd === prd) return parsed.data;
  }
  return null;
}

/**
 * **The repair's record line** (PRD 2980, spec "2. `/omni:repair`", step 4).
 *
 * `/omni:repair` ends on one line the App reads back from the job's log, as it reads `omni pm:` (PRD 2896):
 *
 *   omni repair: {"v":1,"mission":12,"prd":2950,"fingerprint":"<hex>","class":"code","retro":{…},"fix":3001,"report":null}
 *
 * PRD 3065: a stuck repair (`"trigger":"stuck"`) names the PRD the cause sits in, or `null` when the cause is the mission's own; a line
 * with no `trigger` reads as `failure`, which always names its PRD.
 *
 * Bug #3302: a product PRD's repair names the PRD by its id (`"prd":"omni-loop-27"`), and its code fix, opened in one of the product
 * PRD's target repositories, names that repository (`"repo":"acme/web"`). A line with no `repo` names a fix in the mission's own.
 *
 * The last such line wins; a log with none, or whose last one does not read whole, is unreadable, and the mission counts that
 * repair as spent. A record agrees with its retro (its class and its fingerprint), carries a fix only for `code` and a report only
 * for `omni-loop`, and its report is clean. The App never takes the fingerprint on trust: it is computed again from the retro's
 * class, place and signature, so one cause keeps one fingerprint whatever the runner wrote.
 *
 * Pure: no filesystem, no network, no clock.
 */
import { z } from 'zod';
import { PrNumberSchema, PrdNumberSchema, ProductPrdIdSchema } from '../ids.ts';
import { FingerprintSchema, fingerprint } from './fingerprint.ts';
import { RepairClassSchema, RepairRetroSchema } from './retro.ts';
import { PublicReportSchema } from './scrub.ts';

/** What the line starts with. */
const REPAIR_LINE = 'omni repair: ';

/** A repository as GitHub names it, `owner/name`: the one a product PRD's fix was opened in. */
const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

/** The time stamp a runner's log puts before a line. */
const STAMP = /^\d{2}:\d{2}:\d{2} /;

const RepairRecordSchema = z
  .object({
    v: z.literal(1),
    mission: z.number().int().positive(),
    trigger: z.enum(['failure', 'stuck']).optional(),
    prd: z.union([PrdNumberSchema, ProductPrdIdSchema]).nullable(),
    fingerprint: FingerprintSchema,
    class: RepairClassSchema,
    retro: RepairRetroSchema,
    fix: PrNumberSchema.nullable(),
    repo: z.string().regex(REPO).optional(),
    report: PublicReportSchema.nullable(),
  })
  .refine((record) => record.prd !== null || record.trigger === 'stuck', 'only a stuck repair may name no PRD')
  .refine((record) => record.class === record.retro.class,'the record\'s class is its retro\'s')
  .refine((record) => record.fingerprint === record.retro.fingerprint, 'the record\'s fingerprint is its retro\'s')
  .refine((record) => record.fix === null || record.class === 'code', 'only a code repair has a fix')
  .refine((record) => record.repo === undefined || record.fix !== null, 'only a fix names its repository')
  .refine((record) => record.report === null || record.class === 'omni-loop', 'only an omni-loop repair has a report')
  .refine((record) => record.report === null || (record.report.class === record.class && record.report.fingerprint === record.fingerprint), 'the report is the record\'s');

/** What a repair job wrote for its mission. */
export type RepairRecord = z.infer<typeof RepairRecordSchema>;

/** A repair's record, or why the job's log gave none. */
export type RepairRead = { readable: true; record: RepairRecord } | { readable: false; reason: 'missing' | 'malformed' };

/** The record as its one line. */
export const repairRecordLine = (record: RepairRecord): string => `${REPAIR_LINE}${JSON.stringify(record)}`;

/** The record with its fingerprint computed again from its retro, wherever it stands. */
function withOwnFingerprint(record: RepairRecord): RepairRecord {
  const own = fingerprint(record.retro);
  return {
    ...record,
    trigger: record.trigger ?? 'failure',
    fingerprint: own,
    retro: { ...record.retro, fingerprint: own },
    report: record.report === null ? null : { ...record.report, fingerprint: own },
  };
}

/** The last `omni repair:` record a job's log holds: readable when it reads whole, unreadable when missing or malformed. */
export function repairLine(log: string): RepairRead {
  const last = log
    .split('\n')
    .map((raw) => raw.trim().replace(STAMP, ''))
    .findLast((line) => line.startsWith(REPAIR_LINE));
  if (last === undefined) return { readable: false, reason: 'missing' };
  let json: unknown;
  try {
    json = JSON.parse(last.slice(REPAIR_LINE.length));
  } catch {
    return { readable: false, reason: 'malformed' };
  }
  const parsed = RepairRecordSchema.safeParse(json);
  return parsed.success ? { readable: true, record: withOwnFingerprint(parsed.data) } : { readable: false, reason: 'malformed' };
}

/**
 * **The PM's plan approval** (PRD omni-loop-26, spec "3. The PM approves the plan"): the one line of a mission's plan job the App
 * reads back from the job's log, as the service (BR-PRODUCT-94: never through a terminal token), to record a mission decision of
 * kind `plan`, role `pm`, for that plan version:
 *
 *   omni plan: {"v":1,"prd":"omni-loop-31","plan":"<sha256>","outcome":"approved"}
 *
 * `prd` the product PRD the PM wrote and planned; `plan` the sha256 of the plan version it approved, so the approval covers exactly
 * that version (BL-APPROVALS-1): a newer version, the Architect's, needs the PM's approval again. Only those fields are kept, in the
 * shape of `omni committee:` (../committee/record.ts).
 *
 * Pure: no filesystem, no network, no clock.
 */
import { z } from 'zod';
import { ProductPrdIdSchema, type ProductPrdId } from '../ids.ts';
import { lastRecordOf } from './pm.ts';

/** What the line starts with. */
const PLAN_LINE = 'omni plan: ';

/** A plan version, by its sha256. */
export const PlanShaSchema = z.string().regex(/^[0-9a-f]{64}$/);

const PlanRecordSchema = z.object({
  v: z.literal(1),
  prd: ProductPrdIdSchema,
  plan: PlanShaSchema,
  outcome: z.enum(['approved']),
});

/** The PM's approval of one plan version of a product PRD. */
export type PlanRecord = z.infer<typeof PlanRecordSchema>;

/** The record as its one line. */
export const planLine = (record: PlanRecord): string => `${PLAN_LINE}${JSON.stringify(record)}`;

/** The last plan record `log` holds for product PRD `prd` that reads whole; null when it holds none. */
export const planRecordOf = (log: string, prd: ProductPrdId): PlanRecord | null => lastRecordOf(log, PLAN_LINE, PlanRecordSchema, (record) => record.prd === prd);

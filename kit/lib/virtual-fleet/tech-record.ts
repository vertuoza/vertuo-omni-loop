/**
 * **The Architect's tech review** (PRD omni-loop-26, spec "4. The Architect reviews it, every time"): the job the fleet's Architect is
 * sent for each product PRD its PM wrote, once the PM approved its plan, and the one line of that job's log the App reads back, as
 * the service (BR-PRODUCT-94), to record a mission decision of kind `tech`, role `architect`:
 *
 *   /omni:tech-review omni-loop-31 --mission 12
 *   omni tech: {"v":1,"prd":"omni-loop-31","plan":"<sha256>","settled":["…"],"open":[],"outcome":"approved"}
 *
 * `plan` the sha256 of the plan version it reviewed, the one it pushed when it changed the plan's coding parts; `settled` what it
 * settled, one line each; `open` what only a person can settle. `approved` names no open point: a review that leaves one is
 * `escalated`, and the PRD waits on a person (BL-GATE-1: never approved by default). A record that does not read is no record at
 * all. Its bounds keep the whole line under the runner's record cut (../runner/steps.ts), so a full-length one reads whole.
 *
 * Pure: no filesystem, no network, no clock.
 */
import { z } from 'zod';
import { ProductPrdIdSchema, type ProductPrdId } from '../ids.ts';
import { PlanShaSchema } from './plan-record.ts';
import { lastRecordOf } from './pm.ts';

/** What the line starts with. */
const TECH_LINE = 'omni tech: ';

/** The most points a record lists in `settled` and in `open`, and the longest one. */
export const POINTS_MAX = 10;
export const POINT_MAX = 300;

const PointSchema = z.string().trim().min(1).max(POINT_MAX).refine((text) => !/[\r\n]/.test(text));

const TechRecordSchema = z
  .object({
    v: z.literal(1),
    prd: ProductPrdIdSchema,
    plan: PlanShaSchema,
    settled: z.array(PointSchema).max(POINTS_MAX),
    open: z.array(PointSchema).max(POINTS_MAX),
    outcome: z.enum(['approved', 'escalated']),
  })
  .refine((record) => record.outcome === 'escalated' || record.open.length === 0, { message: 'an approved review leaves no open point', path: ['open'] });

/** The Architect's review of one plan version of a product PRD. */
export type TechRecord = z.infer<typeof TechRecordSchema>;

/** The record as its one line. */
export const techLine = (record: TechRecord): string => `${TECH_LINE}${JSON.stringify(record)}`;

/** The last tech record `log` holds for product PRD `prd` that reads whole; null when it holds none. */
export const techRecordOf = (log: string, prd: ProductPrdId): TechRecord | null => lastRecordOf(log, TECH_LINE, TechRecordSchema, (record) => record.prd === prd);

/** The line the fleet's Architect is sent to review product PRD `prd` for mission `mission`. */
export const techJobLine = (prd: ProductPrdId, mission: number): string => `/omni:tech-review ${prd} --mission ${String(mission)}`;

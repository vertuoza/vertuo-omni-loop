// PRD 1139, slice s3: the loop plan this checkout follows, every version of it, kept at
// `.omni-loop/local/loop-plan.json` beside ask mode's state and ignored by the same `.gitignore`.
// `omni next --plan` starts it over at version 1; a replan appends the next version; every other
// tick only reads it. A file that is missing, half-written or not of the shape reads as no plan.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { ensureLocalDir, LOCAL_DIR } from '../ask/local-state.ts';
import { PrdNumberSchema, WorkSliceIdSchema } from '../ids.ts';
import type { LoopPlan } from './plan.ts';

export const LOOP_PLAN_FILE = join(LOCAL_DIR, 'loop-plan.json');

const EndedSchema = z.enum(['merged', 'closed', 'shipped']).nullable();

const StepSchema = z.object({
  step: z.number().int().positive(),
  prd: PrdNumberSchema,
  kind: z.enum(['plan', 'wave', 'finish']),
  wave: z.number().int().nullable(),
  slices: z.array(WorkSliceIdSchema),
  after: z.array(z.number().int().positive()),
  waitsFor: z.array(PrdNumberSchema),
  why: z.array(z.string()),
  beside: z.array(z.number().int().positive()),
});

const LoopPlanSchema = z.object({
  version: z.number().int().positive(),
  reason: z.string().nullable(),
  prds: z.array(PrdNumberSchema),
  steps: z.array(StepSchema),
  seen: z.array(z.object({ prd: PrdNumberSchema, slices: z.array(WorkSliceIdSchema).nullable(), stuck: z.array(WorkSliceIdSchema), ended: EndedSchema })),
});

const LoopPlanFileSchema = z.object({ versions: z.array(LoopPlanSchema).min(1) });

/** Every version of the loop plan kept in the checkout at `root`, oldest first; empty with none. */
export function readLoopPlans(root: string): LoopPlan[] {
  try {
    const parsed = LoopPlanFileSchema.safeParse(JSON.parse(readFileSync(join(root, LOOP_PLAN_FILE), 'utf8')));
    return parsed.success ? parsed.data.versions : [];
  } catch {
    return [];
  }
}

/** Keeps `versions` as the loop plan of the checkout at `root`. */
export function writeLoopPlans(root: string, versions: readonly LoopPlan[]): void {
  ensureLocalDir(root);
  writeFileSync(join(root, LOOP_PLAN_FILE), `${JSON.stringify({ versions }, null, 2)}\n`);
}

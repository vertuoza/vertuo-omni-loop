// What `omni sync` keeps (PRD 1990): the record of one run, as `.omni-loop/local/sync.json` holds it
// and as `omni sync --json` prints it. `syncStatus` (`./status.ts`) builds it; the cache
// (`./cache.ts`) reads it back through this schema, so a file of another shape reads as absent.
//
// - `status`: `blue` (a newcomer setting up), `red`, `orange` or `green`.
// - `headline`: the first finding of the heaviest check that holds one of the status's colour; for
//   `blue`, the first open setup step; `null` when green.
// - `setupDoneAt`: when the four setup steps first held in this checkout; `null` for a newcomer.
// - `setup`: the four steps while `blue`, how many are done and each one's line; `null` otherwise.
// - `findings`: in the weight order, each check's findings with its colour after its level; a
//   check with nothing to say holds one green finding, a check whose level is `off` reads `off`.
// - `fix`: the fix line's text (`omni sync --fix  (fast-forwards main, …)`), `null` when none.
import { z } from 'zod';
import { SYNC_CHECKS } from '../config.ts';

export const SEVERITIES = Object.freeze(['green', 'orange', 'red'] as const);
const STATUSES = Object.freeze(['blue', 'red', 'orange', 'green'] as const);
const SETUP_STEPS = Object.freeze(['plugin', 'hud', 'signin', 'main'] as const);

const line = z.string().min(1);

const FindingSchema = z
  .object({
    check: z.enum(SYNC_CHECKS),
    severity: z.enum(SEVERITIES),
    text: line,
    fix: line.nullable(),
  })
  .strict();

const StepSchema = z
  .object({
    step: z.enum(SETUP_STEPS),
    done: z.boolean(),
    text: line,
    fix: line.nullable(),
  })
  .strict();

export const SyncRecordSchema = z
  .object({
    checkedAt: z.iso.datetime(),
    status: z.enum(STATUSES),
    headline: line.nullable(),
    setupDoneAt: z.iso.datetime().nullable(),
    setup: z.object({ done: z.number().int().min(0).max(SETUP_STEPS.length), steps: z.array(StepSchema) }).strict().nullable(),
    findings: z.array(FindingSchema),
    fix: line.nullable(),
  })
  .strict();

/** One run of `omni sync`, as the cache keeps it. */
export type SyncRecord = z.infer<typeof SyncRecordSchema>;

/** One finding of a check. */
export type SyncFinding = z.infer<typeof FindingSchema>;

/** One of the newcomer's four steps. */
export type SetupStep = z.infer<typeof StepSchema>;

/** A finding's colour. */
export type Severity = (typeof SEVERITIES)[number];

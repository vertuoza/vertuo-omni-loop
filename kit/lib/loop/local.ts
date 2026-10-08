// PRD 1139, slice s4: the loop this checkout runs, kept at `.omni-loop/local/loop.json` beside the loop
// plan (`../next/store.ts`) and ignored by the same `.gitignore`. `omni loop push start` writes it with
// the id the app answered; every later push reads that id, so a loop whose terminal closed resumes
// with the same id and the same plan. A file that is missing, half-written or not of the shape reads
// as no loop.
//
// PRD 1208, slice s3: `omni loop push tick` keeps the step it recorded as `last`
// (`{ step, prd, action, result, at }`), and `omni loop push start` keeps the roadmap the loop drives
// as `roadmap` (`null` for none). A file without them, of PRD 1139's shape, still reads: no last step
// and no roadmap.
//
// What the loop is doing is read by the app's rule (its loop state, and
// `loop_is_silent()` in the migration), from the times this checkout last pushed:
//
// - parked or stopped: it ended, with PRDs waiting on people or with none;
// - sleeping: running, before the next wake its last tick set;
// - live: running, from that wake until 5 minutes past it, or, before a tick set a wake, until an hour
//   after its last push (a first tick may run a whole wave);
// - silent: running, past that: the session that ran it died. An unreadable time reads silent.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { ensureLocalDir, LOCAL_DIR } from '../ask/local-state.ts';
import { IssueNumberSchema, PrdNumberSchema } from '../ids.ts';

export const LOOP_FILE = join(LOCAL_DIR, 'loop.json');

/** How long past its next wake a running loop stays live before it reads silent. */
export const SILENT_AFTER_MS = 5 * 60 * 1000;
/** How long a loop with no wake yet stays live after its last push. */
const FIRST_TICK_MS = 60 * 60 * 1000;

/** The step a tick recorded: its number, its PRD, its action, its result line and when. */
const LastStepSchema = z.object({
  step: z.number().int().positive(),
  prd: PrdNumberSchema,
  action: z.string().min(1),
  result: z.string(),
  at: z.string(),
});

const LocalLoopSchema = z.object({
  loopId: z.string().min(1),
  repo: z.string().min(1),
  prds: z.array(PrdNumberSchema),
  state: z.enum(['running', 'parked', 'stopped']),
  startedAt: z.string(),
  seenAt: z.string(),
  nextWakeAt: z.string().nullable(),
  /** The latest version of the loop plan the app was sent. */
  planVersion: z.number().int().positive(),
  /** PRD 1208, s3: the step the last tick recorded; absent before the first tick, and in a file of PRD 1139's shape. */
  last: LastStepSchema.exactOptional(),
  /** PRD 1208, s3: the roadmap the loop drives, `null` for none; absent in a file of PRD 1139's shape. */
  roadmap: IssueNumberSchema.nullable().exactOptional(),
});

export type LocalLoop = z.infer<typeof LocalLoopSchema>;
export type LoopState = 'live' | 'sleeping' | 'parked' | 'stopped' | 'silent';

/** The loop kept in the checkout at `root`, or null when there is none. */
export function readLocalLoop(root: string): LocalLoop | null {
  try {
    const parsed = LocalLoopSchema.safeParse(JSON.parse(readFileSync(join(root, LOOP_FILE), 'utf8')));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Keeps `loop` as the loop of the checkout at `root`. */
export function writeLocalLoop(root: string, loop: LocalLoop): void {
  ensureLocalDir(root);
  writeFileSync(join(root, LOOP_FILE), `${JSON.stringify(loop, null, 2)}\n`);
}

/** live, sleeping, parked, stopped or silent: `loop` at `now` (ms). */
export function loopState(loop: Pick<LocalLoop, 'state' | 'seenAt' | 'nextWakeAt'>, now: number): LoopState {
  if (loop.state !== 'running') return loop.state;
  if (loop.nextWakeAt === null) {
    const seen = Date.parse(loop.seenAt);
    return Number.isFinite(seen) && now < seen + FIRST_TICK_MS ? 'live' : 'silent';
  }
  const wake = Date.parse(loop.nextWakeAt);
  if (!Number.isFinite(wake)) return 'silent';
  if (now < wake) return 'sleeping';
  return now < wake + SILENT_AFTER_MS ? 'live' : 'silent';
}

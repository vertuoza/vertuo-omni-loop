/**
 * **This machine's last result** (PRD 1218, slice s2): what `omni roadmap prereqs` found the last
 * time it ran on this machine, kept in the checkout's local folder (`.omni-loop/local/`, which
 * ignores itself) as `prereqs/<roadmap>.json`. `omni next --roadmap` reads it to hold the PRDs an
 * open prerequisite blocks.
 *
 * A `local` row is true of one machine, so the file keeps one result per machine name, and each
 * machine reads only its own. A file that is missing, half-written or of another shape reads as no
 * result; a write over such a file starts it again.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { ensureLocalDir, LOCAL_DIR } from '../../ask/local-state.ts';
import { IssueNumberSchema } from '../../ids.ts';
import type { IssueNumber } from '../../ids.ts';
import { PREREQUISITE_STATES } from './run.ts';
import type { PrerequisiteResult } from './run.ts';

const RowSchema = z.object({ id: z.string().min(1), state: z.enum(PREREQUISITE_STATES), detail: z.string().nullable() });

const LastResultSchema = z.object({
  roadmap: IssueNumberSchema,
  machine: z.string().min(1),
  checkedAt: z.string().min(1),
  rows: z.array(RowSchema),
});

/** One run's result on one machine: each row's id, state and why it waits. */
export type LastResult = z.infer<typeof LastResultSchema>;

/** The file, relative to the checkout's root. */
export const lastResultFile = (roadmap: IssueNumber): string => join(LOCAL_DIR, 'prereqs', `${roadmap}.json`);

/** Every machine's entry of the file, unchecked; `{}` when it cannot be read. */
function entries(root: string, roadmap: IssueNumber): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(readFileSync(join(root, lastResultFile(roadmap)), 'utf8'));
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? { ...value } : {};
  } catch {
    return {};
  }
}

/** The last result of `machine` for `roadmap`, or null when it has none it can read. */
export function readLastResult(root: string, roadmap: IssueNumber, machine: string): LastResult | null {
  const parsed = LastResultSchema.safeParse(entries(root, roadmap)[machine]);
  return parsed.success && parsed.data.roadmap === roadmap && parsed.data.machine === machine ? parsed.data : null;
}

/** Keeps `result` as its machine's last, beside the other machines'. */
export function writeLastResult(root: string, result: LastResult): void {
  ensureLocalDir(root);
  const file = join(root, lastResultFile(result.roadmap));
  mkdirSync(dirname(file), { recursive: true });
  const kept = { ...entries(root, result.roadmap), [result.machine]: LastResultSchema.parse(result) };
  writeFileSync(file, `${JSON.stringify(kept, null, 2)}\n`);
}

/** A run's results as the result kept for `machine`, checked at `checkedAt`. */
export function lastResultOf(results: readonly PrerequisiteResult[], { roadmap, machine, checkedAt }: Omit<LastResult, 'rows'>): LastResult {
  return { roadmap, machine, checkedAt, rows: results.map(({ prerequisite, state, detail }) => ({ id: prerequisite.id, state, detail })) };
}

// The fleet messages a mission job's claim carries (PRD 3107 s3): what the fleet's members told it that this job's role had
// not read. The runner hands them to the job's session through one file in the job's worktree, under the checkout's local
// folder (never committed: the folder ignores itself), and `omni session start` prints them under `From your people`.
// A job that carries none gets no file, so a session never prints another job's messages.
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { ensureLocalDir, LOCAL_DIR } from '../ask/local-state.ts';

/** Where the runner leaves a job's fleet messages, under the job's worktree. */
export const FROM_YOUR_PEOPLE_FILE = join(LOCAL_DIR, 'from-your-people.json');

/** The most fleet messages one claim carries: the newest, when a role was away for long. */
const MAX_FLEET_MESSAGES = 50;

/** One fleet message: its author's login, its time and its words. */
const FleetMessageSchema = z.object({ author: z.string().min(1).max(200), at: z.string().min(1).max(40), text: z.string().min(1).max(2000) });
export type FleetMessage = z.infer<typeof FleetMessageSchema>;

/** The messages a claim or the file holds, oldest first. */
export const FleetMessagesSchema = z.array(FleetMessageSchema).max(MAX_FLEET_MESSAGES);

/**
 * Leaves `messages` for the session that runs in `worktree`, or, with none, removes any file left there. Answers `null`, or why
 * the file could not be written: the job still runs, and its session prints no block.
 */
export function handFleetMessages(worktree: string, messages: readonly FleetMessage[]): string | null {
  const file = join(worktree, FROM_YOUR_PEOPLE_FILE);
  try {
    if (messages.length === 0) {
      rmSync(file, { force: true });
      return null;
    }
    ensureLocalDir(worktree);
    writeFileSync(file, `${JSON.stringify(messages, null, 2)}\n`);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

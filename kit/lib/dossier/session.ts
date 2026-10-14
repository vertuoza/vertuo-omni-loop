// The session id a command uses, under any coding agent (PRD 1739): `OMNI_SESSION_ID`, then
// `CLAUDE_CODE_SESSION_ID` (both read by `../env/read.ts` as `agentSession`), then the id stored for
// this checkout in `.omni-loop/local/session.json` of its main checkout, then none.
//
// Only `omni dossier open` and `omni session start` (PRD 1831) write the file, when neither variable
// gives an id: each generates one (a random UUID) and stores it, so that a later command from any
// worktree of the checkout finds the same session and its draft. Every other reader (`dossier push`, `omni now`, the session record) reads it back
// and writes nothing. A file that is missing, half-written or holds an id that is not safe reads as
// none.
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { ensureLocalDir, isSafeId, LOCAL_DIR } from '../ask/local-state.ts';
import type { AgentSession } from '../env/read.ts';

export const SESSION_FILE = join(LOCAL_DIR, 'session.json');

const SessionFileSchema = z.object({ id: z.string().refine(isSafeId) });

/** The id stored for the checkout at `root`, or `null`: no root, no file, or one that does not read. */
export function readStoredSession(root: string | null): string | null {
  if (root === null) return null;
  try {
    const parsed = SessionFileSchema.safeParse(JSON.parse(readFileSync(join(root, SESSION_FILE), 'utf8')));
    return parsed.success ? parsed.data.id : null;
  } catch {
    return null;
  }
}

/** The session id a command uses: the variable's, else the one stored at `root`, else `null`. Writes nothing. */
export function sessionIdOf(variable: AgentSession | null, root: string | null): string | null {
  return variable?.id ?? readStoredSession(root);
}

/**
 * The session id `omni dossier open` sends and `omni session start` prints: {@link sessionIdOf},
 * else one `generate` makes, stored at `root` for every later command of the checkout. No root (not
 * in a git checkout), or a file the disk refuses, leaves the id unstored, still used.
 */
export function openSessionId(variable: AgentSession | null, root: string | null, generate: () => string = randomUUID): string {
  const known = sessionIdOf(variable, root);
  if (known !== null) return known;
  const id = generate();
  if (root === null) return id;
  try {
    ensureLocalDir(root);
    writeFileSync(join(root, SESSION_FILE), `${JSON.stringify({ id })}\n`);
  } catch {
    // Unstored: this draft carries the id, and a later push matches the draft by its number.
  }
  return id;
}

// What `omni now` reads (PRD 1208's spec, "What a session is on"): the facts the status line reads
// (`../statusline/facts.ts`, PRD 324) for the session's folder and id, turned into the answer by
// `now.ts`. The PRD is the one the session's branch names, else the one its record names (PRD 324's
// shape); its stage and its board are the status line's own, the board read from the cached file
// with each slice's name. Nothing here prints, fetches, runs `gh`, writes a file or starts a process:
// the board's background refresh is never started from here. Anything that cannot be read reads as
// the session on nothing; it never throws.
import type { ExecText } from '../context.ts';
import type { NamedSlice } from '../statusline/board-cache.ts';
import { readFacts } from '../statusline/facts.ts';
import type { CachedSlice } from '../statusline/schema.ts';
import { NOTHING, nowOfPrd } from './now.ts';
import type { Now } from './now.ts';

/** `slice` with the name the cached board kept for it, when it kept one. */
function named(slice: CachedSlice): NamedSlice {
  return 'name' in slice && typeof slice.name === 'string' ? { ...slice, name: slice.name } : slice;
}

/**
 * What the session in `folder` (else the process's own `cwd`), whose id is `sessionId`, is on now,
 * as of `now` (milliseconds): git is run through `exec`, as of the last fetch.
 */
export function readNow({ cwd, folder, sessionId, exec, now }: { cwd: string; folder: string | null; sessionId: string | null; exec: ExecText; now: number }): Now {
  try {
    const { prd } = readFacts({ currentDir: folder, projectDir: null, sessionId }, { cwd, exec, now, spawn: null });
    if (!prd) return NOTHING;
    return nowOfPrd({ number: prd.number, topic: prd.topic, stage: prd.stage, slices: prd.slices?.map(named) ?? null });
  } catch {
    return NOTHING;
  }
}

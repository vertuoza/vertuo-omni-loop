// Claude Code's status line JSON (PRD 324's spec, "Line 1: the session"): the text Claude Code writes
// on the command's stdin, read into the few fields the status line shows. Pure. Every field is
// optional: one that is missing, `null` or of the wrong type reads as absent, and its part of the
// line is left out, never an error. Text that is not a JSON object reads as `null`: the command then
// prints `omni`.
//
// - `model` — `model.display_name`.
// - `contextPercent` — `context_window.used_percentage`, as sent (a number of 0 or more).
// - `fiveHour` — `rate_limits.five_hour`, as `{ percent, resetsAt }` with `resetsAt` in milliseconds
//   since the epoch; `null` unless both its `used_percentage` and its `resets_at` can be read.
//   `resets_at` is read as Unix seconds when it is a number, and as a date when it is text.
// - `currentDir` — the session's folder: `workspace.current_dir`, else `cwd`.
// - `projectDir` — the folder Claude Code was launched from: `workspace.project_dir`.
// - `sessionId` — the session's id, `session_id`, as sent: it names the session's record
//   (`sessions.ts`), which reads only a safe one.
import { StatusInputSchema } from './schema.ts';

/** Claude Code's JSON, as the status line reads it. */
export type SessionInput = {
  model: string | null;
  contextPercent: number | null;
  fiveHour: { percent: number; resetsAt: number } | null;
  currentDir: string | null;
  projectDir: string | null;
  sessionId: string | null;
};

/** `resets_at` in milliseconds since the epoch, or `null`. */
function instant(value: number | string | null): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value * 1000;
  if (typeof value !== 'string') return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

/** `source`, the text on stdin, read; `null` when it is not text holding a JSON object. */
export function parseInput(source: unknown): SessionInput | null {
  if (typeof source !== 'string') return null;
  let json: unknown;
  try {
    json = JSON.parse(source);
  } catch {
    return null;
  }
  const parsed = StatusInputSchema.safeParse(json);
  if (!parsed.success) return null;
  const { model, context_window: contextWindow, rate_limits: rateLimits, workspace, cwd, session_id: sessionId } = parsed.data;
  const window = rateLimits?.five_hour ?? null;
  const percent = window?.used_percentage ?? null;
  const resetsAt = instant(window?.resets_at ?? null);
  return {
    model: model?.display_name ?? null,
    contextPercent: contextWindow?.used_percentage ?? null,
    fiveHour: percent === null || resetsAt === null ? null : { percent, resetsAt },
    currentDir: workspace?.current_dir ?? cwd,
    projectDir: workspace?.project_dir ?? null,
    sessionId,
  };
}

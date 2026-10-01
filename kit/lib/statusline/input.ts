// @ts-nocheck
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
//   (`sessions.mjs`), which reads only a safe one.

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value) => (typeof value === 'string' && value.length > 0 ? value : null);
const percentage = (value) => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null);
const field = (value, key) => (isObject(value) ? value[key] : undefined);

/** `resets_at` in milliseconds since the epoch, or `null`. */
function instant(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value * 1000;
  if (typeof value !== 'string') return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

function fiveHourOf(json) {
  const window = field(field(json, 'rate_limits'), 'five_hour');
  const percent = percentage(field(window, 'used_percentage'));
  const resetsAt = instant(field(window, 'resets_at'));
  return percent === null || resetsAt === null ? null : { percent, resetsAt };
}

/**
 * @param {unknown} source the text on stdin
 * @returns {{ model: string | null, contextPercent: number | null, fiveHour: { percent: number, resetsAt: number } | null,
 *   currentDir: string | null, projectDir: string | null, sessionId: string | null } | null}
 */
export function parseInput(source) {
  if (typeof source !== 'string') return null;
  let json;
  try {
    json = JSON.parse(source);
  } catch {
    return null;
  }
  if (!isObject(json)) return null;
  const workspace = field(json, 'workspace');
  return {
    model: text(field(field(json, 'model'), 'display_name')),
    contextPercent: percentage(field(field(json, 'context_window'), 'used_percentage')),
    fiveHour: fiveHourOf(json),
    currentDir: text(field(workspace, 'current_dir')) ?? text(json.cwd),
    projectDir: text(field(workspace, 'project_dir')),
    sessionId: text(json.session_id),
  };
}

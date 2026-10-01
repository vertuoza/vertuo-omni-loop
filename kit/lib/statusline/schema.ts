// The shapes the status line reads from outside the process (PRD 725, s18): Claude Code's JSON on
// stdin, a session's record, a PRD's cached board and its refresh's lock. Every read here is lenient
// by design, as it always was: the status line never fails. A field that is missing, `null` or of the
// wrong kind reads as absent, and a file that is not the shape reads as none, so each schema is used
// through `safeParse` and a value that fails it is dropped, not reported.
import { z } from 'zod';

/** A string with at least one character, else `null`. */
const textOrNull = z.string().min(1).nullable().catch(null);

/** A finite number of 0 or more, else `null`. */
const percentOrNull = z.number().min(0).nullable().catch(null);

/** A whole number, as `Number.isInteger` counts one (no safe-integer bound). */
const whole = z.number().refine(Number.isInteger, 'expected a whole number');

/** `rate_limits.five_hour.resets_at`: Unix seconds as a number, or a date as text; else `null`. */
const instantOrNull = z.union([z.number(), z.string()]).nullable().catch(null);

/**
 * Claude Code's status line JSON, the fields the status line shows. Each nested object reads as
 * `null` when it is not an object, and each field inside it as `null` when it is not its kind. Only a
 * value that is not a JSON object at all fails.
 */
export const StatusInputSchema = z.object({
  model: z.object({ display_name: textOrNull }).nullable().catch(null),
  context_window: z.object({ used_percentage: percentOrNull }).nullable().catch(null),
  rate_limits: z
    .object({
      five_hour: z.object({ used_percentage: percentOrNull, resets_at: instantOrNull }).nullable().catch(null),
    })
    .nullable()
    .catch(null),
  workspace: z.object({ current_dir: textOrNull, project_dir: textOrNull }).nullable().catch(null),
  cwd: textOrNull,
  session_id: textOrNull,
});
export type StatusInput = z.infer<typeof StatusInputSchema>;

/** `.omni-loop/local/sessions/<session id>.json`: the PRD a session last worked on, and when. */
export const SessionRecordSchema = z.object({
  prd: whole.refine((value) => value > 0, 'expected a positive PRD number'),
  at: z.string().nullable().catch(null),
});
export type SessionRecord = z.infer<typeof SessionRecordSchema>;

/** One slice of a cached board: its id, its wave and its state on the board. */
export const BoardSliceSchema = z.object({ id: z.string(), wave: whole, state: z.string() });
export type BoardSlice = z.infer<typeof BoardSliceSchema>;

/**
 * `.omni-loop/local/statusline/board-<n>.json`: `{ at, slices }` after a refresh that worked,
 * `{ at, error }` after one that failed. Slices that are not all slices read as absent, as does an
 * error that is not text.
 */
export const BoardFileSchema = z.object({
  at: z.string(),
  slices: z.array(BoardSliceSchema).optional().catch(undefined),
  error: z.string().optional().catch(undefined),
});

/** `.omni-loop/local/statusline/board-<n>.lock`: when the refresh took it, and who did. */
export const LockFileSchema = z.object({
  at: z.string().optional().catch(undefined),
  owner: z.string().optional().catch(undefined),
});

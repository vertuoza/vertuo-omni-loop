// The /api/v1 lists' cursor (PRD 2022 s2, spec "The routes"): the base64url of the last row's
// (created_at, id), tagged with the list it came from, so a page reads on as the keyset
// `(created_at, id) < (…)` on dossiers_workspace_idx and never repeats or skips a row while rows are added.
// The time is kept exactly as the database wrote it, never through a Date, which would drop its
// microseconds. Anything that does not decode to one of ours (tampered, foreign, another list's) reads as
// null, which the controller answers 422; what does decode is a time and a uuid and nothing else, so it
// reaches the query as values, never as filter syntax.
import { z } from 'zod';

/** The lists a cursor pages. */
export type CursorList = 'prds' | 'bug-fixes';

/** Where a page ends: its last row. */
export type Cursor = { list: CursorList; createdAt: string; id: string };

/** Longer than any cursor this writes: a list name, a time and a uuid. */
const MAX_LENGTH = 200;
const BASE64URL = /^[A-Za-z0-9_-]+$/;
const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const toBase64url = (text: string) => btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function fromBase64url(text: string): string | null {
  if (text.length === 0 || text.length > MAX_LENGTH || !BASE64URL.test(text)) return null;
  try {
    return atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  } catch {
    return null;
  }
}

function jsonOf(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** The cursor after `last`, opaque and safe in an address. */
export function encodeCursor(last: Cursor): string {
  return toBase64url(JSON.stringify([last.list, last.createdAt, last.id]));
}

/** The cursor `text` names for `list`, or null when it is not one of that list's. */
export function decodeCursor(text: string, list: CursorList): Cursor | null {
  const decoded = fromBase64url(text);
  const value = decoded === null ? undefined : jsonOf(decoded);
  const read = z.tuple([z.literal(list), z.string().regex(TIME), z.string().regex(UUID)]).safeParse(value);
  if (!read.success) return null;
  const [, createdAt, id] = read.data;
  return { list, createdAt, id };
}

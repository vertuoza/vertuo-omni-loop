import { ClearReplySchema, MemoryReplySchema, type Note } from '../api/supervisor.contract';
import { UNREACHABLE, call, type Called } from '../../runners/runners.client';

// The Memory drawer's words and calls (PRD omni-loop-34 s6, the before/after page's 2.C): the Short-term and
// Long-term tabs, each note with its source, and the question asked in place before an owner deletes one note,
// clears a scope or clears all. The notes are read through GET /api/supervisor/memory; a delete or a clear goes
// through DELETE, which acts as that owner (the database's owner-checked functions refuse anyone else). Findings,
// suggestions and the chat are never cleared: they record decisions. Never `@supabase/*`: the page's session cookies
// go with each call.

export type Scope = Note['scope'];
/** What an owner asked to forget, waiting on their confirmation. */
export type Ask = { what: 'note'; note: string } | { what: 'scope'; scope: Scope } | { what: 'all' };

const SCOPES: Readonly<Record<Scope, { label: string; keeps: string; word: string }>> = {
  short: { label: 'Short-term', keeps: 'Expires after 24 h', word: 'short-term' },
  long: { label: 'Long-term', keeps: 'Kept until cleared', word: 'long-term' },
};
const STAY = 'Findings and chat stay.';

/** The header's button: `Memory · 9`. */
export const memoryWords = (count: number): string => `Memory · ${String(count)}`;

/** One tab: its notes, its name and how long its notes are kept. */
export function scopeOf(notes: readonly Note[], scope: Scope): { notes: Note[]; label: string; keeps: string } {
  return { notes: notes.filter((n) => n.scope === scope), label: SCOPES[scope].label, keeps: SCOPES[scope].keeps };
}

/** A cited row's short id: its first four characters, as the Runners page names jobs. */
const shortId = (id: string) => id.slice(0, 4);

/** Where a note comes from: `cites 8f21, 6a02 · 14:10` (its time in UTC, as the page shows every time). */
export const sourceWords = (note: Note): string => `cites ${note.cites.map(shortId).join(', ')} · ${note.createdAt.slice(11, 16)}`;

const notesWord = (n: number) => `${String(n)} ${n === 1 ? 'note' : 'notes'}`;

/** The question asked in place, what stays, and the button that confirms. */
export function askOf(ask: Ask, notes: readonly Note[]): { question: string; keeps: string; confirm: string } {
  if (ask.what === 'note') return { question: 'Delete this note?', keeps: STAY, confirm: 'Delete the note' };
  if (ask.what === 'all') return { question: `Clear all ${notesWord(notes.length)}?`, keeps: STAY, confirm: `Clear ${notesWord(notes.length)}` };
  const count = notes.filter((n) => n.scope === ask.scope).length;
  return { question: `Clear ${String(count)} ${SCOPES[ask.scope].word} ${count === 1 ? 'note' : 'notes'}?`, keeps: STAY, confirm: `Clear ${notesWord(count)}` };
}

/** The notes left once `ask` was carried out. */
export function notesAfter(notes: readonly Note[], ask: Ask): Note[] {
  if (ask.what === 'all') return [];
  return notes.filter((n) => (ask.what === 'note' ? n.id !== ask.note : n.scope !== ask.scope));
}

const memoryUrl = (workspace: string, extra: Readonly<Record<string, string>> = {}) =>
  `/api/supervisor/memory?${new URLSearchParams({ workspace, ...extra }).toString()}`;

const unreachable = <T>(): Called<T> => ({ ok: false, error: UNREACHABLE });

/** The workspace's notes, both scopes. */
export function readNotes(workspace: string, fetcher: typeof fetch = fetch): Promise<Called<Note[]>> {
  return call(fetcher, memoryUrl(workspace), { method: 'GET' }, (body) => MemoryReplySchema.parse(body).notes).catch(unreachable<Note[]>);
}

function forget(workspace: string, extra: Readonly<Record<string, string>>, fetcher: typeof fetch): Promise<Called<number>> {
  return call(fetcher, memoryUrl(workspace, extra), { method: 'DELETE' }, (body) => ClearReplySchema.parse(body).cleared).catch(unreachable<number>);
}

/** Deletes one note, as the signed-in owner; answers how many went (1). */
export const forgetNote = (workspace: string, note: string, fetcher: typeof fetch = fetch): Promise<Called<number>> => forget(workspace, { note }, fetcher);

/** Clears a scope, or all of the memory, as the signed-in owner; answers how many notes went. */
export const clearMemory = (workspace: string, scope: Scope | 'all', fetcher: typeof fetch = fetch): Promise<Called<number>> => forget(workspace, { scope }, fetcher);

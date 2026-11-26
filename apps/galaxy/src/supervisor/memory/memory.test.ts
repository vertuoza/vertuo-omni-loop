import { describe, expect, it, vi } from 'vitest';
import type { Note } from '../api/supervisor.contract';
import { UNREACHABLE } from '../../runners/runners.client';
import { askOf, clearMemory, forgetNote, memoryWords, notesAfter, readNotes, scopeOf, sourceWords } from './memory';

// The Memory drawer's words and calls (PRD omni-loop-34 s6): its tabs, each note's source, the in-place question
// before a delete or a clear, and GET and DELETE /api/supervisor/memory on a fake fetch.

const note = (id: string, scope: Note['scope'], cites: string[] = ['8f21aa00-0000-4000-8000-000000000001']): Note => ({
  id, scope, line: `note ${id}`, cites, createdAt: '2026-11-25T14:10:00.000Z', expiresAt: scope === 'short' ? '2026-11-26T14:10:00.000Z' : null,
});
const NOTES: Note[] = [note('s1', 'short'), note('s2', 'short'), note('l1', 'long'), note('l2', 'long'), note('l3', 'long')];
const answer = (status: number, body: unknown) => vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status })));

describe('the words', () => {
  it('counts the notes on the header\'s button', () => {
    expect(memoryWords(9)).toBe('Memory · 9');
    expect(memoryWords(0)).toBe('Memory · 0');
  });

  it('splits the notes by scope, each tab with its count and its keeping', () => {
    expect(scopeOf(NOTES, 'short')).toEqual({ notes: [NOTES[0], NOTES[1]], label: 'Short-term', keeps: 'Expires after 24 h' });
    expect(scopeOf(NOTES, 'long')).toMatchObject({ label: 'Long-term', keeps: 'Kept until cleared' });
    expect(scopeOf(NOTES, 'long').notes).toHaveLength(3);
  });

  it('names each note\'s sources by their short ids, then its time', () => {
    expect(sourceWords(note('a', 'short'))).toBe('cites 8f21 · 14:10');
    expect(sourceWords(note('a', 'long', ['6a020000-0000-4000-8000-000000000001', '6a090000-0000-4000-8000-000000000001']))).toBe('cites 6a02, 6a09 · 14:10');
  });

  it('asks in place before it deletes one note, clears a scope or clears all, and says findings and chat stay', () => {
    expect(askOf({ what: 'note', note: 's1' }, NOTES)).toEqual({ question: 'Delete this note?', keeps: 'Findings and chat stay.', confirm: 'Delete the note' });
    expect(askOf({ what: 'scope', scope: 'short' }, NOTES)).toEqual({ question: 'Clear 2 short-term notes?', keeps: 'Findings and chat stay.', confirm: 'Clear 2 notes' });
    expect(askOf({ what: 'scope', scope: 'long' }, NOTES).question).toBe('Clear 3 long-term notes?');
    expect(askOf({ what: 'all' }, NOTES)).toEqual({ question: 'Clear all 5 notes?', keeps: 'Findings and chat stay.', confirm: 'Clear 5 notes' });
    expect(askOf({ what: 'scope', scope: 'short' }, [note('s1', 'short')])).toMatchObject({ question: 'Clear 1 short-term note?', confirm: 'Clear 1 note' });
  });

  it('leaves the notes a delete or a clear did not touch', () => {
    expect(notesAfter(NOTES, { what: 'note', note: 's1' }).map((n) => n.id)).toEqual(['s2', 'l1', 'l2', 'l3']);
    expect(notesAfter(NOTES, { what: 'scope', scope: 'long' }).map((n) => n.id)).toEqual(['s1', 's2']);
    expect(notesAfter(NOTES, { what: 'all' })).toEqual([]);
  });
});

describe('the calls', () => {
  it('reads the workspace\'s notes', async () => {
    const fetcher = answer(200, { notes: NOTES });
    expect(await readNotes('ws-1', fetcher)).toEqual({ ok: true, value: NOTES });
    expect(fetcher).toHaveBeenCalledWith('/api/supervisor/memory?workspace=ws-1', expect.objectContaining({ method: 'GET' }));
  });

  it('deletes one note, or clears a scope or all, as the signed-in owner', async () => {
    const one = answer(200, { cleared: 1 });
    expect(await forgetNote('ws-1', 's1', one)).toEqual({ ok: true, value: 1 });
    expect(one).toHaveBeenCalledWith('/api/supervisor/memory?workspace=ws-1&note=s1', expect.objectContaining({ method: 'DELETE' }));
    const all = answer(200, { cleared: 5 });
    expect(await clearMemory('ws-1', 'all', all)).toEqual({ ok: true, value: 5 });
    expect(all).toHaveBeenCalledWith('/api/supervisor/memory?workspace=ws-1&scope=all', expect.objectContaining({ method: 'DELETE' }));
  });

  it('gives the route\'s words for a refusal, and says unreachable otherwise', async () => {
    expect(await clearMemory('ws-1', 'short', answer(403, { error: 'Only an owner clears the Supervisor\'s memory.' }))).toEqual({ ok: false, error: 'Only an owner clears the Supervisor\'s memory.' });
    expect(await readNotes('ws-1', answer(500, 'nope'))).toEqual({ ok: false, error: UNREACHABLE });
    expect(await readNotes('ws-1', answer(200, { notes: 'x' }))).toEqual({ ok: false, error: UNREACHABLE });
    expect(await forgetNote('ws-1', 's1', vi.fn(() => Promise.reject(new Error('offline'))))).toEqual({ ok: false, error: UNREACHABLE });
  });
});

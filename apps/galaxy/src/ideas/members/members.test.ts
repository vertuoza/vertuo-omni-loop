import { describe, expect, it, vi } from 'vitest';
import { parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { archiveIdea, brainstormLine, readForm, submitIdea, type MembersPort } from './members';
import { membersPort, workspaceBoard, type MembersDb } from './store';
import { MEMBERS } from './words';

// A member's controls on a board (PRD 1246, s4): what the edit form reads, the "Brainstorm this"
// line, and the writes, with the database faked.

const IDEA = '00000000-0000-4000-8000-000000000001';
const form = (over: Record<string, string> = {}) => ({ title: 'Call GitHub less', pitch: 'Fewer API calls.', lane: 'later', prd: '', ...over });

describe('the "Brainstorm this" line', () => {
  it('is /omni:brainstorm with the title and the pitch, quoted', () => {
    expect(brainstormLine({ title: 'Call GitHub less', pitch: 'Fewer API calls.' })).toBe('/omni:brainstorm \'Call GitHub less: Fewer API calls.\'');
  });
});

describe('the edit form', () => {
  it('reads the title, the pitch, the lane and no PRD, trimmed', () => {
    expect(readForm(form({ title: '  Call GitHub less ', lane: 'now' }))).toEqual({ ok: true, idea: { title: 'Call GitHub less', pitch: 'Fewer API calls.', lane: 'now', prd: null } });
  });

  it('reads a PRD number, with or without its #', () => {
    expect(readForm(form({ prd: '1246' }))).toMatchObject({ ok: true, idea: { prd: parsePrd(1246) } });
    expect(readForm(form({ prd: ' #1246 ' }))).toMatchObject({ ok: true, idea: { prd: parsePrd(1246) } });
  });

  it('refuses an empty title, a title over 120 characters and a pitch over 600, in plain words', () => {
    expect(readForm(form({ title: '  ' }))).toEqual({ ok: false, problem: MEMBERS.badTitle });
    expect(readForm(form({ title: 'x'.repeat(121) }))).toEqual({ ok: false, problem: MEMBERS.badTitle });
    expect(readForm(form({ pitch: 'x'.repeat(601) }))).toEqual({ ok: false, problem: MEMBERS.badPitch });
    expect(readForm(form({ title: 'x'.repeat(120), pitch: 'x'.repeat(600) }))).toMatchObject({ ok: true });
  });

  it('refuses a lane that is not Now, Next or Later, and a PRD that is not a number', () => {
    expect(readForm(form({ lane: 'someday' }))).toEqual({ ok: false, problem: MEMBERS.badLane });
    expect(readForm(form({ prd: 'abc' }))).toEqual({ ok: false, problem: MEMBERS.badPrd });
    expect(readForm(form({ prd: '0' }))).toEqual({ ok: false, problem: MEMBERS.badPrd });
  });
});

type Write = { table: string; op: string; values?: unknown; id?: string };

/** A database that records each write and answers what `answer` says. */
function fakeDb(answer: { data?: unknown; error?: { code?: string; message: string } | null } = {}, listing: unknown[] = [{ workspace_id: '00000000-0000-4000-8000-0000000000aa' }]) {
  const writes: Write[] = [];
  const result = (data: unknown) => Promise.resolve({ data: answer.data ?? data, error: answer.error ?? null });
  const db = {
    from: vi.fn((table: string) => ({
      select: () => ({ eq: () => ({ order: () => ({ order: () => ({ limit: () => Promise.resolve({ data: listing, error: null }) }), limit: () => Promise.resolve({ data: listing, error: null }) }) }) }),
      insert: (values: unknown) => { writes.push({ table, op: 'insert', values }); return { select: () => ({ single: () => result({ id: IDEA }) }) }; },
      update: (values: unknown) => ({ eq: (_: string, id: string) => { writes.push({ table, op: 'update', values, id }); return { select: () => result([{ id }]) }; } }),
    })),
    rpc: vi.fn(),
  };
  return { db: db as unknown as MembersDb, writes };
}

describe('a member\'s writes', () => {
  it('adds an idea to the board in the member\'s workspace', async () => {
    const { db, writes } = fakeDb();
    expect(await membersPort(db).add({ repo: 'acme/widgets', title: 'T', pitch: 'P', lane: 'next' })).toBeNull();
    expect(writes).toEqual([{ table: 'ideas', op: 'insert', values: { workspace_id: '00000000-0000-4000-8000-0000000000aa', repo: 'acme/widgets', title: 'T', pitch: 'P', lane: 'next' } }]);
  });

  it('says why an add was refused, in plain words', async () => {
    expect(await membersPort(fakeDb({}, []).db).add({ repo: 'acme/widgets', title: 'T', pitch: 'P', lane: 'next' })).toBe('No workspace of yours lists acme/widgets.');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await membersPort(fakeDb({ error: { code: '08006', message: 'connection lost at 10.0.0.1' } }).db).add({ repo: 'acme/widgets', title: 'T', pitch: 'P', lane: 'next' })).toBe(MEMBERS.failed);
    log.mockRestore();
  });

  it('edits, moves, links a PRD and archives an idea, each one update of that idea', async () => {
    const { db, writes } = fakeDb();
    const port = membersPort(db);
    expect(await port.change(IDEA, { title: 'T', pitch: 'P', lane: 'now', prd: parsePrd(7) })).toBeNull();
    expect(await port.change(IDEA, { archived: true })).toBeNull();
    expect(writes).toEqual([
      { table: 'ideas', op: 'update', values: { title: 'T', pitch: 'P', lane: 'now', prd: 7 }, id: IDEA },
      { table: 'ideas', op: 'update', values: { archived: true }, id: IDEA },
    ]);
  });

  it('reads a change that touched no row as refused: only a member changes an idea', async () => {
    expect(await membersPort(fakeDb({ data: [] }).db).change(IDEA, { archived: true })).toBe(MEMBERS.notMember);
  });

  it('reads a refusal of the database as the member\'s, and anything else as a failure, with no detail', async () => {
    expect(await membersPort(fakeDb({ error: { code: '42501', message: 'row-level security' } }).db).change(IDEA, { archived: true })).toBe(MEMBERS.notMember);
    expect(await membersPort(fakeDb({ error: { code: '23514', message: 'check' } }).db).change(IDEA, { archived: true })).toBe(MEMBERS.broken);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await membersPort(fakeDb({ error: { code: '08006', message: 'down' } }).db).change(IDEA, { archived: true })).toBe(MEMBERS.failed);
    expect(log).toHaveBeenCalledOnce();
    log.mockRestore();
  });
});

describe('a form sent from the page', () => {
  const port = (): MembersPort & { calls: unknown[] } => {
    const calls: unknown[] = [];
    return {
      calls,
      add: vi.fn(async (idea) => { calls.push(['add', idea]); return null; }),
      change: vi.fn(async (id, change) => { calls.push(['change', id, change]); return null; }),
    };
  };

  it('adds a new idea to the board, in the lane chosen, with no PRD yet', async () => {
    const p = port();
    expect(await submitIdea(p, 'acme/widgets', form({ lane: 'next', prd: '12' }))).toBeNull();
    expect(p.calls).toEqual([['add', { repo: 'acme/widgets', title: 'Call GitHub less', pitch: 'Fewer API calls.', lane: 'next' }]]);
  });

  it('edits, moves and links an idea in one change', async () => {
    const p = port();
    expect(await submitIdea(p, 'acme/widgets', form({ lane: 'now', prd: '#9' }), IDEA)).toBeNull();
    expect(p.calls).toEqual([['change', IDEA, { title: 'Call GitHub less', pitch: 'Fewer API calls.', lane: 'now', prd: parsePrd(9) }]]);
  });

  it('writes nothing when the form is refused, and says why', async () => {
    const p = port();
    expect(await submitIdea(p, 'acme/widgets', form({ title: '' }))).toBe(MEMBERS.badTitle);
    expect(p.calls).toEqual([]);
  });

  it('answers the database\'s refusal', async () => {
    expect(await submitIdea({ ...port(), change: async () => MEMBERS.notMember }, 'acme/widgets', form(), IDEA)).toBe(MEMBERS.notMember);
  });

  it('archives an idea', async () => {
    const p = port();
    expect(await archiveIdea(p, IDEA)).toBeNull();
    expect(p.calls).toEqual([['change', IDEA, { archived: true }]]);
  });

  it('saves nothing in the demo, and says so', async () => {
    expect(await submitIdea(null, 'acme/widgets', form())).toBe(MEMBERS.demo);
    expect(await archiveIdea(null, IDEA)).toBe(MEMBERS.demo);
  });
});

describe('the workspace\'s board, for Work › Ideas', () => {
  it('is the repository whose board is public first, else the first one listed', async () => {
    expect(await workspaceBoard(fakeDb({}, [{ full_name: 'acme/widgets' }]).db, 'w')).toBe('acme/widgets');
  });

  it('is none when the workspace lists no repository', async () => {
    expect(await workspaceBoard(fakeDb({}, []).db, 'w')).toBeNull();
  });
});

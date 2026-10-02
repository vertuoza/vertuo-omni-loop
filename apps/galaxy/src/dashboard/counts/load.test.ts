import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ACME, fakeGalaxyDb, PEOPLE, twoWorkspaces, VERTUOZA, type FakeUser } from '../../data/galaxy.fake';
import type { PartInput } from '../part';
import { seasonBounds } from '../season';
import { fakeCountsDb, type AskTables } from './ask.fake';
import { ASK, FOR_ME } from './counts';
import { loadWaiting, waitingOfQuestions } from './load';
import { readWaitingQuestions } from '../../waiting/source';
import { sure } from '../../arcade/sure';

// Waiting for you's read (PRD 328, kept on Home by PRD 572), on the in-memory fake database
// (src/data/galaxy.fake.ts, with the ask tables beside it: ./ask.fake.ts), read as one signed-in
// person under row-level security: your open sessions whose newest round is open, plus the open
// questions shared with you (readTabs, readForMe), now.

const NOW = new Date('2026-09-26T10:00:00Z');
const { ada, both, wile } = PEOPLE;

// ── The ask tables: ADA's sessions, a teammate's who shares with her, another workspace's ─────────

const session = (id: string, owner: string, workspace_id: string, over: Record<string, unknown> = {}) => ({
  id, owner, workspace_id, title: `Session ${id}`, status: 'open', created_at: '2026-09-26T08:00:00Z',
  last_seen_at: '2026-09-26T09:55:00Z', repo: null, branch: null, ...over,
});
const round = (id: string, session_id: string, created_at: string, over: Record<string, unknown> = {}) => ({
  id, session_id, questions: [{ header: 'Access', question: 'Who reads it?', options: [] }], answers: null, answered_via: null,
  status: 'open', created_at, answered_at: null, answered_by: null, category: null, category_by: null, ...over,
});
const answered = (id: string, session_id: string, by: string, at: string, via: 'page' | 'terminal' = 'page') =>
  round(id, session_id, at, { status: 'answered', answers: { 'Who reads it?': 'Members' }, answered_via: via, answered_at: at, answered_by: by });
const share = (round_id: string, shared_with: string, shared_by: string) => ({ round_id, shared_with, shared_by, created_at: '2026-09-26T09:53:00Z' });

function askTables(): AskTables {
  return {
    ask_sessions: [
      session('s-ada', ada.id, VERTUOZA),
      session('s-ada-done', ada.id, VERTUOZA),
      session('s-ada-closed', ada.id, VERTUOZA, { status: 'closed' }),
      session('s-both', both.id, VERTUOZA),
      session('s-wile', wile.id, ACME),
    ],
    ask_rounds: [
      // ADA's open session: one answered in the terminal, and its newest, open: it waits for her.
      answered('r-ada-1', 's-ada', ada.id, '2026-09-26T09:00:00Z', 'terminal'),
      round('r-ada-2', 's-ada', '2026-09-26T09:55:00Z'),
      // Another of hers, whose newest round is answered; on the season's first instant, and on
      // August's last second.
      round('r-done-1', 's-ada-done', '2026-09-20T09:00:00Z', { status: 'abandoned' }),
      answered('r-done-2', 's-ada-done', ada.id, '2026-09-20T10:00:00Z'),
      answered('r-first', 's-ada-done', ada.id, '2026-09-01T00:00:00Z'),
      answered('r-august', 's-ada-done', ada.id, '2026-08-31T23:59:59Z'),
      // A closed session of hers, a round left open in it.
      round('r-closed', 's-ada-closed', '2026-09-25T09:00:00Z'),
      // BOTH's session: one open round shared with ADA, one shared that she answered on the page, and
      // his own, answered in his terminal.
      round('r-both-1', 's-both', '2026-09-26T09:52:00Z'),
      answered('r-both-2', 's-both', ada.id, '2026-09-25T15:00:00Z'),
      answered('r-both-3', 's-both', both.id, '2026-09-24T15:00:00Z', 'terminal'),
      // Acme's: WILE's, never ADA's to read.
      answered('r-wile', 's-wile', wile.id, '2026-09-24T15:00:00Z'),
    ],
    ask_shares: [share('r-both-1', ada.id, both.id), share('r-both-2', ada.id, both.id)],
  };
}

function world(arrange: (w: { game: ReturnType<typeof fakeGalaxyDb>; ask: ReturnType<typeof fakeCountsDb> }) => void = () => {}) {
  const game = fakeGalaxyDb(twoWorkspaces(), Object.values(PEOPLE));
  const ask = fakeCountsDb(game, askTables());
  arrange({ game, ask });
  return { game, ask };
}

/** What a part is given, for one person in one workspace. */
function inputOf(person: FakeUser, w: ReturnType<typeof world>, over: Partial<PartInput> = {}): PartInput {
  const now = over.now ?? NOW;
  return {
    db: w.ask.client(person) as unknown as SupabaseClient,
    workspace: VERTUOZA, userId: person.id, login: person.github?.login.toLowerCase() ?? null, team: null,
    now, season: seasonBounds(now),
    galaxy: () => Promise.reject(new Error('Waiting for you never reads the galaxy')),
    ...over,
  };
}

async function waitingOf(person: FakeUser, over: Partial<PartInput> = {}, arrange?: Parameters<typeof world>[0]) {
  const w = world(arrange);
  return { waiting: await loadWaiting(inputOf(person, w, over)), w };
}

beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); });

describe('Waiting for you', () => {
  it('ADA\'s: her open session\'s newest round and the open question shared with her, linking to /ask', async () => {
    expect((await waitingOf(ada)).waiting).toEqual({ count: 2, href: ASK });
  });

  it('links to /ask/for-me when every waiting question was shared with you', async () => {
    const { waiting } = await waitingOf(ada, {}, ({ ask }) => {
      Object.assign(sure(ask.tables.ask_rounds.find((r) => r.id === 'r-ada-2'), 'the item found'), answered('r-ada-2', 's-ada', ada.id, '2026-09-26T09:58:00Z'));
    });
    expect(waiting).toEqual({ count: 1, href: FOR_ME });
  });

  it('with nothing waiting: 0, linking to /ask', async () => {
    expect((await waitingOf(wile, { workspace: ACME })).waiting).toEqual({ count: 0, href: ASK });
  });

  it('needs no GitHub login, and reads nothing of the game', async () => {
    const { waiting, w } = await waitingOf(ada, { login: null });
    expect(waiting).toEqual({ count: 2, href: ASK });
    expect(w.game.calls.filter((c) => c.kind === 'from')).toEqual([]);
  });

  it.each(['ask_sessions', 'ask_shares'] as const)('%s out of reach: the read rejects, for the page to say so alone', async (table) => {
    await expect(waitingOf(ada, {}, ({ ask }) => { ask.state.failWhen = (read) => read.table === table; })).rejects.toThrow();
  });
});

// PRD 657: the layout reads the waiting list's Questions part once per request (src/data/viewer.ts);
// Home counts Waiting for you from it rather than reading the ask tables again. Same world, same count.
describe('Waiting for you, from the questions the layout read', () => {
  async function both(person: FakeUser, over: Partial<PartInput> = {}, arrange?: Parameters<typeof world>[0]) {
    const w = world(arrange);
    const input = inputOf(person, w, over);
    const questions = await readWaitingQuestions(input.db, person.id, input.now.getTime());
    return { read: await loadWaiting(input), reused: waitingOfQuestions(questions) };
  }

  it('counts ADA\'s two, linking to /ask, as the read does', async () => {
    const { read, reused } = await both(ada);
    expect(reused).toEqual({ count: 2, href: ASK });
    expect(reused).toEqual(read);
  });

  it('links to /ask/for-me when every waiting question was shared, as the read does', async () => {
    const { read, reused } = await both(ada, {}, ({ ask }) => {
      Object.assign(sure(ask.tables.ask_rounds.find((r) => r.id === 'r-ada-2'), 'the item found'), answered('r-ada-2', 's-ada', ada.id, '2026-09-26T09:58:00Z'));
    });
    expect(reused).toEqual({ count: 1, href: FOR_ME });
    expect(reused).toEqual(read);
  });

  it('is 0, linking to /ask, with nothing waiting', async () => {
    const { read, reused } = await both(wile, { workspace: ACME });
    expect(reused).toEqual({ count: 0, href: ASK });
    expect(reused).toEqual(read);
  });
});

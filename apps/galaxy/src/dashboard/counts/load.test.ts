import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ACME, contribution, fakeGalaxyDb, PEOPLE, twoWorkspaces, VERTUOZA, type FakeTables, type FakeUser } from '../../data/galaxy.fake';
import type { PartInput } from '../part';
import { seasonBounds } from '../season';
import { fakeCountsDb, type AskTables } from './ask.fake';
import { ASK, FOR_ME } from './counts';
import { loadCounts } from './load';

// The four counts' read (PRD 328), on the in-memory fake database (src/data/galaxy.fake.ts, with the
// ask tables beside it: ./ask.fake.ts), read as one signed-in person under row-level security.
// Questions answered: the ask rounds you answered this season. Outbox settled: the ledger's
// WOUND_CLOSED events of an outbox item credited to your login, this season. PRDs created: your
// prd-opened contributions this season. Waiting for you: your open sessions whose newest round is
// open, plus the open questions shared with you (readTabs, readForMe), now. The season is the UTC
// month; each tile reads on its own, and one that fails says so alone.

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

// ── The ledger: outbox items settled, and events that are not ──────────────────────────────────────

const event = (workspace_id: string, id: string, contributor: string | null, at: string, type = 'WOUND_CLOSED') => ({
  workspace_id, id, at, type, planet: 12, region: 'vertuo-core', contributor, team: null, data: { kind: 'dust', rank: 'medium', verdict: 'agreed' },
});

const LEDGER = [
  event(VERTUOZA, 'outbox:vertuo-core:12/s1-01-a:closed', 'Ada-GH', '2026-09-10T10:00:00Z'),
  event(VERTUOZA, 'outbox:vertuo-core:12/s2-01-b:closed', 'ada-gh', '2026-09-25T10:00:00Z'),
  event(VERTUOZA, 'fire:vertuo-core:12/s3:closed', 'ada-gh', '2026-09-24T10:00:00Z'),
  event(VERTUOZA, 'outbox:vertuo-core:12/s2-02-c:opened', null, '2026-09-24T10:00:00Z', 'WOUND_OPENED'),
  event(VERTUOZA, 'outbox:vertuo-core:12/s3-01-d:closed', 'both-gh', '2026-09-23T10:00:00Z'),
  event(VERTUOZA, 'outbox:vertuo-core:12/s0-01-e:closed', 'ada-gh', '2026-08-31T23:59:59Z'),
  event(ACME, 'outbox:acme-api:9/s1-01-f:closed', 'both-gh', '2026-09-12T10:00:00Z'),
  event(ACME, 'outbox:acme-api:9/s1-02-g:closed', 'Both-GH', '2026-09-13T10:00:00Z'),
];

function world(arrange: (w: { game: ReturnType<typeof fakeGalaxyDb>; ask: ReturnType<typeof fakeCountsDb> }) => void = () => {}) {
  const seed: Partial<FakeTables> = twoWorkspaces();
  seed.ledger_events = [...(seed.ledger_events ?? []), ...LEDGER];
  const game = fakeGalaxyDb(seed, Object.values(PEOPLE));
  const ask = fakeCountsDb(game, askTables());
  arrange({ game, ask });
  return { game, ask };
}

/** What a part is given, for one person in one workspace (their login as load.ts reads it). */
function inputOf(person: FakeUser, w: ReturnType<typeof world>, over: Partial<PartInput> = {}): PartInput {
  const now = over.now ?? NOW;
  return {
    db: w.ask.client(person) as unknown as SupabaseClient,
    workspace: VERTUOZA, userId: person.id, login: person.github?.login.toLowerCase() ?? null, team: null,
    now, season: seasonBounds(now),
    galaxy: () => Promise.reject(new Error('the counts never read the galaxy')),
    ...over,
  };
}

async function countsOf(person: FakeUser, over: Partial<PartInput> = {}, arrange?: Parameters<typeof world>[0]) {
  const w = world(arrange);
  const counts = await loadCounts(inputOf(person, w, over));
  return { counts, w };
}

const errors = () => vi.mocked(console.error).mock.calls.map((c) => String(c[0]));

beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); });

describe('the four counts', () => {
  it('ADA\'s this season: 4 questions answered, 2 outbox items settled, 1 PRD created, and 2 questions waiting, linking to /ask', async () => {
    const { counts } = await countsOf(ada);
    expect(counts).toEqual({ answered: 4, settled: 2, prds: 1, waiting: { count: 2, href: ASK } });
    expect(errors()).toEqual([]);
  });

  it('Questions answered counts the rounds you answered, in the terminal or on the page, yours or shared with you, and no one else\'s', async () => {
    expect((await countsOf(both)).counts).toMatchObject({ answered: 1 });
    expect((await countsOf(wile, { workspace: ACME })).counts).toMatchObject({ answered: 1 });
  });

  it('Waiting for you links to /ask/for-me when every waiting question was shared with you', async () => {
    const { counts } = await countsOf(ada, {}, ({ ask }) => {
      Object.assign(ask.tables.ask_rounds.find((r) => r.id === 'r-ada-2')!, answered('r-ada-2', 's-ada', ada.id, '2026-09-26T09:58:00Z'));
    });
    expect(counts).toMatchObject({ answered: 5, waiting: { count: 1, href: FOR_ME } });
  });

  it('Waiting for you, with nothing waiting: 0, linking to /ask', async () => {
    const { counts } = await countsOf(wile, { workspace: ACME });
    expect(counts).toMatchObject({ waiting: { count: 0, href: ASK } });
  });

  it('matches your login ignoring case, in the ledger and in the contributions', async () => {
    const { counts } = await countsOf(ada, {}, ({ game }) => {
      game.tables.contributions.push({ ...contribution(VERTUOZA, 'prd-opened', 'vertuo-core', 8, 'ada-gh', '2026-09-15T08:00:00Z'), login: 'Ada-GH' });
    });
    expect(counts).toMatchObject({ settled: 2, prds: 2 });
  });

  it('never counts another workspace\'s ledger or contributions: BOTH, a member of both, counts each one\'s apart', async () => {
    expect((await countsOf(both, { workspace: VERTUOZA })).counts).toMatchObject({ settled: 1, prds: 0 });
    expect((await countsOf(both, { workspace: ACME })).counts).toMatchObject({ settled: 2, prds: 1 });
  });

  it('reads the game\'s tables of the workspace shown only: every read filters on it', async () => {
    const { w } = await countsOf(both, { workspace: ACME });
    const game = w.game.calls.filter((c) => c.kind === 'from');
    expect(game.map((c) => c.kind === 'from' && c.table).sort()).toEqual(['contributions', 'ledger_events']);
    for (const call of game) expect(call.kind === 'from' && call.eq.workspace_id).toBe(ACME);
  });

  it('never reads the galaxy: the ledger\'s outbox settles are counted by the database', async () => {
    const galaxy = vi.fn(() => Promise.reject(new Error('read')));
    const w = world();
    await loadCounts(inputOf(ada, w, { galaxy }));
    expect(galaxy).not.toHaveBeenCalled();
  });
});

describe('the season', () => {
  const OCTOBER = new Date('2026-10-01T00:30:00Z');

  it('on its first day, nothing of the month before counts', async () => {
    const { counts } = await countsOf(ada, { now: OCTOBER });
    expect(counts).toMatchObject({ answered: 0, settled: 0, prds: 0 });
  });

  it('starts at 00:00 UTC on the 1st: late on the 30th is September\'s, even when Brussels is already in October', async () => {
    const { counts } = await countsOf(ada, { now: OCTOBER }, ({ game, ask }) => {
      ask.tables.ask_rounds.push(
        answered('r-late', 's-ada-done', ada.id, '2026-09-30T22:30:00Z'),
        answered('r-oct', 's-ada-done', ada.id, '2026-10-01T00:00:00Z'),
      );
      game.tables.ledger_events.push(
        event(VERTUOZA, 'outbox:vertuo-core:12/s4-01-late:closed', 'ada-gh', '2026-09-30T22:30:00Z'),
        event(VERTUOZA, 'outbox:vertuo-core:12/s4-02-oct:closed', 'ada-gh', '2026-10-01T00:00:00Z'),
      );
      game.tables.contributions.push(
        contribution(VERTUOZA, 'prd-opened', 'vertuo-core', 20, 'ada-gh', '2026-09-30T22:30:00Z'),
        contribution(VERTUOZA, 'prd-opened', 'vertuo-core', 21, 'ada-gh', '2026-10-01T00:00:00Z'),
      );
    });
    expect(counts).toMatchObject({ answered: 1, settled: 1, prds: 1 });
  });
});

describe('without a GitHub login', () => {
  it('Outbox settled and PRDs created say to link it; Questions answered and Waiting for you still count', async () => {
    const { counts, w } = await countsOf(ada, { login: null });
    expect(counts).toEqual({ answered: 4, settled: 'no-github', prds: 'no-github', waiting: { count: 2, href: ASK } });
    expect(w.game.calls.filter((c) => c.kind === 'from')).toEqual([]);
  });
});

describe('one read failing', () => {
  it('the ledger: only Outbox settled reads unreadable, and the error is logged', async () => {
    const { counts } = await countsOf(ada, {}, ({ game }) => { game.state.failOn = 'ledger_events'; });
    expect(counts).toEqual({ answered: 4, settled: 'unreadable', prds: 1, waiting: { count: 2, href: ASK } });
    expect(errors().some((e) => /outbox/.test(e) && /ledger_events is out of reach/.test(e))).toBe(true);
  });

  it('the contributions: only PRDs created reads unreadable', async () => {
    const { counts } = await countsOf(ada, {}, ({ game }) => { game.state.failOn = 'contributions'; });
    expect(counts).toEqual({ answered: 4, settled: 2, prds: 'unreadable', waiting: { count: 2, href: ASK } });
    expect(errors().some((e) => /PRDs/.test(e))).toBe(true);
  });

  it('the questions answered: only that tile reads unreadable', async () => {
    const { counts } = await countsOf(ada, {}, ({ ask }) => { ask.state.failWhen = (read) => read.table === 'ask_rounds' && read.counting; });
    expect(counts).toEqual({ answered: 'unreadable', settled: 2, prds: 1, waiting: { count: 2, href: ASK } });
  });

  it.each(['ask_sessions', 'ask_shares'] as const)('%s, for the questions waiting: only Waiting for you reads unreadable', async (table) => {
    const { counts } = await countsOf(ada, {}, ({ ask }) => { ask.state.failWhen = (read) => read.table === table; });
    expect(counts).toEqual({ answered: 4, settled: 2, prds: 1, waiting: 'unreadable' });
    expect(errors().some((e) => /waiting/.test(e))).toBe(true);
  });

  it('the whole database: every tile reads unreadable, each on its own, and the part still comes', async () => {
    const { counts } = await countsOf(ada, {}, ({ game, ask }) => {
      game.state.fail = { message: 'timeout' };
      ask.state.failWhen = () => true;
    });
    expect(counts).toEqual({ answered: 'unreadable', settled: 'unreadable', prds: 'unreadable', waiting: 'unreadable' });
  });
});

import { describe, expect, it } from 'vitest';
import { AskStoreError } from './rows';
import { readHistory } from './page/source';
import type { RoundRow, SessionRow } from './page/view';
import { historyDatabase } from './page/workspace-history.fake';
import type { HistoryRow } from './page/workspace-history';

// The history's read (PRD omni-loop-23, ADR-0171): one page and the counts, asked of the database's
// two functions (ask_history_page, ask_history_facets) as the caller, in place of the newest thousand
// rounds. What the functions read (row-level security, the words, the cursor) is proved by
// supabase/checks/ask_history_page.sql; here, what the app sends them and what it makes of the answer.

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const at = (minute: number) => new Date(Date.parse('2026-11-01T09:00:00Z') + minute * 60_000).toISOString();
const SESSION: SessionRow = { id: uuid(9000), owner: 'ada', title: 'api · main', status: 'closed', created_at: at(0), last_seen_at: at(0), repo: 'acme/api', branch: 'main' };

const round = (n: number, patch: Partial<RoundRow> = {}): HistoryRow => ({
  session: SESSION,
  round: { id: uuid(n), questions: [], answers: {}, answered_via: 'page', status: 'answered', created_at: at(n), answered_at: at(n), ...patch },
});

describe('the history, read in the database', () => {
  it('asks for one round more than a page, to tell whether an older page follows, and never reads the search column', async () => {
    const database = historyDatabase([round(1), round(2), round(3)]);
    const page = await readHistory(database.db, { repo: 'acme/api' }, 2);
    expect(database.calls.map((c) => [c.name, c.args])).toEqual([
      ['ask_history_page', { filters: { repo: 'acme/api' }, before: null, page_size: 3 }],
      ['ask_history_facets', { filters: { repo: 'acme/api' } }],
    ]);
    expect(database.calls[0]?.columns).not.toMatch(/search/);
    expect(page.rows.map((r) => r.round.id)).toEqual([uuid(3), uuid(2)]);
    expect(page.rows[0]?.round).not.toHaveProperty('search');
    expect(page.rows[0]?.round).not.toHaveProperty('session_id');
    expect(page.rows[0]?.session).toEqual(SESSION);
    expect(page.next).toBe(uuid(2));
  });

  it('sends the cursor apart from the filters, and reads the last page with no cursor after it', async () => {
    const database = historyDatabase([round(1), round(2), round(3)]);
    const page = await readHistory(database.db, { before: uuid(2) }, 2);
    expect(database.calls[0]?.args).toEqual({ filters: {}, before: uuid(2), page_size: 3 });
    expect(page.rows.map((r) => r.round.id)).toEqual([uuid(1)]);
    expect(page.next).toBeNull();
  });

  it('reads an empty page, and still the counts, for a cursor that is no round\'s id', async () => {
    const database = historyDatabase([round(1)]);
    const page = await readHistory(database.db, { before: 'demo-round-trial' });
    expect(database.calls.map((c) => c.name)).toEqual(['ask_history_facets']);
    expect(page).toMatchObject({ rows: [], next: null });
    expect(page.facets.find((f) => f.id === 'unsorted')).toEqual({ id: 'unsorted', matched: 1, total: 1 });
  });

  it('reads nothing when there is nothing, and throws when the database fails', async () => {
    const database = historyDatabase([]);
    expect(await readHistory(database.db)).toMatchObject({ rows: [], next: null });
    database.state.fail = { code: '08006', message: 'connection lost' };
    await expect(readHistory(database.db)).rejects.toBeInstanceOf(AskStoreError);
  });
});
